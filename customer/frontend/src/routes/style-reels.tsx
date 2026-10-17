import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/style-reels")({
  beforeLoad: () => {
    throw redirect({ to: "/trend-talks" });
  },
});
