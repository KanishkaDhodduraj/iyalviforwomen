import { Schema, model } from "mongoose";

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    actorEmail: { type: String, required: true, maxlength: 254 },
    action: { type: String, required: true, maxlength: 100 },
    targetType: { type: String, required: true, maxlength: 80 },
    targetId: { type: String, maxlength: 100 },
    ip: { type: String, required: true, maxlength: 100 },
    createdAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { versionKey: false },
);

export const AuditLog = model("AdminAuditLog", auditLogSchema);
