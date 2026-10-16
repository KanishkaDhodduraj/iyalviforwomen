import { Schema, model } from "mongoose";

const otpCodeSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    consumedAt: { type: Date },
  },
  { timestamps: true },
);

otpCodeSchema.index({ phone: 1, createdAt: -1 });

export const OtpCode = model("OtpCode", otpCodeSchema);
