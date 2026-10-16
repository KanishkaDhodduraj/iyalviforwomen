import { createFileRoute } from "@tanstack/react-router";
import { CheckoutPage } from "@/components/iyalvi/checkout-page";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — IYALVI" },
      { name: "description", content: "Confirm your details and complete your IYALVI demo order." },
    ],
  }),
  component: CheckoutPage,
});
