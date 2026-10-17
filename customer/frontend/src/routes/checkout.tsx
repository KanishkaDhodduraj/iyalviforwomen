import { createFileRoute } from "@tanstack/react-router";
import { CheckoutPage } from "@/components/iyalvi/checkout-page";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — IYALVI" },
      { name: "description", content: "Confirm your details and place your IYALVI order." },
    ],
  }),
  component: CheckoutPage,
});
