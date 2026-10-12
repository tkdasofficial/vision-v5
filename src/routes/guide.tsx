import { createFileRoute } from "@tanstack/react-router";
import GuidePage from "@/pages/guide";

export const Route = createFileRoute("/guide")({
  head: () => ({ meta: [
    { title: "App Usage Guide — Vision" },
    { name: "description", content: "Learn Vision's navigation gestures and key features: drawer, Projects, Library, Plugins and Settings." },
    { property: "og:title", content: "App Usage Guide — Vision" },
    { property: "og:description", content: "Learn Vision's navigation gestures and key features." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GuidePage,
});
