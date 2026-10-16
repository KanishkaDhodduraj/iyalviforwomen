import type { RequestHandler } from "express";
import { z } from "zod";

const emptySchema = z.object({}).strict();

export const emptyQuery: RequestHandler = (request, _response, next) => {
  try {
    emptySchema.parse(request.query);
    next();
  } catch (error) {
    next(error);
  }
};

export const emptyBody: RequestHandler = (request, _response, next) => {
  try {
    emptySchema.parse(request.body ?? {});
    next();
  } catch (error) {
    next(error);
  }
};
