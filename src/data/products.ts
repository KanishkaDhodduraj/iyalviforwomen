import teal from "@/assets/teal-saree.jpg";
import gold from "@/assets/gold-saree.jpg";
import rose from "@/assets/rose-saree.jpg";
import hero from "@/assets/iyalvi-hero.jpg";

export const occasions = [
  "Wedding",
  "Pongal",
  "Diwali",
  "Navratri",
  "Office",
  "Sangeet",
  "Pooja",
  "Casual",
] as const;
export type Occasion = (typeof occasions)[number];
export type ProductCategory = "Sarees" | "Kurtis";
export type ProductSubcategory =
  "Silk" | "Cotton" | "Designer" | "Party Wear" | "Daily Wear" | "Office Wear" | "Co-ord Sets";
export type Product = {
  id: string;
  name: string;
  fabric: string;
  price: number;
  occasion: Occasion;
  colors: string[];
  craftOrigin: string;
  sizes: string[];
  image: string;
  unsplashImage: string;
  craft: string;
  category: ProductCategory;
  subcategory: ProductSubcategory;
  originalPrice?: number;
  offerEndsAt?: string;
};

const weaves: {
  name: string;
  fabric: string;
  price: number;
  craftOrigin: string;
  craft: string;
  subcategory: ProductSubcategory;
}[] = [
  {
    name: "Mayil",
    fabric: "Pure Kanchipuram Silk",
    price: 18400,
    craftOrigin: "Kanchipuram, Tamil Nadu",
    craft: "Kanchipuram",
    subcategory: "Silk",
  },
  {
    name: "Gulabi",
    fabric: "Pure Banarasi Silk",
    price: 14900,
    craftOrigin: "Varanasi, Uttar Pradesh",
    craft: "Banarasi",
    subcategory: "Party Wear",
  },
  {
    name: "Tara",
    fabric: "Silk Cotton",
    price: 6800,
    craftOrigin: "Chanderi, Madhya Pradesh",
    craft: "Chanderi",
    subcategory: "Cotton",
  },
  {
    name: "Nila",
    fabric: "Handwoven Cotton",
    price: 4900,
    craftOrigin: "Pochampally, Telangana",
    craft: "Ikat",
    subcategory: "Cotton",
  },
  {
    name: "Meenakshi",
    fabric: "Pure Kanchipuram Silk",
    price: 22800,
    craftOrigin: "Kanchipuram, Tamil Nadu",
    craft: "Kanchipuram",
    subcategory: "Designer",
  },
  {
    name: "Mehr",
    fabric: "Banarasi Organza Silk",
    price: 12500,
    craftOrigin: "Varanasi, Uttar Pradesh",
    craft: "Banarasi",
    subcategory: "Party Wear",
  },
  {
    name: "Malar",
    fabric: "Chanderi Silk",
    price: 8200,
    craftOrigin: "Chanderi, Madhya Pradesh",
    craft: "Chanderi",
    subcategory: "Designer",
  },
  {
    name: "Kavya",
    fabric: "Ikat Silk",
    price: 9600,
    craftOrigin: "Pochampally, Telangana",
    craft: "Ikat",
    subcategory: "Silk",
  },
  {
    name: "Ananya",
    fabric: "Kora Silk",
    price: 11900,
    craftOrigin: "Kanchipuram, Tamil Nadu",
    craft: "Kanchipuram",
    subcategory: "Silk",
  },
  {
    name: "Sitara",
    fabric: "Banarasi Tissue Silk",
    price: 16800,
    craftOrigin: "Varanasi, Uttar Pradesh",
    craft: "Banarasi",
    subcategory: "Party Wear",
  },
];
const colorways = [
  { name: "Peacock Teal", image: teal },
  { name: "Kumkum Rose", image: rose },
  { name: "Turmeric Gold", image: gold },
  { name: "Heritage Maroon", image: hero },
];

// Deterministic mock inventory. Original campaign images are bundled locally;
// source references remain available for a future external product-image feed.
export const sareeProducts: Product[] = weaves.flatMap((weave, w) =>
  colorways.map((color, c) => ({
    ...weave,
    id: `iy-${String(w * 4 + c + 1).padStart(3, "0")}`,
    name: `${weave.name} ${color.name} Saree`,
    price: weave.price + c * 400,
    occasion: occasions[(w + c) % occasions.length] ?? "Casual",
    colors: [color.name],
    sizes: ["Free size"],
    image: color.image,
    category: "Sarees",
    subcategory: weave.subcategory,
    unsplashImage: `https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=85`,
  })),
);

