import mongoose from "mongoose";

import { connectDatabase } from "../config/db.js";
import { Address } from "../models/Address.js";
import { Coupon } from "../models/Coupon.js";
import { CouponRedemption } from "../models/CouponRedemption.js";
import { ContactMessage } from "../models/ContactMessage.js";
import { Discount } from "../models/Discount.js";
import { OtpCode } from "../models/OtpCode.js";
import { OtpSendWindow } from "../models/OtpSendWindow.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { Wishlist } from "../models/Wishlist.js";

try {
  await connectDatabase();
  await Promise.all(
    [
      Address,
      ContactMessage,
      Coupon,
      CouponRedemption,
      Discount,
      OtpCode,
      OtpSendWindow,
      Order,
      Product,
      User,
      Wishlist,
    ].map((model) =>
      model.createIndexes(),
    ),
  );
  console.info("Declared MongoDB indexes are ready");
} catch (error) {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(`Unable to create MongoDB indexes (${errorType})`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
