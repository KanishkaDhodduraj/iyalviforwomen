import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/love-notes")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
