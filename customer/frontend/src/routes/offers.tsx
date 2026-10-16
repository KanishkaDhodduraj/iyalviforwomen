import { createFileRoute } from "@tanstack/react-router";
import { OffersPage } from "@/components/iyalvi/signature-pages";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Offers — IYALVI" },
      { name: "description", content: "Spin for a style coupon and browse current IYALVI offers." },
    ],
  }),
  component: OffersPage,
});