const kurtiStyles: {
  name: string;
  fabric: string;
  price: number;
  craftOrigin: string;
  craft: string;
  subcategory: ProductSubcategory;
}[] = [
  {
    name: "Aadhya",
    fabric: "Handloom Cotton",
    price: 2490,
    craftOrigin: "Jaipur, Rajasthan",
    craft: "Block Print",
    subcategory: "Daily Wear",
  },
  {
    name: "Ira",
    fabric: "Linen Cotton",
    price: 3290,
    craftOrigin: "Kochi, Kerala",
    craft: "Handloom",
    subcategory: "Office Wear",
  },
  {
    name: "Saanvi",
    fabric: "Chanderi Silk Blend",
    price: 5490,
    craftOrigin: "Chanderi, Madhya Pradesh",
    craft: "Chanderi",
    subcategory: "Party Wear",
  },
  {
    name: "Vanya",
    fabric: "Printed Cotton",
    price: 4290,
    craftOrigin: "Jaipur, Rajasthan",
    craft: "Block Print",
    subcategory: "Co-ord Sets",
  },
];
const kurtiColorways = [
  { name: "Peacock Teal", image: teal },
  { name: "Kumkum Rose", image: rose },
  { name: "Turmeric Gold", image: gold },
  { name: "Heritage Maroon", image: hero },
];
export const kurtiProducts: Product[] = kurtiStyles.flatMap((style, w) =>
  kurtiColorways.map((color, c) => ({
    ...style,
    id: `ku-${String(w * 4 + c + 1).padStart(3, "0")}`,
    name: `${style.name} ${color.name} Kurti`,
    price: style.price + c * 200,
    occasion: (["Casual", "Office", "Sangeet", "Diwali"] as Occasion[])[w] ?? "Casual",
    colors: [color.name],
    sizes: ["S", "M", "L", "XL"],
    image: color.image,
    category: "Kurtis",
    subcategory: style.subcategory,
    unsplashImage: `https://images.unsplash.com/photo-1583391733956-6c78276477e4?auto=format&fit=crop&w=800&q=85`,
  })),
);

const offerEndDate = "2026-10-31T23:59:59+05:30";
export const newArrivalProducts: Product[] = [
  {
    ...sareeProducts[2]!,
    id: "new-saree-01",
    name: "Mira Rose Silk Saree",
    price: 7425,
    originalPrice: 9900,
    offerEndsAt: offerEndDate,
    colors: ["Kumkum Rose"],
  },
  {
    ...sareeProducts[12]!,
    id: "new-saree-02",
    name: "Veda Teal Designer Saree",
    price: 11200,
    originalPrice: 14000,
    offerEndsAt: offerEndDate,
    colors: ["Peacock Teal"],
  },
  {
    ...sareeProducts[21]!,
    id: "new-saree-03",
    name: "Ira Gold Party Saree",
    price: 9600,
    originalPrice: 12000,
    offerEndsAt: offerEndDate,
    colors: ["Turmeric Gold"],
  },
  {
    ...kurtiProducts[1]!,
    id: "new-kurti-01",
    name: "Ayla Teal Everyday Kurti",
    price: 1992,
    originalPrice: 2490,
    offerEndsAt: offerEndDate,
    colors: ["Peacock Teal"],
  },
  {
    ...kurtiProducts[14]!,
    id: "new-kurti-02",
    name: "Tara Rose Co-ord Set",
    price: 3592,
    originalPrice: 4490,
    offerEndsAt: offerEndDate,
    colors: ["Kumkum Rose"],
  },
];

export const products: Product[] = [...sareeProducts, ...kurtiProducts, ...newArrivalProducts];
export const featuredProducts = [
  sareeProducts[0],
  sareeProducts[5],
  sareeProducts[10],
  sareeProducts[19],
].filter((p): p is Product => Boolean(p));
export const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;
export function filterProducts(query: string, occasion = "All") {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return products.filter(
    (p) =>
      (occasion === "All" || p.occasion === occasion) &&
      terms.every((term) =>
        `${p.name} ${p.fabric} ${p.craftOrigin} ${p.occasion} ${p.category} ${p.subcategory}`
          .toLowerCase()
          .includes(term),
      ),
  );
}
