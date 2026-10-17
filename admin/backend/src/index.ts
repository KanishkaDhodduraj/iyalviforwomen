import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

try {
  await connectDatabase();
  const onListening = () => console.info(`Admin API listening on port ${env.PORT}`);
  if (env.NODE_ENV === "development") {
    app.listen(env.PORT, "127.0.0.1", onListening);
  } else {
    app.listen(env.PORT, onListening);
  }
} catch (error) {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(`Unable to start admin API: database connection failed (${errorType})`);
  process.exitCode = 1;
}
