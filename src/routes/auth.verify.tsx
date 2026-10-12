import { createFileRoute } from "@tanstack/react-router";
import VerifyEmail from "@/pages/verify";

export const Route = createFileRoute("/auth/verify")({
  head: () => ({
    meta: [
      { title: "Verify your email — Vision" },
      { name: "description", content: "Enter the 8-digit code we emailed you to finish signing in to Vision." },
    ],
  }),
  component: VerifyEmail,
});
