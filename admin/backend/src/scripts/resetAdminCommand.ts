import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AdminUser } from "../models/AdminUser.js";
import { resetAdmin } from "./resetAdmin.js";

if (process.env.NODE_ENV === "production") {
  console.error("Admin reset is disabled in production.");
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("Admin reset failed. Set DATABASE_URL.");
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    const result = await resetAdmin(process.env, {
      hashPassword: (password, cost) => bcrypt.hash(password, cost),
      findByEmail: async (email) => Boolean(await AdminUser.exists({ email })),
      updateExisting: async (email, update) => {
        await AdminUser.updateOne(
          { email },
          update,
        ).exec();
      },
      create: async (admin) => {
        await AdminUser.create(admin);
      },
    });
    console.log(result);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`Admin reset failed (${errorType}).`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {
      console.error("Admin reset database cleanup failed.");
      process.exitCode = 1;
    });
  }
}
