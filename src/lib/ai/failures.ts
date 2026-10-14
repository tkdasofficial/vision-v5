// Unified failure classification + bounded retry policy for model, tool and job calls. Pure, tested.
import { AI_LIMITS } from "./limits";

export type FailureKind = "transient" | "permanent" | "validation" | "permission" | "resource" | "cancelled" | "unknown";

export function classifyFailure(status: number, reason = ""): FailureKind {
  if (status === 499) return "cancelled";
  if (status === 401 || status === 403) return "permission";
  if (status === 429 || /rate limit|busy|cooling/i.test(reason)) return "resource";
  if (status === 408 || status === 504 || status === 502 || status === 503 || status >= 500) return "transient";
  if (status === 400 || status === 422) return "validation";
  if (status === 404 || status === 405 || status === 413) return "permanent";
  return "unknown";
}

/** Only transient and resource failures are retried; others need a different input, provider or user action. */
export function shouldRetry(kind: FailureKind, attempt: number, max: number = AI_LIMITS.retry.attempts): boolean {
  return (kind === "transient" || kind === "resource") && attempt < max;
}

/** Exponential backoff with full jitter, capped. `rand` is injectable for tests. */
export function backoffMs(attempt: number, rand: () => number = Math.random, p = AI_LIMITS.retry): number {
  const cap = Math.min(p.maxMs, p.baseMs * 2 ** attempt);
  return Math.round(cap * (0.5 + rand() * 0.5));
}

/** Message safe to show users: never includes provider bodies, stack traces or internals. */
export function userMessageFor(kind: FailureKind): string {
  switch (kind) {
    case "resource": return "AI is busy right now. Please try again in a moment.";
    case "permission": return "AI isn't available for this request right now.";
    case "validation": return "That request couldn't be processed. Try rephrasing it.";
    case "cancelled": return "Request cancelled.";
    default: return "AI couldn't answer right now.";
  }
}
