import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/iyalvi/signature-pages";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About IYALVI" },
      {
        name: "description",
        content: "Get to know the ideas behind IYALVI's easy, expressive style.",
      },
    ],
  }),
  component: AboutPage,
});
