import type { RequestHandler } from "express";
import { z } from "zod";

import { HttpError } from "../middleware/errors.js";
import { Address } from "../models/Address.js";
import { User } from "../models/User.js";
import { authUserId } from "../services/sessions.js";

const addressFields = {
  name: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: z.string().regex(/^\d{6}$/),
  isDefault: z.boolean().optional().default(false),
};

export const addressBody = z.object(addressFields).strict();
export const addressIdParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

export const listAddresses: RequestHandler = async (request, response) => {
  const addresses = await Address.find({ user: authUserId(request) }).sort({ isDefault: -1, createdAt: -1 }).lean().exec();
  response.json({ addresses });
};

export const createAddress: RequestHandler = async (request, response) => {
  const user = authUserId(request);
  const values = addressBody.parse(request.body);
  const slot = await User.findOneAndUpdate(
    { _id: user, $or: [{ addressCount: { $lt: 10 } }, { addressCount: { $exists: false } }] },
    { $inc: { addressCount: 1 } },
    { new: true },
  ).exec();
  if (!slot) throw new HttpError(400, "A maximum of 10 addresses is allowed");
  let address;
  try {
    address = await Address.create({ ...values, user });
  } catch (error) {
    await User.updateOne({ _id: user, addressCount: { $gt: 0 } }, { $inc: { addressCount: -1 } }).exec();
    throw error;
  }
  response.status(201).json({ address });
};

export const getAddress: RequestHandler = async (request, response) => {
  const { id } = addressIdParams.parse(request.params);
  const address = await Address.findOne({ _id: id, user: authUserId(request) }).lean().exec();
  if (!address) throw new HttpError(404, "Address not found");
  response.json({ address });
};

export const updateAddress: RequestHandler = async (request, response) => {
  const { id } = addressIdParams.parse(request.params);
  const values = addressBody.partial().parse(request.body);
  if (Object.keys(values).length === 0) throw new HttpError(400, "At least one address field is required");
  const address = await Address.findOneAndUpdate(
    { _id: id, user: authUserId(request) },
    { $set: values },
    { new: true, runValidators: true },
  ).exec();
  if (!address) throw new HttpError(404, "Address not found");
  response.json({ address });
};

export const deleteAddress: RequestHandler = async (request, response) => {
  const { id } = addressIdParams.parse(request.params);
  const address = await Address.findOneAndDelete({ _id: id, user: authUserId(request) }).exec();
  if (!address) throw new HttpError(404, "Address not found");
  await User.updateOne({ _id: address.user, addressCount: { $gt: 0 } }, { $inc: { addressCount: -1 } }).exec();
  response.status(204).end();
};
