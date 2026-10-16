import mongoose from "mongoose";
import { createHash } from "node:crypto";

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
          sizes: product.sizes.map((size, index) => ({
            size,
            stock: Math.floor(10 / product.sizes.length) + (index < 10 % product.sizes.length ? 1 : 0),
          })),
          price: product.price,
          mrp: product.originalPrice ?? product.price,
          images: [
            {
              url: product.image,
              key: seedImageKey(product.id),
              publicId: `seed-${product.id}`,
              alt: product.name,
              isPrimary: true,
            },
          ],
          isActive: true,
          archived: false,
          stock: 10,
        },
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

function seedImageKey(id: string): string {
  const hash = createHash("sha256").update(id).digest("hex").slice(0, 32).split("");
  hash[12] = "4";
  hash[16] = ((Number.parseInt(hash[16]!, 16) & 0x3) | 0x8).toString(16);
  const uuid = `${hash.slice(0, 8).join("")}-${hash.slice(8, 12).join("")}-${hash.slice(12, 16).join("")}-${hash.slice(16, 20).join("")}-${hash.slice(20).join("")}`;
  return `${uuid}.webp`;
}
