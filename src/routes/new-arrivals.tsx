import { createFileRoute } from "@tanstack/react-router";
import { NewArrivalsPage } from "@/components/iyalvi/signature-pages";

export const Route = createFileRoute("/new-arrivals")({
  head: () => ({
    meta: [
      { title: "New Arrivals — IYALVI" },
      {
        name: "description",
        content: "Discover the latest sarees and kurtis with limited-time introductory prices.",
      },
    ],
  }),
  component: NewArrivalsPage,
});
