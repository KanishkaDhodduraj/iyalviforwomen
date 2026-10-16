import type { Request } from "express";
import { AuditLog } from "../models/AuditLog.js";

export async function writeAudit(
  request: Request,
  action: string,
  targetType: string,
  targetId?: string,
): Promise<void> {
  await AuditLog.create({
    actor: request.admin?.id ?? null,
    actorEmail: request.admin?.email ?? "system",
    action,
    targetType,
    ...(targetId && { targetId }),
    ip: request.ip ?? "unknown",
  });
}
