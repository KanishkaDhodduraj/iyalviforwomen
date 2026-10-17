import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user", required: true },
    isBlocked: { type: Boolean, default: false, required: true, index: true },
    isVerified: { type: Boolean, default: false, required: true },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },
    refreshTokenExpiresAt: { type: Date, select: false },
    addressCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const User = model("User", userSchema);
