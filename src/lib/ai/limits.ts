// Central AI execution budgets. Pure; every chat/deep/retry limit should be read from here.
export const AI_LIMITS = {
  /** Max characters of conversation history sent to a model (system prompt excluded). */
  historyChars: 60_000,
  /** Max messages considered before budgeting. */
  historyMessages: 40,
  /** Max characters kept per single message. */
  messageChars: 20_000,
  /** Retry policy for transient provider failures. */
  retry: { attempts: 2, baseMs: 400, maxMs: 4_000 },
  /** Characters of the task brief carried into every split generation step. */
  briefChars: 2_000,
} as const;
