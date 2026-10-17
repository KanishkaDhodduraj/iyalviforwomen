import { Schema, model } from "mongoose";

const reelSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    shortcode: {
      type: String,
      required: true,
      trim: true,
      match: /^[A-Za-z0-9_-]{1,20}$/,
    },
    instagramUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
      validate: {
        validator: (value: string) => {
          try {
            const url = new URL(value);
            return (
              url.protocol === "https:" &&
              (url.hostname === "instagram.com" || url.hostname === "www.instagram.com") &&
              !url.port &&
              !url.username &&
              !url.password &&
              /^\/(?:reel|p)\/[A-Za-z0-9_-]{1,20}\/?$/i.test(url.pathname)
            );
          } catch {
            return false;
          }
        },
        message: "Instagram URL must link to a reel or post",
      },
    },
    order: { type: Number, required: true, min: 0, max: 1_000_000, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

reelSchema.index({ isActive: 1, order: 1 });

export const Reel = model("Reel", reelSchema);
