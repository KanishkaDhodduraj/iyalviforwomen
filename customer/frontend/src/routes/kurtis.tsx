import { createFileRoute } from "@tanstack/react-router";
import { CollectionPage } from "@/components/iyalvi/collection-page";

export const Route = createFileRoute("/kurtis")({
  head: () => ({
    meta: [
      { title: "Kurtis — IYALVI" },
      {
        name: "description",
        content: "Explore easy-to-wear Kurtis for everyday plans, workdays and celebrations.",
      },
    ],
  }),
  component: () => <CollectionPage category="Kurtis" />,
});
