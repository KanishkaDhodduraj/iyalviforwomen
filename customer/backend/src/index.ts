import "dotenv/config";
import "./config/loadEnv.js";

const [{ app }, { connectDatabase }, { env }] = await Promise.all([
  import("./app.js"),
  import("./config/db.js"),
  import("./config/env.js"),
]);

try {
  await connectDatabase();
  app.listen(env.PORT, () => {
    console.info(`Backend listening on port ${env.PORT}`);
  });
} catch (error) {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(`Unable to start backend: database connection failed (${errorType})`);
  process.exitCode = 1;
}
