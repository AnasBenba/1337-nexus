from pathlib import Path
import pymupdf4llm

# need to change this to a macro or something where is the content folder is located
folder = Path("/workspaces/1337-nexus/backend/content/subjects/pdfs")

for file in folder.glob("*.pdf"):
    print(f"Processing {file.name}...")
    mark = pymupdf4llm.to_markdown(file)
    Path(f"/workspaces/1337-nexus/backend/content/subjects/mds/{file.stem}.md").write_text(mark)
