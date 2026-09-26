from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from pgvector.sqlalchemy import Vector
from app.shared.ai.config import EMBEDDING_DIMENSIONS
from .base import Base


class	CurriculumChunk(Base):
	__tablename__ = "curriculum_chunks"

	id = Column(Integer, primary_key=True, index=True)
	subject_document_id = Column(Integer, ForeignKey("subject_documents.id"), nullable=False)
	content = Column(String, nullable=False)
	chunk_metadata = Column(JSON, nullable=True)
	embedding = Column(Vector(EMBEDDING_DIMENSIONS))
