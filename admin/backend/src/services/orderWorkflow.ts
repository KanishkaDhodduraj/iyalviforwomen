export type ManagedOrderStatus = "placed" | "packed" | "shipped" | "delivered" | "cancelled";

const nextStatus: Partial<Record<ManagedOrderStatus, ManagedOrderStatus>> = {
  placed: "packed",
  packed: "shipped",
  shipped: "delivered",
};

export function canTransitionOrderStatus(from: ManagedOrderStatus, to: ManagedOrderStatus): boolean {
  return nextStatus[from] === to;
}

export function canCancelOrder(status: ManagedOrderStatus): boolean {
  return status === "placed" || status === "packed";
}
