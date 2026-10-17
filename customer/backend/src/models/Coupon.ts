import { Schema, model } from "mongoose";

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: { type: String, required: true, enum: ["percent", "flat"] },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, required: true, min: 0, default: 0 },
    maxDiscount: { type: Number, min: 0 },
    startsAt: { type: Date, default: new Date(0) },
    expiresAt: { type: Date, required: true },
    usageLimit: { type: Number, required: true, min: 1 },
    usedCount: { type: Number, required: true, min: 0, default: 0 },
    perUserLimit: { type: Number, required: true, min: 1, default: 1 },
    userRef: { type: Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

couponSchema.index({ startsAt: 1, expiresAt: 1, isActive: 1 });

export const Coupon = model("Coupon", couponSchema);
