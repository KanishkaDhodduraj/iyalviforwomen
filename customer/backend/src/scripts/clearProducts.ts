import mongoose from "mongoose";

import { connectDatabase } from "../config/db.js";
import { Product } from "../models/Product.js";
import { Wishlist } from "../models/Wishlist.js";
import { validateClearProductsCommand } from "./clearProductsCommand.js";

try {
  validateClearProductsCommand(process.env.NODE_ENV, process.argv.slice(2));
  await connectDatabase();
  const [products, wishlists] = await Promise.all([
    Product.deleteMany({}).exec(),
    Wishlist.updateMany({}, { $set: { products: [] } }).exec(),
  ]);
  console.info(`Deleted ${products.deletedCount} products; cleared ${wishlists.modifiedCount} wishlists`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
