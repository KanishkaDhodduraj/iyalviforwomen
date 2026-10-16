import { backendEnvPath, readEnvFile } from "./envFile.js";

const envFile = readEnvFile(process.env.IYALVI_ENV_FILE || backendEnvPath);
for (const [key, value] of Object.entries(envFile.values)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
