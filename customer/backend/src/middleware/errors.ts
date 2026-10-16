import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, "Not found"));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Invalid request",
      details: error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
    });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    response.status(400).json({ error: "Invalid request" });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    response.status(413).json({ error: "Request body is too large" });
    return;
  }

  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorCode =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "none";
  console.error(`Unhandled request error (${errorName}, code: ${errorCode})`);
  response.status(500).json({ error: "Internal server error" });
};
