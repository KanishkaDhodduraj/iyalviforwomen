import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { env } from "./config/env.js";
import { app } from "./app.js";
import { Product } from "./models/Product.js";
import { Discount } from "./models/Discount.js";
import { Order } from "./models/Order.js";
import { User } from "./models/User.js";
import { ContactMessage } from "./models/ContactMessage.js";
import { Setting } from "./models/Setting.js";
import { Reel } from "./models/Reel.js";

async function getCsrfCredentials() {
  const response = await request(app).get("/api/auth/csrf");
  return {
    token: response.body.csrfToken as string,
    cookies: response.headers["set-cookie"] as string[],
  };
}

describe("API security boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns only service and database status from health", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:8080");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "disconnected" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:8080",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("exposes only payment methods enabled by the server demo setting", async () => {
    const response = await request(app).get("/api/payment-options");
    expect(response.status).toBe(200);
    expect(response.body.methods).toEqual(["COD"]);
  });

  it("rejects unknown query fields and disallowed browser origins", async () => {
    const unknownQuery = await request(app).get("/api/health?unexpected=value");
    expect(unknownQuery.status).toBe(400);

    const disallowedOrigin = await request(app)
      .get("/api/health")
      .set("Origin", "https://attacker.example");
    expect(disallowedOrigin.status).toBe(403);
    expect(disallowedOrigin.body).toEqual({ error: "Origin not allowed" });
  });

  it("serves a product catalog to guests with strict query validation and a capped page size", async () => {
    const product = {
      _id: new mongoose.Types.ObjectId(),
      slug: "test-saree",
      name: "Test saree",
      category: "saree",
      isNewArrival: true,
      price: 1000,
      mrp: 1200,
      stock: 7,
      costPrice: 125,
      sizes: [{ size: "Free Size", stock: 7 }],
      images: [
        {
          url: "/uploads/saree.webp",
          key: "11111111-1111-4111-8111-111111111111.webp",
          publicId: "private-upload-id",
          alt: "Saree",
          isPrimary: true,
        },
      ],
    };
    const findProducts = vi.spyOn(Product, "find").mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => ({ exec: async () => [product] }),
          }),
        }),
      }),
    } as never);
    vi.spyOn(Product, "countDocuments").mockReturnValue({
      exec: async () => 1,
    } as never);
    const flashSaleEndsAt = new Date(Date.now() + 60_000);
    const discounts = [
      {
        _id: new mongoose.Types.ObjectId(),
        name: "Catalog offer",
        scope: "sitewide",
        targets: [],
        type: "percent",
        value: 10,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: flashSaleEndsAt,
        isFlashSale: true,
        priority: 1,
        stackable: false,
      },
    ];
    const discountQuery = {
      sort: () => discountQuery,
      lean: () => discountQuery,
      exec: async () => discounts,
    };
    vi.spyOn(Discount, "find").mockReturnValue(discountQuery as never);

    const response = await request(app).get("/api/products?limit=1");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      products: [{ slug: "test-saree" }],
      page: 1,
      limit: 1,
      total: 1,
    });
    expect(findProducts).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, archived: { $ne: true } }),
    );
    expect(response.body.products[0]).not.toHaveProperty("costPrice");
    expect(response.body.products[0]).not.toHaveProperty("stock");
    expect(response.body.products[0]).toMatchObject({ inStock: true, lowStock: null });
    expect(response.body.products[0].images[0]).toEqual({
      url: "/uploads/saree.webp",
      alt: "Saree",
      isPrimary: true,
    });
    expect(response.body.products[0].images[0]).not.toHaveProperty("key");
    expect(response.body.products[0].sizes).toEqual(["Free Size"]);
    expect(response.body.products[0]).toMatchObject({ price: 1080, originalPrice: 1200 });
    expect(response.body.products[0].offerEndsAt).toBe(flashSaleEndsAt.toISOString());
    expect(response.body.products[0]).not.toHaveProperty("archived");
    expect(response.body.products[0]).not.toHaveProperty("createdBy");

    const newArrivals = await request(app).get("/api/products?isNewArrival=true&sort=newest");
    expect(newArrivals.status).toBe(200);
    expect(findProducts).toHaveBeenCalledWith(
      expect.objectContaining({ isNewArrival: true, isActive: true }),
    );
    expect(newArrivals.body.products[0].isNewArrival).toBe(true);

    const tooMany = await request(app).get("/api/products?limit=51");
    expect(tooMany.status).toBe(400);
    const unknown = await request(app).get("/api/products?unexpected=value");
    expect(unknown.status).toBe(400);
  });

  it("serves product details to guests and validates the slug", async () => {
    const product = {
      _id: new mongoose.Types.ObjectId(),
      slug: "test-saree",
      name: "Test saree",
      costPrice: 125,
      sizes: [{ size: "Free Size", stock: 7 }],
      images: [
        {
          url: "/uploads/saree.webp",
          key: "11111111-1111-4111-8111-111111111111.webp",
          publicId: "private-upload-id",
          alt: "Saree",
          isPrimary: true,
        },
      ],
    };
    const findProduct = vi.spyOn(Product, "findOne").mockReturnValue({
      lean: () => ({ exec: async () => product }),
    } as never);

    const response = await request(app).get("/api/products/test-saree");
    expect(response.status).toBe(200);
    expect(response.body.product.slug).toBe("test-saree");
    expect(response.body.product).not.toHaveProperty("costPrice");
    expect(response.body.product.images[0]).not.toHaveProperty("publicId");
    expect(findProduct).toHaveBeenCalledWith(
      { slug: "test-saree", isActive: true, archived: { $ne: true } },
    );

    const invalid = await request(app).get(`/api/products/${"a".repeat(201)}`);
    expect(invalid.status).toBe(400);
  });

  it("returns server-calculated cart pricing to guests and refuses guest coupons", async () => {
    const productId = new mongoose.Types.ObjectId();
    const discountQuery = {
      sort: () => discountQuery,
      lean: () => discountQuery,
      session: () => discountQuery,
      exec: async () => [],
    };
    vi.spyOn(Discount, "find").mockReturnValue(discountQuery as never);
    vi.spyOn(Setting, "findById").mockReturnValue({
      select: () => ({
        lean: () => ({ exec: async () => null }),
      }),
    } as never);
    vi.spyOn(Product, "find").mockReturnValue({
      exec: async () => [
        {
          _id: productId,
          name: "Test saree",
          sizes: ["S"],
          colors: ["Black"],
          stock: 3,
          price: 500,
        },
      ],
    } as never);
    const csrf = await getCsrfCredentials();
    const cart = {
      items: [
        { productId: productId.toString(), size: "S", color: "Black", qty: 1 },
      ],
    };

    const priced = await request(app)
      .post("/api/cart/price")
      .set("Cookie", csrf.cookies)
      .set("x-csrf-token", csrf.token)
      .send(cart);
    expect(priced.status).toBe(200);
    expect(priced.body).toMatchObject({
      subtotal: 500,
      discount: 0,
      shipping: 99,
      total: 599,
    });

    const invalidCart = await request(app)
      .post("/api/cart/price")
      .set("Cookie", csrf.cookies)
      .set("x-csrf-token", csrf.token)
      .send({ ...cart, clientPrice: 1 });
    expect(invalidCart.status).toBe(400);

    const guestCoupon = await request(app)
      .post("/api/cart/price")
      .set("Cookie", csrf.cookies)
      .set("x-csrf-token", csrf.token)
      .send({ ...cart, couponCode: "GUEST10" });
    expect(guestCoupon.status).toBe(401);
  });

  it("keeps wishlist and address reads protected", async () => {
    expect((await request(app).get("/api/wishlist")).status).toBe(401);
    expect((await request(app).get("/api/addresses")).status).toBe(401);

    const csrf = await getCsrfCredentials();
    for (const path of ["/api/coupons/validate"]) {
      const response = await request(app)
        .post(path)
        .set("Cookie", csrf.cookies)
        .set("x-csrf-token", csrf.token)
        .send({});
      expect(response.status).toBe(401);
    }
  });

  it("does not expose the removed spin-wheel endpoint", async () => {
    const csrf = await getCsrfCredentials();
    const response = await request(app)
      .post("/api/offers/spin")
      .set("Cookie", csrf.cookies)
      .set("x-csrf-token", csrf.token)
      .send({});
    expect(response.status).toBe(404);
  });

  it("keeps admin-only order notes hidden and defaults contact workflow flags", () => {
    expect(Order.schema.path("adminNotes")?.options.select).toBe(false);
    const message = new ContactMessage({
      name: "Customer",
      email: "customer@example.com",
      message: "A question",
    });
    expect(message.status).toBe("new");
    expect(message.adminNote).toBe("");
    expect(message.readAt).toBeUndefined();
    expect(message.isRead).toBe(false);
    expect(message.isResolved).toBe(false);
    expect(ContactMessage.schema.path("isRead")?.options.index).toBe(true);
    expect(ContactMessage.schema.path("isResolved")?.options.index).toBe(true);
    expect(new User({ name: "Customer", email: "customer@example.com" }).isBlocked).toBe(false);
  });

  it("rejects a blocked user's valid password with a generic account-unavailable response", async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      passwordHash: "hashed-password",
      failedLoginAttempts: 0,
      isBlocked: true,
    };
    vi.spyOn(User, "findOne").mockReturnValue({
      select: () => ({ exec: async () => user }),
    } as never);
    vi.spyOn(bcrypt, "compare").mockResolvedValue(true);
    const updateUser = vi.spyOn(User, "updateOne");
    const csrf = await getCsrfCredentials();

    const response = await request(app)
      .post("/api/auth/login")
      .set("Cookie", csrf.cookies)
      .set("x-csrf-token", csrf.token)
      .send({ email: "blocked@example.com", password: "correct-password" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Account unavailable" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does not restore an existing session for a blocked user", async () => {
    const id = new mongoose.Types.ObjectId();
    const accessToken = jwt.sign(
      { sub: id.toString(), role: "user", type: "access" },
      env.JWT_SECRET,
      { expiresIn: "15m", issuer: "iyalvi-api", audience: "iyalvi-client" },
    );
    vi.spyOn(User, "findById").mockReturnValue({
      select: () => ({
        lean: () => ({ exec: async () => ({ _id: id, role: "user", isBlocked: true }) }),
      }),
    } as never);

    const response = await request(app).get("/api/wishlist").set("Cookie", `accessToken=${accessToken}`);

    expect(response.status).toBe(401);
  });

  it("does not count anonymous session restoration checks against the login-attempt limit", async () => {
    const responses = await Promise.all(
      Array.from({ length: 11 }, () => request(app).get("/api/auth/me")),
    );
    expect(responses.every((response) => response.status === 401)).toBe(true);
  });

  it("rejects NoSQL operator keys in query and body data", async () => {
    const queryInjection = await request(app).get("/api/health?%24where=value");
    expect(queryInjection.status).toBe(400);

    const bodyInjection = await request(app).post("/api/does-not-exist").send({
      email: "person@example.com",
      $where: "this.passwordHash",
    });
    expect(bodyInjection.status).toBe(400);
    expect(bodyInjection.body).toEqual({ error: "Invalid request" });
  });

  it("returns a generic not-found response without a stack trace", async () => {
    const response = await request(app).get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });

  it("keeps Google sign-in disabled without a Google authentication dependency", async () => {
    const csrf = await request(app).get("/api/auth/csrf");
    const token = csrf.body.csrfToken as string;
    const cookies = csrf.headers["set-cookie"] as string[];
    const response = await request(app)
      .post("/api/auth/google")
      .set("Cookie", cookies)
      .set("x-csrf-token", token)
      .send({ idToken: "unused-token" });

    expect(response.status).toBe(501);
    expect(response.body).toEqual({ error: "Google sign-in is unavailable" });
  });

  it("validates and stores contact messages behind the CSRF and rate-limit boundary", async () => {
    const csrf = await request(app).get("/api/auth/csrf");
    const token = csrf.body.csrfToken as string;
    const cookies = csrf.headers["set-cookie"] as string[];
    const create = vi
      .spyOn(ContactMessage, "create")
      .mockResolvedValue({} as never);
    const response = await request(app)
      .post("/api/contact")
      .set("Cookie", cookies)
      .set("x-csrf-token", token)
      .send({
        name: "Test customer",
        email: "customer@example.com",
        message: "Please help with an order.",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ received: true });
    expect(create).toHaveBeenCalledWith({
      name: "Test customer",
      email: "customer@example.com",
      message: "Please help with an order.",
      status: "new",
    });

    const invalid = await request(app)
      .post("/api/contact")
      .set("Cookie", cookies)
      .set("x-csrf-token", token)
      .send({
        name: "Test customer",
        email: "customer@example.com",
        message: "Short",
        unexpected: true,
      });
    expect(invalid.status).toBe(400);
  });

  it("lists only active reels in their configured order", async () => {
    const reels = [
      {
        title: "Summer",
        shortcode: "summer_1",
        instagramUrl: "https://www.instagram.com/reel/summer_1/",
        isActive: true,
      },
    ];
    const query = {
      sort: vi.fn(() => query),
      lean: vi.fn(() => query),
      exec: vi.fn(async () => reels),
    };
    const find = vi.spyOn(Reel, "find").mockReturnValue(query as never);

    const response = await request(app).get("/api/reels");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reels });
    expect(find).toHaveBeenCalledWith({ isActive: true });
    expect(query.sort).toHaveBeenCalledWith({ order: 1, createdAt: -1 });
  });

  it("does not expose the removed public reviews API", async () => {
    expect((await request(app).get("/api/reviews")).status).toBe(404);
  });

  it("returns 404 when an authenticated user requests another user's order", async () => {
    const userId = new mongoose.Types.ObjectId();
    vi.spyOn(User, "findById").mockReturnValue({
      select: () => ({
        lean: () => ({ exec: async () => ({ _id: userId, role: "user" }) }),
      }),
    } as never);
    vi.spyOn(Order, "findOne").mockReturnValue({
      exec: async () => null,
    } as never);
    const token = jwt.sign(
      { sub: userId.toString(), role: "user", type: "access" },
      env.JWT_SECRET,
      { issuer: "iyalvi-api", audience: "iyalvi-client", expiresIn: "15m" },
    );

    const response = await request(app)
      .get(`/api/orders/${new mongoose.Types.ObjectId().toString()}`)
      .set("Cookie", `accessToken=${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Order not found" });
  });
});
