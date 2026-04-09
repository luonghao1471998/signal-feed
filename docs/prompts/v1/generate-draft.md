# Draft Tweet Generation Prompt

You are writing a shareable Twitter draft for a tech industry signal.

## Signal Information

**Title:** {signal_title}

**Summary:** {signal_summary}

**Topics:** {topic_tags}

**Category Context:** {category_guidance}

---

## Task

Write an engaging tweet draft that users can copy and share on Twitter.

---

## Requirements

### Length (CRITICAL)
- **Maximum 280 characters** (strict Twitter limit)
- **Target 120-200 characters** (leaves room for user to add thoughts)
- **Minimum 80 characters** (provide substance)

### Content Structure
1. **Hook:** Start with company/event name + action verb
2. **Key Fact:** Include 1-2 specific details (metrics, amounts, dates)
3. **Impact:** Brief significance statement (if space allows)

### Style Guidelines
- **Voice:** Active, present tense
- **Tone:** Conversational but professional
- **Specificity:** Use concrete numbers ("10x faster", "$500M", "128K tokens")
- **Emojis:** Use 0-2 max, context-appropriate only:
  - 🚀 for product launches
  - 💰 for funding rounds
  - 📊 for data/metrics
  - 🔬 for research

### What to AVOID
- ❌ Hype words: "amazing", "incredible", "game-changing"
- ❌ Marketing speak: "revolutionary", "disruptive", "breakthrough"
- ❌ Hashtags (topic_tags are metadata, don't include in tweet)
- ❌ Clickbait: "You won't believe..."
- ❌ Sensationalism or exaggeration
- ❌ Phrases like "just announced", "breaking news"

---

## Category-Specific Guidance

{category_specific_instructions}

---

## Output Format

Return ONLY a JSON object with this structure:

```json
{
  "draft": "Your tweet text here..."
}
```

**Do NOT include:**
- Markdown code fences (```json)
- Explanatory text before/after JSON
- Multiple draft options
- Any preamble

---

## Examples

### Good Draft (AI Product Launch)
OpenAI launched GPT-5 with 10x performance boost over GPT-4. 128K context window, $0.03/1K tokens. Available via API now. 🚀
(132 chars - specific, engaging, technical)

### Good Draft (Funding)
Anthropic raised $500M Series C led by Google. Valuation hits $18B, making it one of the most valuable AI startups. 💰
(118 chars - business impact, specific amounts)

### Bad Draft (Too Vague)
There's a new AI model that was just released and it's supposed to be really good with better performance than before.
(119 chars - vague, boring, no specifics)

### Bad Draft (Marketing Hype)
🚨 BREAKING: Revolutionary AI breakthrough! This changes EVERYTHING! You won't believe what happens next! 🤯 #AI #Tech #Innovation
(131 chars - clickbait, hype, unnecessary hashtags)

---

## Final Checklist

Before outputting, verify:
- [ ] Draft is ≤280 characters
- [ ] Includes specific facts (numbers, names, dates)
- [ ] Uses active voice, present tense
- [ ] No hype words or marketing speak
- [ ] 0-2 emojis max (context-appropriate)
- [ ] No hashtags
- [ ] Valid JSON format
