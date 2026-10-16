import { Router, type Request as ExpressRequest, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import type { AdminRole } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { Coupon } from "../models/Coupon.js";
import { Discount } from "../models/Discount.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import {
  sendCsv,
  sendPdf,
  sendXlsx,
  type ReportRow,
} from "../services/reportExports.js";

const reportNames = ["sales", "customers", "payments", "orders", "inventory", "discounts"] as const;
export type ReportName = (typeof reportNames)[number];
const reportHeaders: Record<ReportName, string[]> = {
  sales: ["date", "orders", "cancelledOrders", "items", "subtotal", "discount", "shipping", "netSales", "refundedAmount"],
  customers: ["customerId", "name", "email", "phone", "joinedAt"],
  payments: ["orderId", "customerName", "customerEmail", "paymentMethod", "paymentStatus", "amount", "refundStatus", "refundAmount", "createdAt"],
  orders: ["orderId", "customerName", "customerEmail", "status", "paymentStatus", "paymentMethod", "items", "total", "createdAt"],
  inventory: ["productId", "sku", "name", "category", "stock", "price", "costPrice", "updatedAt"],
  discounts: ["kind", "reference", "name", "redemptions", "discountAmount", "sales"],
};

export const reportDateRangeQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
}).strict().superRefine(({ from, to }, context) => {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || start.toISOString().slice(0, 10) !== from) {
    context.addIssue({ code: "custom", message: "Invalid start date", path: ["from"] });
  }
  if (Number.isNaN(end.valueOf()) || end.toISOString().slice(0, 10) !== to) {
    context.addIssue({ code: "custom", message: "Invalid end date", path: ["to"] });
  }
  if (start > end) {
    context.addIssue({ code: "custom", message: "Start date must not be after end date", path: ["to"] });
  } else if ((end.valueOf() - start.valueOf()) / 86_400_000 + 1 > 366) {
    context.addIssue({ code: "custom", message: "Date range must not exceed 366 days", path: ["to"] });
  }
});

export function canAccessReport(role: AdminRole, report: ReportName): boolean {
  if (role === "superadmin" || role === "manager") return true;
  return role === "support" && (report === "customers" || report === "orders");
}

