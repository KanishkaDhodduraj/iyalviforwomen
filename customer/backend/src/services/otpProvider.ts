import { env } from "../config/env.js";
import { HttpError } from "../middleware/errors.js";

export interface OtpProvider {
  send(phone: string, code: string): Promise<void>;
}

class DevelopmentConsoleOtpProvider implements OtpProvider {
  async send(phone: string, code: string): Promise<void> {
    console.info(`Development OTP for ${phone}: ${code}`);
  }
}

export function getOtpProvider(): OtpProvider {
  if (env.NODE_ENV === "development") return new DevelopmentConsoleOtpProvider();
  throw new HttpError(503, "Phone verification is temporarily unavailable");
}
