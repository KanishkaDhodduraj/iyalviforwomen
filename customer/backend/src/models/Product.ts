import { Schema, model } from "mongoose";

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, enum: ["saree", "kurti"], index: true },
    subCategory: { type: String, required: true, trim: true },
    fabric: { type: String, required: true, trim: true, index: true },
    occasion: { type: String, required: true, trim: true, index: true },
    colors: { type: [String], required: true, validate: (values: string[]) => values.length > 0 },
    sizes: { type: [String], required: true, validate: (values: string[]) => values.length > 0 },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    images: { type: [String], required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

productSchema.index({ category: 1, isActive: 1, price: 1 });
productSchema.index({ name: "text", fabric: "text", occasion: "text" });

export const Product = model("Product", productSchema);
