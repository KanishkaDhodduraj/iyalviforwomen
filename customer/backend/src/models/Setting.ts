import { Schema, model } from "mongoose";

const settingSchema = new Schema(
  {
    _id: { type: String, default: "store-settings" },
    storeName: { type: String, required: true, trim: true, maxlength: 100, default: "Iyalvi" },
    supportEmail: { type: String, required: true, trim: true, maxlength: 254, default: "" },
    supportPhone: { type: String, required: true, trim: true, maxlength: 40, default: "" },
    whatsappNumber: { type: String, required: true, trim: true, maxlength: 40, default: "" },
    freeShippingThreshold: { type: Number, required: true, min: 0, default: 999 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 5 },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, default: "INR" },
  },
  { timestamps: true, versionKey: false },
);

export const Setting = model("Setting", settingSchema);
