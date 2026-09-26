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
    y = 1
    for md_file in md_folder.glob("*.md"):
        print(f"Chunking {md_file.name}...")
        mark = md_file.read_text()
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        chunks = splitter.split_text(mark)
        token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        final_documents = token_splitter.split_documents(chunks)
        text_chunks = [doc.page_content for doc in final_documents]
        embeddings = await ai.embed(text_chunks)
        for chunk, vector in zip(final_documents, embeddings):
            new_record = CurriculumChunk(
                subject_document_id=y,
                content=chunk.page_content,
                chunk_metadata=chunk.metadata,
                embedding=vector
            )
            db.add(new_record)
        db.commit()
        y += 1

if __name__ == "__main__":
    asyncio.run(main())
