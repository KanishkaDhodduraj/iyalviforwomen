import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";
import {
  ApiError,
  api,
  type ApiAddress,
  type ApiOrder,
  type ApiProduct,
  type ApiUser,
} from "@/lib/api";

type BagItem = { id: string; quantity: number; size?: string; color?: string };
const persistedBagSchema = z.array(
  z
    .object({
      id: z.string().min(1),
      quantity: z.number().int().min(1).max(10),
    })
    .strict(),
);
let sessionRevision = 0;
let sessionHydration: { revision: number; promise: Promise<void> } | null = null;
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
  wishlist: string[];
  bag: BagItem[];
  recent: string[];
  recentlyViewed: string[];
  subscribers: string[];
  customer: Customer | null;
  addresses: CustomerAddress[];
  orders: DemoOrder[];
  setTheme: (theme: "day" | "dusk") => void;
  toggleWish: (id: string) => void;
  addToBag: (id: string, size?: string, color?: string) => void;
  changeQuantity: (id: string, delta: number) => void;
  removeFromBag: (id: string) => void;
  updateBagOptions: (id: string, size: string, color: string) => void;
  clearBag: () => void;
  signInDemo: (customer: Customer) => void;
  updateProfile: (customer: Customer) => void;
  signOutDemo: () => void;
  saveAddress: (address: CustomerAddress) => void;
  addDemoOrder: (order: DemoOrder) => void;
  recordOrder: (order: ApiOrder) => void;
  rememberSearch: (value: string) => void;
  rememberProduct: (id: string) => void;
  subscribe: (email: string) => void;
  setCustomer: (customer: Customer | null) => void;
  hydrateSession: () => Promise<void>;
  syncWishlist: () => Promise<void>;
  wishlistError: string;
  accountError: string;
};

function addressFromApi(address: ApiAddress): CustomerAddress {
  return {
    id: address._id,
    name: address.name,
    mobile: address.phone,
    address: [address.line1, address.line2, address.city, address.state].filter(Boolean).join(", "),
    pincode: address.pincode,
  };
}

function orderFromApi(order: ApiOrder): DemoOrder {
  const stages: Record<ApiOrder["orderStatus"], DemoOrder["status"]> = {
    placed: "Confirmed",
    packed: "Packed",
    shipped: "In transit",
    delivered: "Delivered",
    cancelled: "Confirmed",
  };
  return {
    id: order._id,
    date: new Date(order.createdAt).toLocaleDateString("en-IN"),
    total: order.total,
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    paymentMethod: "Cash on Delivery",
    address: { id: "", name: "", mobile: "", address: "", pincode: "" },
    status: stages[order.orderStatus],
  };
}

