import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  void _next;
  if (error instanceof ZodError) {
    response.status(400).json({ error: "Invalid request" });
    return;
  }
  const status =
    typeof error === "object" && error !== null && "status" in error &&
    typeof error.status === "number" && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  response.status(status).json({ error: status === 500 ? "Internal server error" : "Request failed" });
};
