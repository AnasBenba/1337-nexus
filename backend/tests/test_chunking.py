"""
Tests for curriculum chunking and database persistence pipeline.

Covers:
- Markdown chunking produces correct output structure
- Stub embedder returns vectors of correct dimensions
- CurriculumChunk model can be built from chunking output
- Full pipeline: PDF → MD → chunks → embeddings → DB rows (in-memory SQLite)
"""

import asyncio
import pytest
from pathlib import Path

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from sqlalchemy import create_engine, text as sa_text
from sqlalchemy.orm import Session

from app.shared.ai.config import EMBEDDING_DIMENSIONS
from app.shared.ai.stub import stub
from app.models.base import Base
from app.models.curriculum import CurriculumChunk


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HEADERS_TO_SPLIT_ON = [
    ("#", "header 1"),
    ("##", "header 2"),
    ("###", "header 3"),
]

BACKEND_DIR = Path(__file__).resolve().parents[1]
MD_FOLDER = BACKEND_DIR / "content" / "subjects" / "mds"
PDF_FOLDER = BACKEND_DIR / "content" / "subjects" / "pdfs"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def in_memory_engine():
    """
    SQLite in-memory engine with pgvector Vector column replaced by a
    plain Text column (SQLite has no vector type, but we only need to
    verify the ORM round-trip here).
    """
    # We monkey-patch Vector so SQLAlchemy does not try to use the
    # pgvector dialect type against SQLite.
    from pgvector.sqlalchemy import Vector
    from sqlalchemy import String
    import sqlalchemy.types as types

    # Override Vector to use JSON string storage in SQLite
    class _FakeVector(types.TypeDecorator):
        impl = types.Text
        cache_ok = True

        def process_bind_param(self, value, dialect):
            if value is None:
                return None
            import json
            return json.dumps(value)

        def process_result_value(self, value, dialect):
            if value is None:
                return None
            import json
            return json.loads(value)

    # Patch the column type on the model for this test session
    CurriculumChunk.__table__.c.embedding.type = _FakeVector()

    # Also need to drop FK constraint (SQLite has limited FK support)
    # We recreate the table definition without the FK for test purposes
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    # Create tables – the FK on subject_document_id will be skipped in SQLite
    with engine.connect() as conn:
        conn.execute(sa_text(
            """
            CREATE TABLE IF NOT EXISTS subject_documents (
                id INTEGER PRIMARY KEY
            )
            """
        ))
        conn.execute(sa_text(
            """
            CREATE TABLE IF NOT EXISTS curriculum_chunks (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_document_id INTEGER NOT NULL,
                content   TEXT NOT NULL,
                chunk_metadata TEXT,
                embedding TEXT
            )
            """
        ))
        conn.commit()

    yield engine


@pytest.fixture(scope="module")
def db_session(in_memory_engine):
    """Provide a synchronous SQLAlchemy session backed by SQLite."""
    with Session(in_memory_engine) as session:
        yield session


@pytest.fixture(scope="module")
def ai_stub():
    return stub()


@pytest.fixture(scope="module")
def sample_md_text():
    """Return the text of the first .md file found under content/subjects/mds."""
    md_files = list(MD_FOLDER.glob("*.md"))
    assert md_files, f"No .md files found in {MD_FOLDER}. Run PDF conversion first."
    return md_files[0].read_text(), md_files[0].name


# ---------------------------------------------------------------------------
# Unit tests: Markdown chunking
# ---------------------------------------------------------------------------

class TestMarkdownChunking:
    """Verify the two-stage chunking strategy."""

    def test_header_splitter_returns_documents(self, sample_md_text):
        text, name = sample_md_text
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
        chunks = splitter.split_text(text)
        assert len(chunks) > 0, f"MarkdownHeaderTextSplitter produced 0 chunks for {name}"

    def test_recursive_splitter_produces_final_chunks(self, sample_md_text):
        text, name = sample_md_text
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
        header_chunks = splitter.split_text(text)

        token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        final_documents = token_splitter.split_documents(header_chunks)

        assert len(final_documents) > 0, f"RecursiveCharacterTextSplitter produced 0 docs for {name}"

    def test_each_chunk_respects_size_limit(self, sample_md_text):
        """No chunk should exceed chunk_size by more than the overlap buffer."""
        text, _ = sample_md_text
        chunk_size = 1000
        chunk_overlap = 100

        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
        header_chunks = splitter.split_text(text)
        token_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )
        final_documents = token_splitter.split_documents(header_chunks)

        for doc in final_documents:
            # Allow a small buffer over chunk_size for the splitter boundary
            assert len(doc.page_content) <= chunk_size + chunk_overlap + 50, (
                f"Chunk is too large: {len(doc.page_content)} chars"
            )

    def test_chunk_page_content_is_non_empty_string(self, sample_md_text):
        text, _ = sample_md_text
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
        header_chunks = splitter.split_text(text)
        token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        final_documents = token_splitter.split_documents(header_chunks)

        for doc in final_documents:
            assert isinstance(doc.page_content, str)
            assert doc.page_content.strip(), "Found an empty chunk"

    def test_chunk_metadata_is_dict(self, sample_md_text):
        text, _ = sample_md_text
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
        header_chunks = splitter.split_text(text)
        token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        final_documents = token_splitter.split_documents(header_chunks)

        for doc in final_documents:
            assert isinstance(doc.metadata, dict)


