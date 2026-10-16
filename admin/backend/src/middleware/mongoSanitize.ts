import type { RequestHandler } from "express";
import mongoSanitize from "express-mongo-sanitize";

const sanitizeRequest = mongoSanitize();

export const mongoSanitizeExpress5: RequestHandler = (request, response, next) => {
  Object.defineProperty(request, "query", {
    configurable: true,
    enumerable: true,
    value: request.query,
    writable: true,
  });
  sanitizeRequest(request, response, next);
};
