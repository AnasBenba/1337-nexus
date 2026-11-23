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
    unique_md_files = list({p.resolve(): p for p in md_files}.values())

    if not unique_md_files:
        print(f"No markdown or PDF files found in {subjects_dir}.")
        return

    print(f"Found {len(unique_md_files)} subject document(s) to check.")

    for md_file in unique_md_files:
        file_bytes = md_file.read_bytes()
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        raw_text = file_bytes.decode("utf-8")

        # Parse YAML frontmatter (with fallback to normalized filename)
        post = frontmatter.loads(raw_text)
        default_slug = re.sub(r"[-\s]+", "-", md_file.stem.lower().strip()).strip("-")
        subject_slug = post.get("slug") or default_slug
        subject_name = post.get("title") or md_file.stem.strip()
        language = post.get("language")
        content_text = post.content if post.content.strip() else raw_text

        # --- CHECK DB BEFORE CHUNKING OR CALLING EMBEDDING API ---
        cached_embeddings: dict[str, list[float]] = {}
        skip_file = False

        async with SessionLocal() as db:
            subj_res = await db.execute(select(Subject).where(Subject.slug == subject_slug))
            existing_subject = subj_res.scalar_one_or_none()

            doc_conditions = [SubjectDocument.sha256_hash == file_hash]
            if existing_subject:
                doc_conditions.append(
                    (SubjectDocument.subject_id == existing_subject.id)
                    & (SubjectDocument.original_filename == md_file.name)
                )

            doc_res = await db.execute(
                select(SubjectDocument).where(
                    doc_conditions[0]
                    if len(doc_conditions) == 1
                    else (doc_conditions[0] | doc_conditions[1])
                )
            )
            existing_doc = doc_res.scalar_one_or_none()

            if existing_doc:
                chunk_rows = (
                    await db.execute(
                        select(CurriculumChunk.content, CurriculumChunk.embedding).where(
                            CurriculumChunk.document_id == existing_doc.id
                        )
                    )
                ).all()

                # Level 1: Exact file hash already ingested with chunks -> skip completely
                if existing_doc.sha256_hash == file_hash and chunk_rows:
                    print(
                        f"Skipping {md_file.name}: unchanged ({len(chunk_rows)} chunks already in DB)."
                    )
                    skip_file = True
                else:
                    # Level 2: File changed -> cache existing chunk vectors by exact content
                    for content, vec in chunk_rows:
                        if vec is not None and len(vec) == EMBEDDING_DIMENSIONS:
                            cached_embeddings[content] = [float(x) for x in vec]

        if skip_file:
            continue

        print(f"Processing {md_file.name}...")

        # Two-stage chunking (headers then 800-token chunks with 100-token overlap)
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        header_chunks = splitter.split_text(content_text)
        token_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            chunk_size=800, chunk_overlap=100, encoding_name="cl100k_base"
        )
        final_documents = token_splitter.split_documents(header_chunks)

        if not final_documents:
            print(f"Skipping {md_file.name}: no chunks produced.")
            continue

        # Reuse cached embeddings; only send missing/modified chunks to the AI provider
        embeddings: list[list[float] | None] = [None] * len(final_documents)
        missing_indices: list[int] = []
        missing_texts: list[str] = []

        for idx, doc in enumerate(final_documents):
            cached_vec = cached_embeddings.get(doc.page_content)
            if cached_vec is not None:
                embeddings[idx] = cached_vec
            else:
                missing_indices.append(idx)
                missing_texts.append(doc.page_content)

        reused_count = len(final_documents) - len(missing_texts)

        if missing_texts:
            print(
                f"  Embedding {len(missing_texts)} new/changed chunk(s) "
                f"(reusing {reused_count} cached)..."
            )
            new_embeddings = await ai.embed(missing_texts)
            for idx, vec in zip(missing_indices, new_embeddings, strict=True):
                embeddings[idx] = vec
        else:
            print(f"  All {reused_count} chunk(s) reused from DB (0 API calls).")

        # --- SAVE TO DB ---
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

            # 3. Replace chunks (preserving reused vectors so chunk_index stays clean)
            del_stmt = delete(CurriculumChunk).where(CurriculumChunk.document_id == subject_doc.id)
            await db.execute(del_stmt)

            # 4. Insert chunks
            inserted_count = 0
            for idx, (chunk, vector) in enumerate(zip(final_documents, embeddings, strict=True)):
                if vector is None or len(vector) != EMBEDDING_DIMENSIONS:
                    got_dims = len(vector) if vector is not None else 0
                    print(
                        f"Warning: Skipping chunk, expected {EMBEDDING_DIMENSIONS} dims, "
                        f"got {got_dims}"
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
            print(
                f"Ingested {inserted_count} chunks for {subject_name} ({subject_slug}) "
                f"[embedded: {len(missing_texts)}, reused: {reused_count}]"
            )


if __name__ == "__main__":
    asyncio.run(main())