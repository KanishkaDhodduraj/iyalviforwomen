export type ManagedOrderStatus = "placed" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled";

const nextStatus: Partial<Record<ManagedOrderStatus, ManagedOrderStatus>> = {
  placed: "packed",
  packed: "shipped",
  shipped: "out_for_delivery",
  out_for_delivery: "delivered",
};

export function canTransitionOrderStatus(from: ManagedOrderStatus, to: ManagedOrderStatus): boolean {
  return nextStatus[from] === to;
}

export function canCancelOrder(status: ManagedOrderStatus): boolean {
  return status === "placed" || status === "packed";
}
