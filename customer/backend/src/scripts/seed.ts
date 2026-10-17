import mongoose from "mongoose";

import { connectDatabase } from "../config/db.js";

try {
  await connectDatabase();
  await mongoose.connection.collection("settings").updateOne(
    { _id: "default" } as never,
    { $setOnInsert: { _id: "default" } } as never,
    { upsert: true },
  );
  console.info("Ensured default Settings singleton");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown seed error";
  console.error(`Settings seed failed: ${message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
