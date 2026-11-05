import bleach  # type: ignore[import-untyped]
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
    md = MarkdownIt("commonmark", {"html": True})
    raw_html = md.render(raw_markdown)
    return str(bleach.clean(raw_html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True))
