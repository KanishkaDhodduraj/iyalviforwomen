import { describe, expect, it } from "vitest";
import { canCancelOrder, canTransitionOrderStatus } from "./orderWorkflow.js";

describe("order workflow", () => {
  it("allows only forward status transitions", () => {
    expect(canTransitionOrderStatus("placed", "packed")).toBe(true);
    expect(canTransitionOrderStatus("packed", "shipped")).toBe(true);
    expect(canTransitionOrderStatus("shipped", "out_for_delivery")).toBe(true);
    expect(canTransitionOrderStatus("out_for_delivery", "delivered")).toBe(true);
    expect(canTransitionOrderStatus("placed", "shipped")).toBe(false);
    expect(canTransitionOrderStatus("delivered", "cancelled")).toBe(false);
  });

  it("allows cancellation only before shipment", () => {
    expect(canCancelOrder("placed")).toBe(true);
    expect(canCancelOrder("packed")).toBe(true);
    expect(canCancelOrder("shipped")).toBe(false);
    expect(canCancelOrder("delivered")).toBe(false);
    expect(canCancelOrder("cancelled")).toBe(false);
  });
});
