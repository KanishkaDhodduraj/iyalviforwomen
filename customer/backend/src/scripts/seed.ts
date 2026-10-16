import mongoose from "mongoose";

import { connectDatabase } from "../config/db.js";
import { Product } from "../models/Product.js";
import { loadFrontendProducts } from "../services/frontendProductData.js";

try {
  await connectDatabase();
  const products = await loadFrontendProducts();
  const operations = products.map((product) => ({
    updateOne: {
      filter: { slug: `${product.id}-${slugify(product.name)}` },
      update: {
        $set: {
          slug: `${product.id}-${slugify(product.name)}`,
          name: product.name,
          category: product.category === "Sarees" ? "saree" : "kurti",
          subCategory: product.subcategory,
          fabric: product.fabric,
          occasion: product.occasion,
          colors: product.colors,
          sizes: product.sizes,
          price: product.price,
          mrp: product.originalPrice ?? product.price,
          images: [product.image],
          isActive: true,
        },
        $setOnInsert: { stock: 10 },
      },
      upsert: true,
    },
  }));
  await Product.bulkWrite(operations);
  console.info(`Seeded ${products.length} products`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown seed error";
  console.error(`Product seed failed: ${message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
