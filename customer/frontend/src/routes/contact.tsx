import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/iyalvi/contact-page";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — IYALVI" },
      { name: "description", content: "Get in touch with the IYALVI team." },
    ],
  }),
  component: ContactPage,
});
