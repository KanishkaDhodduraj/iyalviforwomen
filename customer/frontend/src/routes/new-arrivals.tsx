import { createFileRoute } from "@tanstack/react-router";
import { NewArrivalsPage } from "@/components/iyalvi/new-arrivals-page";

export const Route = createFileRoute("/new-arrivals")({
  head: () => ({
    meta: [
      { title: "New Arrivals — IYALVI" },
      {
        name: "description",
        content: "Discover the latest sarees and kurtis from IYALVI.",
      },
    ],
  }),
  component: NewArrivalsPage,
});
