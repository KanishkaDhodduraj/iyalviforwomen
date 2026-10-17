import type { Request, Response } from "express";
import { connectDatabase } from "../src/config/db.js";
import { app } from "../src/app.js";

export default async function handler(request: Request, response: Response): Promise<void> {
  try {
    await connectDatabase();
  } catch {
    response.status(503).json({ error: "Database unavailable" });
    return;
  }
  app(request, response);
}
