import { AuditLog } from "../models/AuditLog.js";
import { Coupon } from "../models/Coupon.js";
import { Discount } from "../models/Discount.js";

export interface ExpiryRepository {
  findDueIds(now: Date): Promise<string[]>;
  deactivate(id: string, now: Date): Promise<boolean>;
}

export interface ExpiryStore {
  discounts: ExpiryRepository;
  coupons: ExpiryRepository;
  audit(targetType: "Discount" | "Coupon", targetId: string, now: Date): Promise<void>;
}

export async function sweepExpiredPromotions(now = new Date(), store: ExpiryStore = databaseStore) {
  const expired = { discounts: 0, coupons: 0 };
  for (const [key, collection, targetType] of [
    ["discounts", store.discounts, "Discount"],
    ["coupons", store.coupons, "Coupon"],
  ] as const) {
    for (const id of await collection.findDueIds(now)) {
      if (await collection.deactivate(id, now)) {
        await store.audit(targetType, id, now);
        expired[key] += 1;
      }
    }
  }
  return expired;
}

const databaseStore: ExpiryStore = {
  discounts: {
    async findDueIds(now) {
      const items = await Discount.find({ isActive: true, endsAt: { $lte: now } }).select("_id").lean().exec();
      return items.map((item) => String(item._id));
    },
    async deactivate(id, now) {
      const result = await Discount.updateOne(
        { _id: id, isActive: true, endsAt: { $lte: now } },
        { $set: { isActive: false } },
      ).exec();
      return result.modifiedCount === 1;
    },
  },
  coupons: {
    async findDueIds(now) {
      const items = await Coupon.find({ isActive: true, expiresAt: { $lte: now } }).select("_id").lean().exec();
      return items.map((item) => String(item._id));
    },
    async deactivate(id, now) {
      const result = await Coupon.updateOne(
        { _id: id, isActive: true, expiresAt: { $lte: now } },
        { $set: { isActive: false } },
      ).exec();
      return result.modifiedCount === 1;
    },
  },
  async audit(targetType, targetId, now) {
    await AuditLog.create({
      actor: null,
      actorEmail: "system",
      action: "expire",
      targetType,
      targetId,
      ip: "system",
      createdAt: now,
    });
  },
}