export const usePrototype = create<PrototypeState>()(
  persist<PrototypeState, [], [], Pick<PrototypeState, "bag">>(
    (set) => ({
      theme: "day",
      wishlist: [],
      bag: [],
      recent: [],
      recentlyViewed: [],
      subscribers: [],
      customer: null,
      addresses: [],
      orders: [],
      setTheme: (theme) => set({ theme }),
      toggleWish: (id) => {
        let removing = false;
        set((s) => {
          removing = s.wishlist.includes(id);
          return {
            wishlist: removing ? s.wishlist.filter((x) => x !== id) : [...s.wishlist, id],
            wishlistError: "",
            accountError: "",
          };
        });
        if (usePrototype.getState().customer) {
          const request = removing
            ? api.delete(`/wishlist/${id}`)
            : api.post(`/wishlist/${id}`, {});
          void request.catch((error: unknown) => {
            set((s) => ({
              wishlist: removing ? [...s.wishlist, id] : s.wishlist.filter((item) => item !== id),
              wishlistError:
                error instanceof Error ? error.message : "Wishlist could not be updated.",
            }));
          });
        }
      },
      addToBag: (id, size, color) =>
        set((s) => ({
          bag: s.bag.some((x) => x.id === id)
            ? s.bag.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      quantity: Math.min(10, x.quantity + 1),
                      ...(size && { size }),
                      ...(color && { color }),
                    }
                  : x,
              )
            : [...s.bag, { id, quantity: 1, ...(size && { size }), ...(color && { color }) }],
        })),
      changeQuantity: (id, delta) =>
        set((s) => ({
          bag: s.bag
            .map((x) => (x.id === id ? { ...x, quantity: Math.min(10, x.quantity + delta) } : x))
            .filter((x) => x.quantity > 0),
        })),
      updateBagOptions: (id, size, color) =>
        set((s) => ({
          bag: s.bag.map((item) => (item.id === id ? { ...item, size, color } : item)),
        })),
      removeFromBag: (id) => set((s) => ({ bag: s.bag.filter((x) => x.id !== id) })),
      clearBag: () => set({ bag: [] }),
      signInDemo: (customer) => set({ customer }),
      updateProfile: (customer) => set({ customer }),
      signOutDemo: () =>
        set({
          customer: null,
          wishlist: [],
          addresses: [],
          orders: [],
          accountError: "",
          wishlistError: "",
        }),
      saveAddress: (address) =>
        set((s) => ({ addresses: [address, ...s.addresses.filter((x) => x.id !== address.id)] })),
      addDemoOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
      recordOrder: (order) => set((s) => ({ orders: [orderFromApi(order), ...s.orders] })),
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
      wishlistError: "",
      setCustomer: (customer) => {
        sessionRevision += 1;
        set(
          customer
            ? { customer }
            : {
                customer: null,
                wishlist: [],
                addresses: [],
                orders: [],
                accountError: "",
                wishlistError: "",
              },
        );
      },
      hydrateSession: () => {
        const revision = sessionRevision;
        if (sessionHydration?.revision === revision) return sessionHydration.promise;

        const promise = (async () => {
          try {
            const { user } = await api.get<{ user: ApiUser }>("/auth/me");
            if (revision !== sessionRevision) return;
            set({ customer: { name: user.name, email: user.email, mobile: user.phone ?? "" } });
            const guestWishlist = usePrototype.getState().wishlist;
            if (guestWishlist.length > 0) {
              await Promise.all(guestWishlist.map((id) => api.post(`/wishlist/${id}`, {})));
            }
            const [wishlistResponse, addressResponse, orderResponse] = await Promise.all([
              api.get<{ products: ApiProduct[] }>("/wishlist"),
              api.get<{ addresses: ApiAddress[] }>("/addresses"),
              api.get<{ orders: ApiOrder[] }>("/orders?limit=50&page=1"),
            ]);
            if (revision !== sessionRevision) return;
            set({
              wishlist: wishlistResponse.products.map((product) => product._id),
              addresses: addressResponse.addresses.map(addressFromApi),
              orders: orderResponse.orders.map(orderFromApi),
              accountError: "",
            });
          } catch (error) {
            if (revision !== sessionRevision) return;
            if (error instanceof ApiError && error.status === 401) {
              set({
                customer: null,
                wishlist: [],
                addresses: [],
                orders: [],
                accountError: "",
                wishlistError: "",
              });
              return;
            }
            set({
              accountError:
                error instanceof Error ? error.message : "Account details could not be loaded.",
            });
            throw error;
          }
        })();
        const trackedPromise = promise.finally(() => {
          if (sessionHydration?.promise === trackedPromise) sessionHydration = null;
        });
        sessionHydration = { revision, promise: trackedPromise };
        return trackedPromise;
      },
      syncWishlist: async () => {
        try {
          const current = usePrototype.getState();
          if (current.customer) {
            await Promise.all(current.wishlist.map((id) => api.post(`/wishlist/${id}`, {})));
          }
          const { products } = await api.get<{ products: ApiProduct[] }>("/wishlist");
          set({ wishlist: products.map((product) => product._id), wishlistError: "" });
        } catch (error) {
          set({
            wishlistError: error instanceof Error ? error.message : "Could not load your wishlist.",
          });
        }
      },
    }),
    {
      name: "iyalvi-prototype-v1",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? undefined : window.localStorage,
      ),
      skipHydration: true,
      partialize: (state) => ({
        bag: state.bag.map(({ id, quantity }) => ({ id, quantity })),
      }),
      migrate: (persistedState) => {
        const persistedBag =
          typeof persistedState === "object" && persistedState !== null && "bag" in persistedState
            ? persistedBagSchema.safeParse(persistedState.bag)
            : null;
        return { bag: persistedBag?.success ? persistedBag.data : [] };
      },
    },
  ),
);
