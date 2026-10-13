import asyncio
import hashlib
import uuid
from pathlib import Path

import pymupdf4llm
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.curriculum import CurriculumChunk, Subject, SubjectDocument
from app.shared.ai.client import get_ai_provider
from app.shared.ai.config import EMBEDDING_DIMENSIONS


async def main():
    ai = get_ai_provider()
    backend_dir = Path(__file__).resolve().parents[2]
    pdf_folder = backend_dir / "content" / "subjects" / "pdfs"
    md_folder = backend_dir / "content" / "subjects" / "mds"

    md_folder.mkdir(parents=True, exist_ok=True)
    headers_to_split_on = [
        ("#", "header 1"),
        ("##", "header 2"),
        ("###", "header 3"),
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
        token_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            chunk_size=800, chunk_overlap=100, encoding_name="cl100k_base"
        )
        final_documents = token_splitter.split_documents(chunks)
        text_chunks = [doc.page_content for doc in final_documents]
        embeddings = await ai.embed(text_chunks)

        async with SessionLocal() as db:
            # 1. Get or create Subject
            subject_name = md_file.stem.strip()
            subject_slug = subject_name.lower().replace(" ", "-")
            stmt = select(Subject).where(Subject.slug == subject_slug)
            res = await db.execute(stmt)
            subject = res.scalar_one_or_none()
            if not subject:
                subject = Subject(
                    id=uuid.uuid4(),
                    name=subject_name,
                    slug=subject_slug,
                    description=f"Curriculum subject for {subject_name}",
                )
                db.add(subject)
                await db.flush()

            # 2. Get or create SubjectDocument
            file_bytes = md_file.read_bytes()
            file_hash = hashlib.sha256(file_bytes).hexdigest()
            doc_stmt = select(SubjectDocument).where(SubjectDocument.sha256_hash == file_hash)
            doc_res = await db.execute(doc_stmt)
            subject_doc = doc_res.scalar_one_or_none()
            if not subject_doc:
                subject_doc = SubjectDocument(
                    id=uuid.uuid4(),
                    subject_id=subject.id,
                    original_filename=md_file.name,
                    sha256_hash=file_hash,
                    storage_path=str(md_file),
                )
                db.add(subject_doc)
                await db.flush()

            # 3. Add CurriculumChunk rows
            for idx, (chunk, vector) in enumerate(zip(final_documents, embeddings)):
                if len(vector) != EMBEDDING_DIMENSIONS:
                    print(f"Warning: Skipping chunk, expected {EMBEDDING_DIMENSIONS} dims, got {len(vector)}")
                    continue
                new_record = CurriculumChunk(
                    id=uuid.uuid4(),
                    document_id=subject_doc.id,
                    chunk_index=idx,
                    content=chunk.page_content,
                    chunk_metadata=chunk.metadata,
                    embedding=vector,
                )
                db.add(new_record)
            await db.commit()
            print(f"Ingested {len(final_documents)} chunks for {md_file.name}")


if __name__ == "__main__":
    asyncio.run(main())
