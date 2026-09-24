from pathlib import Path
from langchain_text_splitters import MarkdownHeaderTextSplitter
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.shared.ai.client import get_ai_provider
import pymupdf4llm
import os

ai = get_ai_provider()

# need to change this to a macro or something where is the content folder is located
home = os.environ.get("HOME")
print(f"Home directory: {home}")
pdf_folder = Path(f"{home}/Desktop/1337-nexus/backend/content/subjects/pdfs")
md_folder = Path(f"{home}/Desktop/1337-nexus/backend/content/subjects/mds")
headers_to_split_on = [("#", "header 1"),
                       ("##", "header 2"),
                       ("###", "header 3")]

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
    token_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100) # i can change it to [500,50]
    final_chunks = token_splitter.split_documents(chunks)
    print(ai.embed(final_chunks))