export function maskCustomerName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return "";
  return name
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1)}${part.length > 1 ? "***" : ""}`)
    .join(" ");
}

export function maskCustomerEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const [local, domain] = value.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskCustomerPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  return digits.length <= 2 ? "***" : `${"*".repeat(Math.min(digits.length - 2, 10))}${digits.slice(-2)}`;
}

const dateQuery = (request: ExpressRequest) => reportDateRangeQuery.parse(request.query);
const dayBounds = (from: string, to: string) => ({
  start: new Date(`${from}T00:00:00.000Z`),
  end: new Date(new Date(`${to}T00:00:00.000Z`).valueOf() + 86_400_000),
});

function customerFields(user: { name?: unknown; email?: unknown; phone?: unknown } | null, masked: boolean) {
  return {
    name: masked ? maskCustomerName(user?.name) : String(user?.name ?? ""),
    email: masked ? maskCustomerEmail(user?.email) : String(user?.email ?? ""),
    phone: masked ? maskCustomerPhone(user?.phone) : String(user?.phone ?? ""),
  };
}

async function* reportRows(
  report: ReportName,
  start: Date,
  end: Date,
  masked: boolean,
): AsyncGenerator<ReportRow> {
  if (report === "sales") {
    const cursor = Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "UTC" } },
          orders: { $sum: { $cond: [{ $ne: ["$orderStatus", "cancelled"] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
          items: {
            $sum: {
              $cond: [
                { $ne: ["$orderStatus", "cancelled"] },
                { $reduce: { input: "$items", initialValue: 0, in: { $add: ["$$value", "$$this.qty"] } } },
                0,
              ],
            },
          },
          subtotal: { $sum: { $cond: [{ $ne: ["$orderStatus", "cancelled"] }, "$subtotal", 0] } },
          discount: { $sum: { $cond: [{ $ne: ["$orderStatus", "cancelled"] }, "$discount", 0] } },
          shipping: { $sum: { $cond: [{ $ne: ["$orderStatus", "cancelled"] }, "$shipping", 0] } },
          netSales: { $sum: { $cond: [{ $ne: ["$orderStatus", "cancelled"] }, "$total", 0] } },
          refundedAmount: { $sum: "$refundAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]).cursor({ batchSize: 250 });
    for await (const row of cursor) {
      yield { date: row._id, ...row, _id: undefined };
    }
    return;
  }

  if (report === "customers") {
    const cursor = User.find({ createdAt: { $gte: start, $lt: end } })
      .select("_id name email phone createdAt")
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .cursor({ batchSize: 250 });
    for await (const user of cursor) {
      const details = customerFields(user, masked);
      yield {
        customerId: String(user._id),
        ...details,
        joinedAt: user.createdAt,
      };
    }
    return;
  }

  if (report === "payments" || report === "orders") {
    const cursor = Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $lookup: {
          from: User.collection.name,
          localField: "user",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          customerName: "$customer.name",
          customerEmail: "$customer.email",
          paymentMethod: 1,
          paymentStatus: 1,
          amount: "$total",
          refundStatus: 1,
          refundAmount: 1,
          createdAt: 1,
          status: "$orderStatus",
          items: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.qty"] },
            },
          },
          total: 1,
        },
      },
      { $sort: { createdAt: 1, _id: 1 } },
    ]).cursor({ batchSize: 250 });
    for await (const row of cursor) {
      const customer = customerFields(
        { name: row.customerName, email: row.customerEmail },
        masked,
      );
      if (report === "payments") {
        yield {
          orderId: String(row._id),
          customerName: customer.name,
          customerEmail: customer.email,
          paymentMethod: row.paymentMethod,
          paymentStatus: row.paymentStatus,
          amount: row.amount,
          refundStatus: row.refundStatus,
          refundAmount: row.refundAmount,
          createdAt: row.createdAt,
        };
      } else {
        yield {
          orderId: String(row._id),
          customerName: customer.name,
          customerEmail: customer.email,
          status: row.status,
          paymentStatus: row.paymentStatus,
          paymentMethod: row.paymentMethod,
          items: row.items,
          total: row.total,
          createdAt: row.createdAt,
        };
      }
    }
    return;
  }

  if (report === "inventory") {
    const cursor = Product.find({ updatedAt: { $gte: start, $lt: end } })
      .select("_id sku name category stock price costPrice updatedAt")
      .sort({ name: 1, _id: 1 })
      .lean()
      .cursor({ batchSize: 250 });
    for await (const product of cursor) {
      yield {
        productId: String(product._id),
        sku: product.sku ?? "",
        name: product.name,
        category: product.category,
        stock: product.stock,
        price: product.price,
        costPrice: product.costPrice,
        updatedAt: product.updatedAt,
      };
    }
    return;
  }

  const [discountGroups, couponGroups] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $unwind: "$items" },
      { $unwind: "$items.discounts" },
      {
        $group: {
          _id: { discountId: "$items.discounts.discountId", orderId: "$_id" },
          name: { $first: "$items.discounts.name" },
          discountAmount: { $sum: "$items.discounts.amount" },
          sales: { $sum: { $multiply: ["$items.unitPrice", "$items.qty"] } },
        },
      },
      {
        $group: {
          _id: "$_id.discountId",
          name: { $first: "$name" },
          redemptions: { $sum: 1 },
          discountAmount: { $sum: "$discountAmount" },
          sales: { $sum: "$sales" },
        },
      },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, couponCode: { $type: "string", $ne: "" } } },
      {
        $group: {
          _id: "$couponCode",
          redemptions: { $sum: 1 },
          discountAmount: { $sum: "$discount" },
          sales: { $sum: "$total" },
        },
      },
    ]),
  ]);
  const discountIds = discountGroups
    .map((group) => group._id)
    .filter((id: unknown): id is string => typeof id === "string" && mongoose.isValidObjectId(id));
  const discountNames = discountIds.length
    ? await Discount.find({ _id: { $in: discountIds } }).select("_id name").lean()
    : [];
  const namesById = new Map(discountNames.map((item) => [String(item._id), item.name]));
  for (const group of discountGroups) {
    yield {
      kind: "discount",
      reference: String(group._id ?? ""),
      name: namesById.get(String(group._id)) ?? String(group.name ?? ""),
      redemptions: Array.isArray(group.redemptions) ? group.redemptions.length : 0,
      discountAmount: group.discountAmount,
      sales: group.sales,
    };
  }
  const couponIds = couponGroups.map((group) => String(group._id));
  const coupons = couponIds.length ? await Coupon.find({ code: { $in: couponIds } }).select("code").lean() : [];
  const couponCodes = new Set(coupons.map((coupon) => coupon.code));
  for (const group of couponGroups) {
    yield {
      kind: "coupon",
      reference: group._id,
      name: couponCodes.has(group._id) ? group._id : "Retired coupon",
      redemptions: group.redemptions,
      discountAmount: group.discountAmount,
      sales: group.sales,
    };
  }
}

const validateReportQuery: RequestHandler = (request, _response, next) => {
  try {
    reportDateRangeQuery.parse(request.query);
    next();
  } catch (error) {
    next(error);
  }
};

export const reportsRouter = Router();
reportsRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
}));

reportsRouter.get("/:report", validateReportQuery, async (request, response, next) => {
  try {
    if (!reportNames.includes(request.params.report as ReportName)) {
      response.status(404).json({ error: "Report not found" });
      return;
    }
    const report = request.params.report as ReportName;
    const role = request.admin?.role;
    if (!role || !canAccessReport(role, report)) {
      response.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    const query = dateQuery(request);
    if (query.format === "pdf" && !["sales", "customers", "payments"].includes(report)) {
      response.status(400).json({ error: "PDF exports are available only for sales, customers, and payments" });
      return;
    }

    const { start, end } = dayBounds(query.from, query.to);
    const filename = `${report}-${query.from}-to-${query.to}.${query.format === "xlsx" ? "xlsx" : query.format}`;
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await writeAudit(request, `report.export:${report}:${query.format}`, "report", `${query.from}:${query.to}`);

    const rows = reportRows(report, start, end, role === "support");
    const headers = reportHeaders[report];
    if (query.format === "csv") await sendCsv(response, headers, rows);
    else if (query.format === "xlsx") await sendXlsx(response, headers, rows);
    else await sendPdf(response, `${report[0].toUpperCase()}${report.slice(1)} report`, `${query.from} to ${query.to}`, headers, rows);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }
    next(error);
  }
});
