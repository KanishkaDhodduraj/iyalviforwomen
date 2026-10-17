import type { RequestHandler } from "express";
import { z } from "zod";

import { ContactMessage } from "../models/ContactMessage.js";

export const contactBody = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    subject: z.string().trim().max(150).optional(),
    message: z.string().trim().min(10).max(3000),
  })
  .strict();

export const submitContactMessage: RequestHandler = async (request, response) => {
  const message = contactBody.parse(request.body);
  await ContactMessage.create({ ...message, status: "new" });
  response.status(201).json({ received: true });
};