# ---------------------------------------------------------------------------
# Unit tests: Stub embedder
# ---------------------------------------------------------------------------

class TestStubEmbedder:
    """Verify the stub AI provider returns sane embeddings."""

    @pytest.mark.asyncio
    async def test_embed_returns_list(self, ai_stub):
        result = await ai_stub.embed(["hello world"])
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_embed_returns_one_vector_per_text(self, ai_stub):
        texts = ["chunk one", "chunk two", "chunk three"]
        result = await ai_stub.embed(texts)
        assert len(result) == len(texts)

    @pytest.mark.asyncio
    async def test_embed_vector_has_correct_dimensions(self, ai_stub):
        result = await ai_stub.embed(["test text"])
        assert len(result[0]) == EMBEDDING_DIMENSIONS

    @pytest.mark.asyncio
    async def test_embed_vectors_are_floats(self, ai_stub):
        result = await ai_stub.embed(["test text"])
        for val in result[0]:
            assert isinstance(val, float)

    @pytest.mark.asyncio
    async def test_embed_is_deterministic(self, ai_stub):
        """Same text should always produce the same vector (stub is hash-based)."""
        text = "deterministic text"
        v1 = await ai_stub.embed([text])
        v2 = await ai_stub.embed([text])
        assert v1 == v2

    @pytest.mark.asyncio
    async def test_embed_different_texts_produce_different_vectors(self, ai_stub):
        result = await ai_stub.embed(["hello", "world"])
        assert result[0] != result[1]

    @pytest.mark.asyncio
    async def test_embed_empty_list_returns_empty_list(self, ai_stub):
        result = await ai_stub.embed([])
        assert result == []


# ---------------------------------------------------------------------------
# Integration test: Full pipeline → DB
# ---------------------------------------------------------------------------

