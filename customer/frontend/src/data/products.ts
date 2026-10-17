export type ProductCategory = "Sarees" | "Kurtis";

export type Product = {
  id: string;
  slug: string;
  name: string;
  fabric: string;
  price: number;
  colors: string[];
  craftOrigin: string;
  sizes: string[];
  image: string;
  images?: string[];
  craft: string;
  category: ProductCategory;
  subcategory: string;
  originalPrice?: number;
  offerEndsAt?: string;
  sizeStock?: Record<string, { inStock: boolean; lowStock: number | null }>;
  inStock?: boolean;
  lowStock?: number | null;
};

export const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;
