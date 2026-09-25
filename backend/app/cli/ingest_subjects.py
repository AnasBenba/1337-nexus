import asyncio
from pathlib import Path
import pymupdf4llm
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from app.shared.ai.client import get_ai_provider

async def main():
    ai = get_ai_provider()
    backend_dir = Path(__file__).resolve().parents[2]
    pdf_folder = backend_dir / "content" / "subjects" / "pdfs"
    md_folder = backend_dir / "content" / "subjects" / "mds"

    md_folder.mkdir(parents=True, exist_ok=True)

    headers_to_split_on = [
        ("#", "header 1"),
        ("##", "header 2"),
        ("###", "header 3")
    ]

    for file in pdf_folder.glob("*.pdf"):
        md_file = md_folder / f"{file.stem}.md"
        if md_file.exists():
            print(f"Skipping {file.name}, already converted.")
            continue

        print(f"Converting {file.name} to Markdown...")
        mark = pymupdf4llm.to_markdown(file)
        md_file.write_text(mark)

    for md_file in md_folder.glob("*.md"):
        print(f"Chunking {md_file.name}...")
        mark = md_file.read_text()
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        chunks = splitter.split_text(mark)
        token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        final_documents = token_splitter.split_documents(chunks)
        # fron here is just for testing purposes, we can remove it later
        text_chunks = [doc.page_content for doc in final_documents]
        embeddings = await ai.embed(text_chunks)
        print(f"Generated {len(embeddings)} vectors for {md_file.name}")
        # ----------------------------------------------------------------

if __name__ == "__main__":
    asyncio.run(main())
