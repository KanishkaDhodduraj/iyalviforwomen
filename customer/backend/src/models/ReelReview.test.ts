import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { Reel } from "./Reel.js";
import { Review } from "./Review.js";

describe("shared reel and review schemas", () => {
  it("stores extracted Instagram shortcode and active order", async () => {
    expect(Object.keys(Reel.schema.paths)).toEqual(
      expect.arrayContaining(["title", "shortcode", "instagramUrl", "order", "isActive"]),
    );
    expect(Reel.schema.indexes()).toContainEqual([{ isActive: 1, order: 1 }, {}]);
    const reel = new Reel({
      title: "New reel",
      instagramUrl: "https://www.instagram.com/reel/example/",
      shortcode: "example",
    });
    expect(reel.isActive).toBe(true);
    expect(reel.order).toBe(0);
    expect(Reel.schema.path("title")?.options.maxlength).toBe(120);
    expect(Reel.schema.path("order")?.options.max).toBe(1_000_000);
    const invalidReel = new Reel({
      title: "Invalid URL",
      instagramUrl: "https://example.com/",
      shortcode: "example",
    });
    await expect(invalidReel.validate()).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("supports optional product reviews with pending status, constrained ratings, and text", async () => {
    const review = new Review({
      user: new mongoose.Types.ObjectId(),
      rating: 5,
      text: "Lovely fabric",
    });
    expect(review.product).toBeUndefined();
    expect(review.status).toBe("pending");
    expect(Review.schema.path("rating")?.options.min).toBe(1);
    expect(Review.schema.path("rating")?.options.max).toBe(5);
    expect(Review.schema.path("text")?.options.maxlength).toBe(500);
    await expect(review.validate()).resolves.toBeUndefined();
  });

  it("uses the shared single-field indexes and validates workflow status values", () => {
    expect(Review.schema.path("user")?.options.index).toBe(true);
    expect(Review.schema.path("product")?.options.index).toBe(true);
    expect(Review.schema.path("status")?.enumValues).toEqual(["pending", "approved", "rejected"]);
  });
});
