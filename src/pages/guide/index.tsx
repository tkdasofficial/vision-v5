import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router-compat";
import { FEATURE_TIPS, GESTURE_STEPS } from "@/lib/usage-guide";

export default function GuidePage() {
  const navigate = useNavigate();
  return <main className="min-h-[100dvh] bg-background px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))] text-foreground sm:px-8">
    <div className="mx-auto max-w-2xl">
      <Button variant="floating" size="icon" className="size-11" aria-label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/chat", { direction: "back" }))}><ArrowLeft /></Button>
      <h1 className="mt-6 font-display text-3xl font-semibold">App Usage Guide</h1>
      <p className="mt-2 text-muted-foreground">How to move around Vision and get the most out of it.</p>
      <section aria-labelledby="guide-nav" className="mt-8">
        <h2 id="guide-nav" className="text-lg font-semibold">Navigation gestures</h2>
        <ol className="mt-3 space-y-3">
          {GESTURE_STEPS.map((s, i) => <li key={s.title} className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-medium">{i + 1}. {s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </li>)}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">Prefer buttons? Every gesture also has a button: the menu and Back buttons do the same thing.</p>
      </section>
      <section aria-labelledby="guide-features" className="mt-8">
        <h2 id="guide-features" className="text-lg font-semibold">Key features</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {FEATURE_TIPS.map((t) => <li key={t.title} className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-medium">{t.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
          </li>)}
        </ul>
      </section>
    </div>
  </main>;
}
