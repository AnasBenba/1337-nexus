import asyncio
import hashlib
import re
import uuid
from pathlib import Path

import frontmatter
import pymupdf4llm
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.models.curriculum import CurriculumChunk, Subject, SubjectDocument
from app.shared.ai.client import get_ai_provider
from app.shared.ai.config import EMBEDDING_DIMENSIONS


async def main():
    ai = get_ai_provider()
    backend_dir = Path(__file__).resolve().parents[2]
    subjects_dir = backend_dir / "content" / "subjects"
    pdf_folder = subjects_dir / "pdfs"
    md_folder = subjects_dir / "mds"

    md_folder.mkdir(parents=True, exist_ok=True)
    headers_to_split_on = [
        ("#", "header 1"),
        ("##", "header 2"),
        ("###", "header 3"),
    ]

    print(f"Scanning for curriculum subjects in {subjects_dir}...")

    # 1. Convert any PDFs if present
    if pdf_folder.exists():
        for file in pdf_folder.glob("*.pdf"):
            md_file = md_folder / f"{file.stem}.md"
            if md_file.exists():
                print(f"Skipping {file.name}, already converted.")
                continue

            print(f"Converting {file.name} to Markdown...")
            mark = pymupdf4llm.to_markdown(str(file))
            md_file.write_text(mark)

    # 2. Collect all markdown files from subjects directory and mds/
    md_files = list(subjects_dir.glob("*.md")) + list(md_folder.glob("*.md"))
    # Deduplicate by absolute path
    unique_md_files = list({p.resolve(): p for p in md_files}.values())

    if not unique_md_files:
        print(f"No markdown or PDF files found in {subjects_dir}.")
        return

    print(f"Found {len(unique_md_files)} subject document(s) to ingest.")

    for md_file in unique_md_files:
        print(f"Processing {md_file.name}...")
        raw_text = md_file.read_text()

        # Parse YAML frontmatter (with fallback to normalized filename)
        post = frontmatter.loads(raw_text)
        default_slug = re.sub(r"[-\s]+", "-", md_file.stem.lower().strip()).strip("-")
        subject_slug = post.get("slug") or default_slug
        subject_name = post.get("title") or md_file.stem.strip()
        language = post.get("language")
        content_text = post.content if post.content.strip() else raw_text

        # Two-stage chunking (headers then 800-token chunks with 100-token overlap)
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        header_chunks = splitter.split_text(content_text)
        token_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            chunk_size=800, chunk_overlap=100, encoding_name="cl100k_base"
        )
        final_documents = token_splitter.split_documents(header_chunks)

        text_chunks = [doc.page_content for doc in final_documents]
        embeddings = await ai.embed(text_chunks)

        async with SessionLocal() as db:
            # 1. Upsert Subject
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
            else:
                subject.name = subject_name

            # 2. Upsert SubjectDocument
            file_bytes = md_file.read_bytes()
            file_hash = hashlib.sha256(file_bytes).hexdigest()
            doc_stmt = select(SubjectDocument).where(
                (SubjectDocument.sha256_hash == file_hash)
                | (
                    (SubjectDocument.subject_id == subject.id)
                    & (SubjectDocument.original_filename == md_file.name)
                )
            )
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
            else:
                subject_doc.sha256_hash = file_hash
                subject_doc.storage_path = str(md_file)

            # 3. Clean upsert: Delete existing chunks for this document before inserting
            del_stmt = delete(CurriculumChunk).where(CurriculumChunk.document_id == subject_doc.id)
            await db.execute(del_stmt)

            # 4. Insert chunks
            inserted_count = 0
            for idx, (chunk, vector) in enumerate(zip(final_documents, embeddings, strict=True)):
                if len(vector) != EMBEDDING_DIMENSIONS:
                    print(
                        f"Warning: Skipping chunk, expected {EMBEDDING_DIMENSIONS} dims, "
                        f"got {len(vector)}"
                    )
                    continue

                chunk_meta = dict(chunk.metadata) if chunk.metadata else {}
                if language:
                    chunk_meta["language"] = language
                chunk_meta["subject_slug"] = subject_slug

                new_record = CurriculumChunk(
                    id=uuid.uuid4(),
                    document_id=subject_doc.id,
                    chunk_index=idx,
                    content=chunk.page_content,
                    chunk_metadata=chunk_meta,
                    embedding=vector,
                )
                db.add(new_record)
                inserted_count += 1

            await db.commit()
            print(f"Ingested {inserted_count} chunks for {subject_name} ({subject_slug})")


if __name__ == "__main__":
    asyncio.run(main())
