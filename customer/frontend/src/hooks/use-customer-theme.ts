import { useEffect } from "react";
import { usePrototype } from "@/data/store";

export function useCustomerTheme() {
  const theme = usePrototype((state) => state.theme);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dusk");
  }, [theme]);
}
