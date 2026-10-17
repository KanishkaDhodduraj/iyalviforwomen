import { Schema, model } from "mongoose";

const adminUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true, maxlength: 100, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["superadmin", "manager", "support"],
      required: true,
      default: "superadmin",
    },
    refreshTokenHash: { type: String, select: false },
    refreshTokenExpiresAt: { type: Date, select: false },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    passwordChangeFailedAttempts: { type: Number, default: 0, select: false },
    passwordChangeLockUntil: { type: Date, select: false },
  },
  { timestamps: true },
);

adminUserSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: "superadmin" } },
);

export const AdminUser = model("AdminUser", adminUserSchema);
