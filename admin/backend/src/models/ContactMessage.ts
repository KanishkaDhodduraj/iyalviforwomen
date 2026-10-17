import { Schema, model } from "mongoose";

const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    subject: { type: String, trim: true, maxlength: 150, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, required: true, enum: ["new", "read", "resolved"], default: "new", index: true },
    adminNote: { type: String, required: true, trim: true, maxlength: 3000, default: "" },
    readAt: { type: Date },
    isRead: { type: Boolean, required: true, default: false, index: true },
    isResolved: { type: Boolean, required: true, default: false, index: true },
    createdAt: { type: Date, required: true, default: Date.now, expires: 60 * 60 * 24 * 180 },
  },
  { versionKey: false },
);

contactMessageSchema.index({ isResolved: 1, createdAt: -1 });

export const ContactMessage = model("ContactMessage", contactMessageSchema);