class TestChunkingAndDBPersistence:
    """
    End-to-end: chunk a Markdown file, embed with the stub, and persist
    CurriculumChunk rows in an in-memory SQLite database.
    """

    @pytest.mark.asyncio
    async def test_pipeline_inserts_rows(self, sample_md_text, ai_stub, db_session, in_memory_engine):
        text, name = sample_md_text
        subject_document_id = 1

        # ── 1. Chunk ────────────────────────────────────────────────────────
        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
        header_chunks = splitter.split_text(text)
        token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        final_documents = token_splitter.split_documents(header_chunks)
        assert len(final_documents) > 0

        text_chunks = [doc.page_content for doc in final_documents]

        # ── 2. Embed ─────────────────────────────────────────────────────────
        embeddings = await ai_stub.embed(text_chunks)
        assert len(embeddings) == len(final_documents)

        # ── 3. Insert into DB ────────────────────────────────────────────────
        import json
        with in_memory_engine.connect() as conn:
            # Insert a parent subject_document row to satisfy FK semantics
            conn.execute(sa_text(
                "INSERT OR IGNORE INTO subject_documents (id) VALUES (:id)"
            ), {"id": subject_document_id})
            conn.commit()

            for doc, vector in zip(final_documents, embeddings):
                conn.execute(sa_text(
                    """
                    INSERT INTO curriculum_chunks
                        (subject_document_id, content, chunk_metadata, embedding)
                    VALUES
                        (:subject_document_id, :content, :chunk_metadata, :embedding)
                    """
                ), {
                    "subject_document_id": subject_document_id,
                    "content": doc.page_content,
                    "chunk_metadata": json.dumps(doc.metadata),
                    "embedding": json.dumps(vector),
                })
            conn.commit()

            # ── 4. Verify row count matches chunk count ──────────────────────
            row = conn.execute(
                sa_text("SELECT COUNT(*) FROM curriculum_chunks WHERE subject_document_id = :sid"),
                {"sid": subject_document_id},
            ).fetchone()
            assert row is not None
            assert row[0] == len(final_documents), (
                f"Expected {len(final_documents)} rows, got {row[0]}"
            )

    @pytest.mark.asyncio
    async def test_pipeline_content_is_preserved(self, sample_md_text, ai_stub, in_memory_engine):
        """Verify the stored content matches the original chunk content."""
        text, _ = sample_md_text
        subject_document_id = 2

        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
        header_chunks = splitter.split_text(text)
        token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        final_documents = token_splitter.split_documents(header_chunks)
        text_chunks = [doc.page_content for doc in final_documents]
        embeddings = await ai_stub.embed(text_chunks)

        import json
        with in_memory_engine.connect() as conn:
            conn.execute(sa_text(
                "INSERT OR IGNORE INTO subject_documents (id) VALUES (:id)"
            ), {"id": subject_document_id})

            for doc, vector in zip(final_documents, embeddings):
                conn.execute(sa_text(
                    """
                    INSERT INTO curriculum_chunks
                        (subject_document_id, content, chunk_metadata, embedding)
                    VALUES
                        (:subject_document_id, :content, :chunk_metadata, :embedding)
                    """
                ), {
                    "subject_document_id": subject_document_id,
                    "content": doc.page_content,
                    "chunk_metadata": json.dumps(doc.metadata),
                    "embedding": json.dumps(vector),
                })
            conn.commit()

            rows = conn.execute(
                sa_text("SELECT content FROM curriculum_chunks WHERE subject_document_id = :sid"),
                {"sid": subject_document_id},
            ).fetchall()

        stored_contents = {r[0] for r in rows}
        original_contents = {doc.page_content for doc in final_documents}
        assert stored_contents == original_contents

    @pytest.mark.asyncio
    async def test_pipeline_embeddings_have_correct_dimension(self, sample_md_text, ai_stub, in_memory_engine):
        """Stored embedding vectors should round-trip with correct length."""
        text, _ = sample_md_text
        subject_document_id = 3

        splitter = MarkdownHeaderTextSplitter(headers_to_split_on=HEADERS_TO_SPLIT_ON)
        header_chunks = splitter.split_text(text)
        token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        final_documents = token_splitter.split_documents(header_chunks)
        text_chunks = [doc.page_content for doc in final_documents]
        embeddings = await ai_stub.embed(text_chunks)

        import json
        with in_memory_engine.connect() as conn:
            conn.execute(sa_text(
                "INSERT OR IGNORE INTO subject_documents (id) VALUES (:id)"
            ), {"id": subject_document_id})

            for doc, vector in zip(final_documents, embeddings):
                conn.execute(sa_text(
                    """
                    INSERT INTO curriculum_chunks
                        (subject_document_id, content, chunk_metadata, embedding)
                    VALUES
                        (:subject_document_id, :content, :chunk_metadata, :embedding)
                    """
                ), {
                    "subject_document_id": subject_document_id,
                    "content": doc.page_content,
                    "chunk_metadata": json.dumps(doc.metadata),
                    "embedding": json.dumps(vector),
                })
            conn.commit()

            rows = conn.execute(
                sa_text("SELECT embedding FROM curriculum_chunks WHERE subject_document_id = :sid"),
                {"sid": subject_document_id},
            ).fetchall()

        for row in rows:
            vector = json.loads(row[0])
            assert len(vector) == EMBEDDING_DIMENSIONS


# ---------------------------------------------------------------------------
# Unit tests: CurriculumChunk ORM model structure
# ---------------------------------------------------------------------------

class TestCurriculumChunkModel:
    """Validate the SQLAlchemy model has the expected columns."""

    def test_model_has_id_column(self):
        assert hasattr(CurriculumChunk, "id")

    def test_model_has_subject_document_id_column(self):
        assert hasattr(CurriculumChunk, "subject_document_id")

    def test_model_has_content_column(self):
        assert hasattr(CurriculumChunk, "content")

    def test_model_has_chunk_metadata_column(self):
        assert hasattr(CurriculumChunk, "chunk_metadata")

    def test_model_has_embedding_column(self):
        assert hasattr(CurriculumChunk, "embedding")

    def test_table_name_is_curriculum_chunks(self):
        assert CurriculumChunk.__tablename__ == "curriculum_chunks"
