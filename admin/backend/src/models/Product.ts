import { Schema, model } from "mongoose";

const productImageSchema = new Schema(
  {
    url: { type: String, required: true, maxlength: 2048 },
    key: { type: String, match: /^[a-f\d-]{36}\.webp$/i },
    publicId: { type: String, maxlength: 100 },
    thumbnailUrl: { type: String, maxlength: 2048 },
    thumbnailKey: { type: String, match: /^[a-f\d-]{36}-thumb\.webp$/i },
    alt: { type: String, trim: true, maxlength: 200, default: "" },
    isPrimary: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const productSizeSchema = new Schema(
  {
    size: { type: String, required: true, trim: true, maxlength: 40 },
    stock: { type: Number, required: true, min: 0, max: 1_000_000, default: 0 },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true, maxlength: 160 },
    sku: { type: String, unique: true, sparse: true, uppercase: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: "" },
    category: { type: String, required: true, enum: ["saree", "kurti"], index: true },
    subCategory: { type: String, required: true, trim: true, maxlength: 100 },
    fabric: { type: String, required: true, trim: true, index: true, maxlength: 100 },
    occasion: { type: String, required: true, trim: true, index: true, maxlength: 100 },
    colors: { type: [String], required: true, validate: (values: string[]) => values.length > 0 },
    sizes: {
      type: [productSizeSchema],
      required: true,
      validate: {
        validator: (values: Array<{ size: string }>) =>
          values.length > 0 && new Set(values.map((item) => item.size.toLowerCase())).size === values.length,
        message: "Product sizes must be non-empty and unique",
      },
    },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0, select: false },
    images: {
      type: [productImageSchema],
      required: true,
      default: [],
      validate: {
        validator: (values: Array<{ key?: string; isPrimary: boolean }>) =>
          values.length <= 8 &&
          new Set(values.flatMap((image) => (image.key ? [image.key] : []))).size ===
            values.filter((image) => image.key).length &&
          (values.length === 0 || values.filter((image) => image.isPrimary).length === 1),
        message: "Product images must have a single primary image and no duplicate keys",
      },
    },
    tags: { type: [String], default: [], validate: (values: string[]) => values.length <= 50 },
    stock: { type: Number, required: true, min: 0, default: 0, index: true },
    isActive: { type: Boolean, required: true, default: true, index: true },
    isFeatured: { type: Boolean, required: true, default: false, index: true },
    archived: { type: Boolean, required: true, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true },
);

productSchema.pre("validate", function () {
  if (this.sizes) this.stock = this.sizes.reduce((total, item) => total + item.stock, 0);
});
productSchema.index({ category: 1, isActive: 1, price: 1 });
productSchema.index({ name: "text", description: "text", fabric: "text", occasion: "text", tags: "text" });
productSchema.index({ stock: 1, isActive: 1 });

export const Product = model("Product", productSchema);
