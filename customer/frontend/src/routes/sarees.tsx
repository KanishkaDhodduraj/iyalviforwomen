import { createFileRoute } from "@tanstack/react-router";
import { CollectionPage } from "@/components/iyalvi/collection-page";

export const Route = createFileRoute("/sarees")({
  head: () => ({
    meta: [
      { title: "Sarees — IYALVI" },
      {
        name: "description",
        content:
          "Explore easy-to-wear Sarees for everyday plans, celebrations and everything in between.",
      },
    ],
  }),
  component: () => <CollectionPage category="Sarees" />,
});
