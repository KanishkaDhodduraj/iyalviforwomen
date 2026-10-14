import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Locale = 'en' | 'ta' | 'hi';
type BagItem = { id: string; quantity: number };
type PrototypeState = {
  theme: 'day' | 'dusk'; locale: Locale; wishlist: string[]; bag: BagItem[];
  recent: string[]; subscribers: string[];
  setTheme: (theme: 'day' | 'dusk') => void; setLocale: (locale: Locale) => void;
  toggleWish: (id: string) => void; addToBag: (id: string) => void;
  changeQuantity: (id: string, delta: number) => void; rememberSearch: (value: string) => void;
  subscribe: (email: string) => void;
};
export const usePrototype = create<PrototypeState>()(persist((set) => ({
  theme: 'day', locale: 'en', wishlist: [], bag: [], recent: [], subscribers: [],
  setTheme: theme => set({ theme }), setLocale: locale => set({ locale }),
  toggleWish: id => set(s => ({ wishlist: s.wishlist.includes(id) ? s.wishlist.filter(x => x !== id) : [...s.wishlist, id] })),
  addToBag: id => set(s => ({ bag: s.bag.some(x => x.id === id) ? s.bag.map(x => x.id === id ? { ...x, quantity: x.quantity + 1 } : x) : [...s.bag, { id, quantity: 1 }] })),
  changeQuantity: (id, delta) => set(s => ({ bag: s.bag.map(x => x.id === id ? { ...x, quantity: x.quantity + delta } : x).filter(x => x.quantity > 0) })),
  rememberSearch: value => set(s => ({ recent: [value.trim(), ...s.recent.filter(x => x !== value.trim())].filter(Boolean).slice(0, 5) })),
  subscribe: email => set(s => ({ subscribers: [...new Set([...s.subscribers, email.toLowerCase()])] })),
}), { name: 'iyalvi-prototype-v1', storage: createJSONStorage(() => localStorage), skipHydration: true }));