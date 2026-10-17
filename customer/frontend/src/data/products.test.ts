import { describe, expect, it, beforeEach } from "vitest";
import { formatPrice } from "./products";
import { usePrototype } from "./store";

describe("Customer product formatting", () => {
  it("formats prices using Indian grouping", () => {
    expect(formatPrice(1234567)).toBe("₹12,34,567");
  });
});
describe("Local prototype interactions", () => {
  beforeEach(() =>
    usePrototype.setState({
      bag: [],
      wishlist: [],
      recent: [],
      recentlyViewed: [],
      subscribers: [],
      customer: null,
      addresses: [],
      orders: [],
    }),
  );
  it("adds repeated items and removes zero-quantity items", () => {
    usePrototype.getState().addToBag("iy-001");
    usePrototype.getState().addToBag("iy-001");
    expect(usePrototype.getState().bag).toEqual([{ id: "iy-001", quantity: 2 }]);
    usePrototype.getState().changeQuantity("iy-001", -2);
    expect(usePrototype.getState().bag).toEqual([]);
  });
  it("saves and unsaves wishlist items", () => {
    usePrototype.getState().toggleWish("iy-001");
    expect(usePrototype.getState().wishlist).toEqual(["iy-001"]);
    usePrototype.getState().toggleWish("iy-001");
    expect(usePrototype.getState().wishlist).toEqual([]);
  });
  it("removes a cart item directly", () => {
    usePrototype.getState().addToBag("iy-001");
    usePrototype.getState().removeFromBag("iy-001");
    expect(usePrototype.getState().bag).toEqual([]);
  });
  it("stores front-end demo account, addresses and orders", () => {
    const address = {
      id: "address-1",
      name: "A User",
      mobile: "9876543210",
      address: "1 Main Street",
      pincode: "600001",
    };
    usePrototype
      .getState()
      .signInDemo({ name: "A User", email: "a@example.com", mobile: address.mobile });
    usePrototype.getState().saveAddress(address);
    usePrototype.getState().addDemoOrder({
      id: "IY-0000001",
      date: "16/10/2026",
      total: 2490,
      itemCount: 1,
      paymentMethod: "UPI",
      address,
    });
    expect(usePrototype.getState().customer?.name).toBe("A User");
    expect(usePrototype.getState().addresses).toEqual([address]);
    expect(usePrototype.getState().orders[0]?.total).toBe(2490);
    usePrototype.getState().updateProfile({
      name: "Updated User",
      email: "updated@example.com",
      mobile: address.mobile,
    });
    expect(usePrototype.getState().customer?.name).toBe("Updated User");
  });
  it("keeps at most five unique recent searches", () => {
    ["silk", "teal", "gold", "rose", "Diwali", "Pongal", "silk"].forEach((s) =>
      usePrototype.getState().rememberSearch(s),
    );
    expect(usePrototype.getState().recent).toEqual(["silk", "Pongal", "Diwali", "rose", "gold"]);
  });
});
