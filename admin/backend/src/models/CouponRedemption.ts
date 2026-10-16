import { Schema, model } from "mongoose";

const couponRedemptionSchema = new Schema(
  {
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    usedCount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

couponRedemptionSchema.index({ coupon: 1, user: 1 }, { unique: true });

export const CouponRedemption = model("CouponRedemption", couponRedemptionSchema);
