import { createFileRoute } from "@tanstack/react-router";
import { TrendTalksPage } from "@/components/iyalvi/community-pages";

export const Route = createFileRoute("/trend-talks")({
  head: () => ({
    meta: [
      { title: "Trend Talks — IYALVI" },
      { name: "description", content: "Watch style inspiration shared by IYALVI." },
    ],
  }),
  component: TrendTalksPage,
});
