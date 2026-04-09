# Tweet clustering (Flow 3 step 3 — Phase 1, prompt-based)

Group **signal tweets** that describe the **same concrete event or story**. Use **prompt-based** grouping only (no embeddings).

## Input

The following is a JSON object with key `tweets` (array). Each item:

- `id` (number, required) — internal tweet id; echo these ids exactly in output
- `text` (string, required)
- `posted_at` (string, optional, ISO-8601)

{{TWEETS_JSON}}

## Rules

1. **Minimum cluster size: 2 tweets.** A cluster must have **at least two** tweets about the **same** specific event. Otherwise put ids in `unclustered`.

2. **Cluster** same launch, same funding round, same paper/incident, same regulatory action.

3. **Do not cluster** different stories from the same company, or vague thematic similarity.

4. **`topic`:** 2–5 words, specific (e.g. `Anthropic Series C`, not `Startup news`).

## Output

Return **only** valid JSON (no markdown, no prose). Every input `id` must appear exactly once across `clusters` and `unclustered`.

Schema:

{"clusters":[{"tweet_ids":[1,2],"topic":"Example topic"}],"unclustered":[3]}
