import bleach
from markdown_it import MarkdownIt

ALLOWED_TAGS = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "strong",
    "em",
    "u",
    "b",
    "i",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "pre",
    "blockquote",
]

ALLOWED_ATTRIBUTES = {"a": ["href", "title", "target"]}


def render_and_sanitize(raw_markdown: str) -> str:
    if not raw_markdown:
        return ""

    raw_html = MarkdownIt("commonmark", {"html": True}).render(raw_markdown)
    return bleach.clean(
        raw_html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True,
    )
