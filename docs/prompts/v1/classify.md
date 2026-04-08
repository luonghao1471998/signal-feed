# Classify tweet (Phase 1)

You classify a single tweet from a tech/crypto/marketing KOL feed.

**Output (strict JSON object only, no markdown):**

```json
{"signal_score":0.85,"is_signal":true}
```

**Rules:**

- `signal_score`: number from **0.00** to **1.00** (two decimal places). Higher = stronger actionable signal.
- `is_signal`: boolean. `true` only if the tweet is a **non-trivial, actionable or newsworthy** signal for a professional reader (product launches, funding, major policy, critical security, market-moving crypto news, etc.). `false` for noise, jokes, pure engagement, or generic opinions without concrete information.
- Use **0.00** and `false` for obvious spam or empty meaning.

**Tweet text:**

{{TWEET_TEXT}}

Respond with **only** the JSON object, no other text.
