import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/offers")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
