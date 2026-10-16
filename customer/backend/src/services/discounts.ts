import { Discount } from "../models/Discount.js";

export type DiscountType = "percent" | "flat";

export interface DiscountCandidate {
  _id?: unknown;
  name: string;
  scope: "product" | "category" | "collection" | "sitewide";
  targets: string[];
  type: DiscountType;
  value: number;
  maxDiscount?: number | null;
  startsAt: Date | string;
  endsAt: Date | string;
  isFlashSale?: boolean;
  priority: number;
  stackable: boolean;
}

export interface DiscountSnapshot {
  discountId: string;
  name: string;
  type: DiscountType;
  value: number;
  amount: number;
}

export async function findActiveDiscounts(now = new Date()): Promise<DiscountCandidate[]> {
  const discounts = await Discount.find({
    isActive: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  })
    .sort({ priority: -1, _id: 1 })
    .lean()
    .exec();
  return discounts as DiscountCandidate[];
}

export function selectApplicableDiscounts(
  discounts: readonly DiscountCandidate[],
  product: { id: string; slug?: string; category: string; collection?: string },
  now = new Date(),
): DiscountCandidate[] {
  const applicable = discounts
    .filter((discount) => {
      const startsAt = new Date(discount.startsAt).getTime();
      const endsAt = new Date(discount.endsAt).getTime();
      const targets = discount.targets;
      const scope = discount.scope;
      const matchesScope =
        scope === "sitewide" ||
        (scope === "product" &&
          targets.some(
            (target) =>
              target.toLowerCase() === product.id.toLowerCase() ||
              target.toLowerCase() === product.slug?.toLowerCase(),
          )) ||
        (scope === "category" &&
          targets.some((target) => target.toLowerCase() === product.category.toLowerCase())) ||
        (scope === "collection" &&
          Boolean(
            product.collection &&
              targets.some((target) => target.toLowerCase() === product.collection!.toLowerCase()),
          ));
      return (
        startsAt <= now.getTime() &&
        now.getTime() < endsAt &&
        matchesScope
      );
    })
    .sort((left, right) => {
      const priorityOrder = right.priority - left.priority;
      if (priorityOrder) return priorityOrder;
      const leftId = String(left._id ?? "");
      const rightId = String(right._id ?? "");
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });

  if (applicable.length < 2) return applicable;
  const selected = [applicable[0]!];
  if (!selected[0].stackable) return selected;
  for (const candidate of applicable.slice(1)) {
    if (!candidate.stackable) break;
    selected.push(candidate);
  }
  return selected;
}

export function priceWithDiscounts(
  basePrice: number,
  discounts: readonly DiscountCandidate[],
): { price: number; discountAmount: number; discounts: DiscountSnapshot[] } {
  let price = basePrice;
  const snapshots: DiscountSnapshot[] = [];
  for (const discount of discounts) {
    const discountAmount = Math.max(
      0,
      Math.round(discount.type === "percent" ? (price * discount.value) / 100 : discount.value),
    );
    const amount = Math.min(
      price,
      discountAmount,
      discount.maxDiscount ?? Number.MAX_SAFE_INTEGER,
    );
    if (amount === 0) continue;
    snapshots.push({
      discountId: String(discount._id ?? ""),
      name: discount.name,
      type: discount.type,
      value: discount.value,
      amount,
    });
    price -= amount;
  }
  return { price, discountAmount: basePrice - price, discounts: snapshots };
}
