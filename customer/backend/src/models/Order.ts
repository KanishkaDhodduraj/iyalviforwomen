import { Schema, model } from "mongoose";

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    qty: { type: Number, required: true, min: 1, max: 10 },
    unitPrice: { type: Number, required: true, min: 0 },
    originalUnitPrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    discounts: {
      type: [
        new Schema(
          {
            discountId: { type: String, required: true },
            name: { type: String, required: true },
            type: { type: String, required: true, enum: ["percent", "flat"] },
            value: { type: Number, required: true, min: 0 },
            amount: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

const addressSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true, match: /^\d{6}$/ },
  },
  { _id: false },
);

const statusHistorySchema = new Schema(
  {
    status: { type: String, enum: ["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"], required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
    at: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const adminNoteSchema = new Schema(
  {
    note: { type: String, required: true, trim: true, maxlength: 2000 },
    addedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], required: true, validate: (items: unknown[]) => items.length > 0 },
    address: { type: addressSnapshotSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    couponCode: { type: String, uppercase: true, trim: true },
    paymentMethod: {
      type: String,
      enum: ["COD", "UPI", "CARD", "NETBANKING"],
      required: true,
      default: "COD",
    },
    demo: { type: Boolean, required: true, default: false },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      required: true,
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"],
      required: true,
      default: "placed",
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    adminNotes: { type: [adminNoteSchema], default: [], select: false },
    trackingNumber: { type: String, trim: true, maxlength: 120 },
    courier: { type: String, trim: true, maxlength: 120 },
    refundStatus: { type: String, enum: ["none", "pending", "refunded", "failed"], default: "none", required: true },
    refundAmount: { type: Number, min: 0, default: 0, required: true },
    refundReason: { type: String, trim: true, maxlength: 1000 },
    refundedAt: { type: Date },
    refundedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    idempotencyKey: { type: String, select: false },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ trackingNumber: 1 }, { sparse: true });
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

export const Order = model("Order", orderSchema);
