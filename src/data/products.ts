import teal from '@/assets/teal-saree.jpg';
import gold from '@/assets/gold-saree.jpg';
import rose from '@/assets/rose-saree.jpg';
import hero from '@/assets/iyalvi-hero.jpg';

export const occasions = ['Wedding', 'Pongal', 'Diwali', 'Navratri', 'Office', 'Sangeet', 'Pooja', 'Casual'] as const;
export type Occasion = typeof occasions[number];
export type Product = {
  id: string; name: string; fabric: string; price: number; occasion: Occasion;
  colors: string[]; craftOrigin: string; sizes: string[]; image: string; unsplashImage: string; craft: string;
};

const weaves = [
  { name: 'Mayil', fabric: 'Pure Kanchipuram Silk', price: 18400, craftOrigin: 'Kanchipuram, Tamil Nadu', craft: 'Kanchipuram' },
  { name: 'Gulabi', fabric: 'Pure Banarasi Silk', price: 14900, craftOrigin: 'Varanasi, Uttar Pradesh', craft: 'Banarasi' },
  { name: 'Tara', fabric: 'Silk Cotton', price: 6800, craftOrigin: 'Chanderi, Madhya Pradesh', craft: 'Chanderi' },
  { name: 'Nila', fabric: 'Handwoven Cotton', price: 4900, craftOrigin: 'Pochampally, Telangana', craft: 'Ikat' },
  { name: 'Meenakshi', fabric: 'Pure Kanchipuram Silk', price: 22800, craftOrigin: 'Kanchipuram, Tamil Nadu', craft: 'Kanchipuram' },
  { name: 'Mehr', fabric: 'Banarasi Organza Silk', price: 12500, craftOrigin: 'Varanasi, Uttar Pradesh', craft: 'Banarasi' },
  { name: 'Malar', fabric: 'Chanderi Silk', price: 8200, craftOrigin: 'Chanderi, Madhya Pradesh', craft: 'Chanderi' },
  { name: 'Kavya', fabric: 'Ikat Silk', price: 9600, craftOrigin: 'Pochampally, Telangana', craft: 'Ikat' },
  { name: 'Ananya', fabric: 'Kora Silk', price: 11900, craftOrigin: 'Kanchipuram, Tamil Nadu', craft: 'Kanchipuram' },
  { name: 'Sitara', fabric: 'Banarasi Tissue Silk', price: 16800, craftOrigin: 'Varanasi, Uttar Pradesh', craft: 'Banarasi' },
];
const colorways = [
  { name: 'Peacock Teal', image: teal }, { name: 'Kumkum Rose', image: rose },
  { name: 'Turmeric Gold', image: gold }, { name: 'Heritage Maroon', image: hero },
];

// Deterministic mock inventory. Original campaign images are bundled locally;
// source references remain available for a future external product-image feed.
export const products: Product[] = weaves.flatMap((weave, w) => colorways.map((color, c) => ({
  ...weave, id: `iy-${String(w * 4 + c + 1).padStart(3, '0')}`,
  name: `${weave.name} ${color.name} Saree`, price: weave.price + c * 400,
  occasion: occasions[(w + c) % occasions.length] ?? 'Casual', colors: [color.name],
  sizes: ['Free size'], image: color.image,
  unsplashImage: `https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=85`,
})));

export const featuredProducts = [products[0], products[5], products[10], products[19]].filter((p): p is Product => Boolean(p));
export const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;
export function filterProducts(query: string, occasion = 'All') {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return products.filter(p => (occasion === 'All' || p.occasion === occasion) && terms.every(term =>
    `${p.name} ${p.fabric} ${p.craftOrigin} ${p.occasion} sarees`.toLowerCase().includes(term)));
}