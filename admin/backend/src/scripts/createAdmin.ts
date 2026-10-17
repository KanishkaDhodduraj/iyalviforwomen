import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDatabase } from "../config/db.js";
import "../config/env.js";
import { AuditLog } from "../models/AuditLog.js";
import { AdminUser } from "../models/AdminUser.js";

const inputSchema = z.object({
  ADMIN_EMAIL: z.string().email().max(254),
  ADMIN_PASSWORD: z.string().min(12).max(200),
}).strict();
const input = inputSchema.safeParse({
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
});
if (!input.success) {
  const keys = [...new Set(input.error.issues.map((issue) => issue.path.join(".")))];
  console.error(`Invalid admin bootstrap environment. Check: ${keys.join(", ")}`);
  process.exit(1);
}

try {
  await connectDatabase();
  await AdminUser.createIndexes();
  const email = input.data.ADMIN_EMAIL.toLowerCase();
  if (await AdminUser.exists({})) {
    console.error("An admin account already exists; bootstrap is disabled.");
    process.exitCode = 1;
  } else {
    const admin = await AdminUser.create({
      email,
      passwordHash: await bcrypt.hash(input.data.ADMIN_PASSWORD, 12),
      role: "superadmin",
    });
    await AuditLog.create({
      actor: admin._id,
      actorEmail: admin.email,
      action: "create_initial_admin",
      targetType: "AdminUser",
      targetId: String(admin._id),
      ip: "bootstrap",
    });
    console.info("Initial superadmin created.");
  }
} catch (error) {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(`Admin bootstrap failed (${errorType}). No environment values were displayed.`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {
    console.error("Admin bootstrap database cleanup failed.");
    process.exitCode = 1;
  });
}
