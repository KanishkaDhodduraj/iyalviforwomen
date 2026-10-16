import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);
mongoose.set("autoIndex", env.NODE_ENV !== "production");

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.DATABASE_URL);
}
