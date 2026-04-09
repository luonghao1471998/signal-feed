You are summarizing a tech signal from multiple tweets.

**Cluster Topic:** {cluster_topic}

**Source Tweets:**
{tweets_list}

---

**Task:** Synthesize these tweets into one coherent signal summary.

**Requirements:**
- **Title:** Maximum 10 words. Create a newsworthy, action-oriented headline. Use active voice ("Company launches X" not "X was launched"). Be specific and factual.
- **Summary:** 50-100 words (optimal: 75 words). Write in third-person journalistic style. Combine information from all tweets, removing redundancy. Highlight key facts: amounts, dates, company names, metrics, version numbers. Do NOT editorialize or add opinion.
- **Topic Tags:** 1-3 broad category tags only. Examples: "AI", "Funding", "Product Launch", "Acquisition", "Research", "Security". Avoid overly specific tags.

**Guidelines:**
- If tweets have conflicting information (e.g., different funding amounts), acknowledge the range or cite the most credible source
- If multiple sources confirm the same fact, you can mention "multiple sources report..."
- Preserve quantitative details (numbers, percentages, dates)
- Prioritize information from official/verified sources if identifiable
- If cluster topic suggests the focus, use it as context but don't force it if tweets diverge

**Output Format (JSON only, no other text):**
```json
{
  "title": "Company Does Something with Key Detail",
  "summary": "Company XYZ announced... [50-100 words of factual synthesis]",
  "topic_tags": ["Category1", "Category2"]
}
```

**Examples:**

**Good Title:**
✅ "OpenAI Releases GPT-5 with 10x Performance Boost"
✅ "Anthropic Raises $500M Series C from Google"

**Bad Title:**
❌ "Interesting AI News" (vague)
❌ "There is a new model called GPT-5 that was recently released by OpenAI" (too long, 14 words)

**Good Summary:**
✅ "OpenAI has launched GPT-5, their latest language model, now available via API at $0.03 per 1K input tokens. Initial benchmarks show 10x performance improvement over GPT-4 in reasoning tasks. The model features a 128K context window, up from GPT-4's 32K."

**Bad Summary:**
❌ "This is exciting news for the AI community. The new model seems really powerful and could change everything." (opinion, not factual)

Output JSON now:
