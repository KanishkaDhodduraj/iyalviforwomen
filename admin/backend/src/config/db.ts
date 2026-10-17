import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);
mongoose.set("autoIndex", env.NODE_ENV !== "production");
mongoose.set("bufferCommands", false);

type MongooseGlobal = typeof globalThis & {
  __iyalviAdminMongoConnection?: Promise<void>;
};

const globalForMongoose = globalThis as MongooseGlobal;

export function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (
    mongoose.connection.readyState === 2 &&
    globalForMongoose.__iyalviAdminMongoConnection
  ) {
    return globalForMongoose.__iyalviAdminMongoConnection;
  }
  delete globalForMongoose.__iyalviAdminMongoConnection;

  const connection = mongoose.connect(env.DATABASE_URL, {
    autoIndex: env.NODE_ENV !== "production",
    bufferCommands: false,
    serverSelectionTimeoutMS: 5_000,
  }).then(() => undefined).catch((error: unknown) => {
    if (globalForMongoose.__iyalviAdminMongoConnection === connection) {
      delete globalForMongoose.__iyalviAdminMongoConnection;
    }
    throw error;
  });
  globalForMongoose.__iyalviAdminMongoConnection = connection;
  return connection;
}
