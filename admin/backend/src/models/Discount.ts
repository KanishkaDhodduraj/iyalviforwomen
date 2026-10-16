import { Schema, model } from "mongoose";

const discountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    scope: { type: String, required: true, enum: ["product", "category", "collection", "sitewide"] },
    targets: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      required: true,
      default: [],
      validate: {
        validator(this: { scope?: string }, targets: string[]) {
          return this.scope === "sitewide" ? targets.length === 0 : targets.length > 0;
        },
        message: "Targets must be empty for sitewide discounts and non-empty otherwise",
      },
    },
    type: { type: String, required: true, enum: ["percent", "flat"] },
    value: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, required: true, default: true },
    isFlashSale: { type: Boolean, required: true, default: false },
    priority: { type: Number, required: true, min: 0, default: 0 },
    stackable: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
  },
  { timestamps: true },
);

discountSchema.pre("validate", function validateDiscount() {
  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "Discount end must be after its start");
  }
  if (this.type === "percent" && this.value > 100) {
    this.invalidate("value", "Percent discount cannot exceed 100");
  }
});

discountSchema.index({ startsAt: 1, endsAt: 1, isActive: 1 });
discountSchema.index({ endsAt: 1, isActive: 1 });
discountSchema.index({ isActive: 1, startsAt: 1, endsAt: 1, priority: -1 });

export const Discount = model("Discount", discountSchema);
