import type { RequestHandler } from "express";
import { z, type ZodType } from "zod";

const emptyQuery = z.object({}).strict();
const emptyBody = z.object({}).strict();
const emptyParams = z.object({}).strict();

export function validateRequest(schemas: {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}): RequestHandler {
  return (request, _response, next) => {
    try {
      request.body = (schemas.body ?? emptyBody).parse(request.body ?? {});
      (schemas.query ?? emptyQuery).parse(request.query);
      (schemas.params ?? emptyParams).parse(request.params);
      next();
    } catch (error) {
      next(error);
    }
  };
}
