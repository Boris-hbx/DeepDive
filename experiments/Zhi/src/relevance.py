"""LLM-based relevance filter: use a cheap model to judge article relevance."""

import anthropic

RELEVANCE_MODEL = "claude-opus-4-6"

RELEVANCE_PROMPT = """You are a relevance filter for an "Agentic Software Engineering" daily brief.

Given an article title (and source), decide if it is relevant to these topics:
- AI-powered coding tools (Copilot, Cursor, Claude Code, etc.)
- LLM agents for software engineering tasks
- Multi-agent collaboration for development
- AI code generation, review, testing, debugging
- Developer tool chains integrating LLMs
- MCP, function calling, tool use patterns
- Human-AI pair programming workflows
- AI companies (Anthropic, OpenAI, Google) releasing developer-facing products

Reply with ONLY "yes" or "no". Nothing else."""


def judge_relevance_batch(articles):
    """Judge relevance for a batch of articles using LLM.

    Returns list of articles deemed relevant.
    """
    if not articles:
        return []

    client = anthropic.Anthropic()
    relevant = []

    articles_text = "\n".join(
        f"{i+1}. [{a['title']}] (source: {a['source']})"
        for i, a in enumerate(articles)
    )

    batch_prompt = f"""Here are {len(articles)} articles. For each one, reply with its number followed by "yes" or "no".
Example format:
1. yes
2. no
3. yes

Articles:
{articles_text}"""

    message = client.messages.create(
        model=RELEVANCE_MODEL,
        max_tokens=500,
        messages=[{"role": "user", "content": batch_prompt}],
        system=RELEVANCE_PROMPT,
    )

    text_blocks = [b for b in message.content if b.type == "text"]
    response = text_blocks[0].text.strip() if text_blocks else ""
    for line in response.split("\n"):
        line = line.strip()
        if not line:
            continue
        parts = line.split(".", 1)
        if len(parts) == 2:
            try:
                idx = int(parts[0].strip()) - 1
                answer = parts[1].strip().lower()
                if answer.startswith("yes") and 0 <= idx < len(articles):
                    relevant.append(articles[idx])
            except ValueError:
                continue

    return relevant
