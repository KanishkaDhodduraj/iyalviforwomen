export type DiscountStatus = "scheduled" | "active" | "expired" | "inactive";

export interface ManagedDiscount {
  _id?: unknown;
  name: string;
  scope: "product" | "category" | "collection" | "sitewide";
  targets: string[];
  type: "percent" | "flat";
  value: number;
  maxDiscount?: number | null;
  startsAt: Date | string;
  endsAt: Date | string;
  isActive: boolean;
  isFlashSale?: boolean;
  priority: number;
  stackable: boolean;
}

export interface DiscountPreviewProduct {
  id: string;
  slug: string;
  category: string;
  tags?: string[];
  price: number;
}

export function discountStatus(discount: Pick<ManagedDiscount, "isActive" | "startsAt" | "endsAt">, now = new Date()): DiscountStatus {
  const startsAt = new Date(discount.startsAt).getTime();
  const endsAt = new Date(discount.endsAt).getTime();
  const timestamp = now.getTime();
  if (timestamp >= endsAt) return "expired";
  if (!discount.isActive) return "inactive";
  if (timestamp < startsAt) return "scheduled";
  return "active";
}

export function serializeDiscount<T extends ManagedDiscount>(discount: T, now = new Date()) {
  const isFlashSale = discount.isFlashSale ?? false;
  return {
    ...discount,
    isFlashSale,
    status: discountStatus(discount, now),
    flashSaleEndsAt: isFlashSale ? new Date(discount.endsAt).toISOString() : null,
  };
}

export function previewDiscounts(
  discounts: readonly ManagedDiscount[],
  product: DiscountPreviewProduct,
  now = new Date(),
) {
  const relevant = discounts.filter((discount) => {
    const matchesScope =
      discount.scope === "sitewide" ||
      (discount.scope === "product" &&
        discount.targets.some((target) => [product.id, product.slug].some((value) => target.toLowerCase() === value.toLowerCase()))) ||
      (discount.scope === "category" &&
        discount.targets.some((target) => target.toLowerCase() === product.category.toLowerCase())) ||
      (discount.scope === "collection" &&
        (product.tags ?? []).some((tag) => discount.targets.some((target) => target.toLowerCase() === tag.toLowerCase())));
    return matchesScope;
  });
  const applicable = relevant
    .filter((discount) => discountStatus(discount, now) === "active")
    .sort((left, right) => {
      const priority = right.priority - left.priority;
      if (priority !== 0) return priority;
      const leftId = String(left._id ?? "");
      const rightId = String(right._id ?? "");
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });
  const selected = applicable.length === 0 ? [] : [applicable[0]!];
  if (selected[0]?.stackable) {
    for (const candidate of applicable.slice(1)) {
      if (!candidate.stackable) break;
      selected.push(candidate);
    }
  }

  let price = product.price;
  const appliedDiscounts = [];
  for (const discount of selected) {
    const before = price;
    const calculated = Math.round(discount.type === "percent" ? (price * discount.value) / 100 : discount.value);
    const amount = Math.min(price, calculated, discount.maxDiscount ?? Number.MAX_SAFE_INTEGER);
    if (amount <= 0) continue;
    price -= Math.max(0, amount);
    appliedDiscounts.push({
      discountId: String(discount._id ?? ""),
      name: discount.name,
      type: discount.type,
      value: discount.value,
      amount: before - price,
      isFlashSale: discount.isFlashSale ?? false,
      flashSaleEndsAt: discount.isFlashSale ? new Date(discount.endsAt).toISOString() : null,
    });
  }

  return {
    basePrice: product.price,
    price,
    discountAmount: product.price - price,
    appliedDiscounts,
    matchingDiscounts: relevant.map((discount) => ({
      ...serializeDiscount(discount, now),
      applicable: discountStatus(discount, now) === "active" && selected.includes(discount),
    })),
  };
}
