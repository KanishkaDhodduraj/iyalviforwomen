import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Locale = "en" | "ta" | "hi";
type BagItem = { id: string; quantity: number };
export type Customer = { name: string; email: string; mobile: string };
export type CustomerAddress = {
  id: string;
  name: string;
  mobile: string;
  address: string;
  pincode: string;
};
export type DemoOrder = {
  id: string;
  date: string;
  total: number;
  itemCount: number;
  paymentMethod: string;
  address: CustomerAddress;
  status?: "Confirmed" | "Packed" | "In transit" | "Delivered";
};
type PrototypeState = {
  theme: "day" | "dusk";
  locale: Locale;
  wishlist: string[];
  bag: BagItem[];
  recent: string[];
  recentlyViewed: string[];
  subscribers: string[];
  customer: Customer | null;
  addresses: CustomerAddress[];
  orders: DemoOrder[];
  setTheme: (theme: "day" | "dusk") => void;
  setLocale: (locale: Locale) => void;
  toggleWish: (id: string) => void;
  addToBag: (id: string) => void;
  changeQuantity: (id: string, delta: number) => void;
  removeFromBag: (id: string) => void;
  clearBag: () => void;
  signInDemo: (customer: Customer) => void;
  updateProfile: (customer: Customer) => void;
  signOutDemo: () => void;
  saveAddress: (address: CustomerAddress) => void;
  addDemoOrder: (order: DemoOrder) => void;
  rememberSearch: (value: string) => void;
  rememberProduct: (id: string) => void;
  subscribe: (email: string) => void;
};
export const usePrototype = create<PrototypeState>()(
  persist(
    (set) => ({
      theme: "day",
      locale: "en",
      wishlist: [],
      bag: [],
      recent: [],
      recentlyViewed: [],
      subscribers: [],
      customer: null,
      addresses: [],
      orders: [],
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      toggleWish: (id) =>
        set((s) => ({
          wishlist: s.wishlist.includes(id)
            ? s.wishlist.filter((x) => x !== id)
            : [...s.wishlist, id],
        })),
      addToBag: (id) =>
        set((s) => ({
          bag: s.bag.some((x) => x.id === id)
            ? s.bag.map((x) => (x.id === id ? { ...x, quantity: x.quantity + 1 } : x))
            : [...s.bag, { id, quantity: 1 }],
        })),
      changeQuantity: (id, delta) =>
        set((s) => ({
          bag: s.bag
            .map((x) => (x.id === id ? { ...x, quantity: x.quantity + delta } : x))
            .filter((x) => x.quantity > 0),
        })),
      removeFromBag: (id) => set((s) => ({ bag: s.bag.filter((x) => x.id !== id) })),
      clearBag: () => set({ bag: [] }),
      signInDemo: (customer) => set({ customer }),
      updateProfile: (customer) => set({ customer }),
      signOutDemo: () => set({ customer: null }),
      saveAddress: (address) =>
        set((s) => ({ addresses: [address, ...s.addresses.filter((x) => x.id !== address.id)] })),
      addDemoOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
      rememberSearch: (value) =>
        set((s) => ({
          recent: [value.trim(), ...s.recent.filter((x) => x !== value.trim())]
            .filter(Boolean)
            .slice(0, 5),
        })),
      rememberProduct: (id) =>
        set((s) => ({
          recentlyViewed: [id, ...s.recentlyViewed.filter((value) => value !== id)].slice(0, 8),
        })),
      subscribe: (email) =>
        set((s) => ({ subscribers: [...new Set([...s.subscribers, email.toLowerCase()])] })),
    }),
    {
      name: "iyalvi-prototype-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
