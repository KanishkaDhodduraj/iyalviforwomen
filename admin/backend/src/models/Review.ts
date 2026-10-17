import { Schema, model } from "mongoose";

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      validate: {
        validator: (value: string) => !/<\/?[a-z][^>]*>/i.test(value),
        message: "Review text must be plain text",
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

export const Review = model("Review", reviewSchema);
