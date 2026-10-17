import { z } from "zod";

const inputSchema = z.object({
  NODE_ENV: z.string().optional(),
  ADMIN_EMAIL: z.string().trim().email().max(254),
  ADMIN_PASSWORD: z.string().min(8),
}).passthrough();

export interface ResetAdminStore {
  hashPassword(password: string, cost: number): Promise<string>;
  findByEmail(email: string): Promise<boolean>;
  updateExisting(
    email: string,
    update: {
      $set: { role: "superadmin"; passwordHash: string; failedLoginAttempts: 0 };
      $unset: { lockUntil: 1; refreshTokenHash: 1; refreshTokenExpiresAt: 1 };
    },
  ): Promise<void>;
  create(admin: {
    email: string;
    passwordHash: string;
    role: "superadmin";
    failedLoginAttempts: 0;
  }): Promise<void>;
}

export async function resetAdmin(
  environment: NodeJS.ProcessEnv,
  store: ResetAdminStore,
): Promise<"Admin created" | "Admin password reset"> {
  if (environment.NODE_ENV === "production") {
    throw new Error("Admin reset is disabled in production.");
  }

  const parsed = inputSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error("Invalid reset environment. Set a valid ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters.");
  }

  const email = parsed.data.ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await store.hashPassword(parsed.data.ADMIN_PASSWORD, 12);

  if (await store.findByEmail(email)) {
    await store.updateExisting(email, {
      $set: { role: "superadmin", passwordHash, failedLoginAttempts: 0 },
      $unset: { lockUntil: 1, refreshTokenHash: 1, refreshTokenExpiresAt: 1 },
    });
    return "Admin password reset";
  }

  await store.create({ email, passwordHash, role: "superadmin", failedLoginAttempts: 0 });
  return "Admin created";
}
