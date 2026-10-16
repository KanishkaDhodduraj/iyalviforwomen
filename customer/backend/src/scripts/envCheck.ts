import { backendEnvPath, readEnvFile } from "../config/envFile.js";

const loaded = readEnvFile(process.env.IYALVI_ENV_FILE || backendEnvPath);
const envValues = { ...loaded.values };
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) envValues[key] = value;
}

console.log(`Env file path: ${loaded.path}`);
console.log(`Env file exists: ${loaded.exists ? "yes" : "no"}`);

const port = envValues.PORT;
const databaseUrl =
  nonEmpty(envValues.DATABASE_URL) ?? nonEmpty(envValues.MONGODB_URI);
const clientUrl = envValues.CLIENT_URL;
const jwtSecret = envValues.JWT_SECRET;
const nodeEnv = envValues.NODE_ENV;
const trustProxy = envValues.TRUST_PROXY;

report("PORT", port, (value) =>
  /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65_535
    ? undefined
    : "must be a whole number from 1 to 65535",
);
report("DATABASE_URL", databaseUrl, (value) =>
  isUrl(value) ? undefined : "must be a valid URL",
);
report("CLIENT_URL", clientUrl, (value) => {
  const normalized = value.replace(/\/$/, "");
  try {
    const url = new URL(normalized);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === normalized
      ? undefined
      : "must start with http:// or https:// and have no trailing slash or path";
  } catch {
    return "must start with http:// or https:// and have no trailing slash or path";
  }
});
report("JWT_SECRET", jwtSecret, (value) =>
  value.length >= 32 ? undefined : "must be at least 32 characters",
);
report("NODE_ENV", nodeEnv, (value) =>
  ["development", "test", "production"].includes(value)
    ? undefined
    : "must be development, test, or production",
);
report("TRUST_PROXY", trustProxy, () => undefined);

function report(
  key: string,
  rawValue: string | undefined,
  validate: (value: string) => string | undefined,
): void {
  if (rawValue === undefined) {
    console.log(`${key}: missing`);
    return;
  }
  const value = rawValue.trim();
  if (!value) {
    console.log(`${key}: empty`);
    return;
  }
  const reason = validate(value);
  console.log(
    `${key}: ${reason ? `invalid format (${reason})` : `ok (length ${value.length})`}`,
  );
}

function nonEmpty(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
