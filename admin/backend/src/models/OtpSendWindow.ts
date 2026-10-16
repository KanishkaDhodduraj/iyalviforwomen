import { Schema, model } from "mongoose";

const otpSendWindowSchema = new Schema({
  phone: { type: String, required: true, unique: true },
  windowEndsAt: { type: Date, required: true, index: { expires: 0 } },
  sendCount: { type: Number, required: true, min: 1, max: 3 },
});

export const OtpSendWindow = model("OtpSendWindow", otpSendWindowSchema);
