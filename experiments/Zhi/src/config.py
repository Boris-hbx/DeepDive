"""Configuration: data sources and settings."""

SOURCES = [
    {
        "name": "Hacker News",
        "type": "hn_api",
        "url": "https://hacker-news.firebaseio.com/v0/topstories.json",
        "max_items": 30,
    },
    {
        "name": "Anthropic Blog",
        "type": "rss",
        "url": "https://www.anthropic.com/rss.xml",
    },
    {
        "name": "OpenAI Blog",
        "type": "rss",
        "url": "https://openai.com/blog/rss.xml",
    },
    {
        "name": "Simon Willison",
        "type": "rss",
        "url": "https://simonwillison.net/atom/everything/",
    },
    {
        "name": "GitHub Blog",
        "type": "rss",
        "url": "https://github.blog/feed/",
    },
    {
        "name": "GitHub Trending",
        "type": "github_trending",
        "url": "https://api.github.com/search/repositories",
        "max_items": 20,
    },
]

TOPIC_KEYWORDS = [
    "agent", "agentic", "AI coding", "AI engineer", "copilot",
    "code generation", "LLM", "Claude", "GPT", "software engineering",
    "developer tools", "AI tools", "multi-agent", "MCP",
    "function calling", "tool use", "prompt engineering",
]

MODEL = "claude-opus-4-6"
