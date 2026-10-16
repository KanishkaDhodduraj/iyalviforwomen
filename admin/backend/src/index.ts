import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { startPromotionExpiryScheduler } from "./services/promotionExpiry.js";

try {
  await connectDatabase();
  startPromotionExpiryScheduler();
  app.listen(env.PORT, () => console.info(`Admin API listening on port ${env.PORT}`));
} catch (error) {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(`Unable to start admin API: database connection failed (${errorType})`);
  process.exitCode = 1;
}
