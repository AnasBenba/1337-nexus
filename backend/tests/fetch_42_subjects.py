#!/usr/bin/env python3
"""
42 Subject Ingestion Tool
-------------------------
A standalone developer utility to discover, crawl, and download official 42 project
subject PDF documents directly from the 42 Network Intra and CDN.

Purpose:
  The 1337 Nexus AI Co-Pilot uses official 42 project guidelines, peer evaluation traps,
  and mandatory requirements to guide students during code reviews. This script automates
  fetching all cursus project subjects (e.g. Libft, Minishell, Philosophers, WebServ,
  Inception, ft_transcendence) into a local directory for curriculum RAG ingestion.

How it works:
  1. Authenticates with the 42 Intra API (`https://api.intra.42.fr`) via OAuth2
     Client Credentials grant (using UID & Secret from tests/.env).
  2. Discovers project slugs for Cursus 21 (42cursus) or iterates over predefined core slugs.
  3. Uses the student session cookie (`_intra_42_session_production`) to fetch the project
     page on `https://projects.intra.42.fr/<slug>/mine` and extract the official CDN URL:
     `https://cdn.intra.42.fr/pdf/pdf/<document_id>/en.subject.pdf`.
  4. Downloads the raw PDF binary using the Bearer access token stream from the CDN.
  5. Validates `%PDF` file integrity and saves the PDF to `tests/42_subjects/pdfs/`.
  6. Maintains a structured `tests/42_subjects/metadata.json` catalog of all downloaded subjects.

Rate Limiting:
  42 API enforces a 2 requests/second limit. This script enforces 0.7s delays between requests
  and implements automatic exponential backoff on HTTP 429.

Setup:
  Create or update `backend/tests/.env`:
    UID=<your_42_app_uid>
    SECRET=<your_42_app_secret>
    INTRA_COOKIE=<your_intra_session_production_cookie>

Usage examples:
  # Fetch all common-core subjects (Circle 0 through Circle 6):
  python tests/fetch_42_subjects.py --core-only

  # Fetch a single specific project by slug:
  python tests/fetch_42_subjects.py --slug minishell

  # Crawl all projects in cursus 21:
  python tests/fetch_42_subjects.py
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("42_subject_fetcher")

# Base URLs
BASE_API_URL = "https://api.intra.42.fr"
BASE_PROJECTS_URL = "https://projects.intra.42.fr"
RATE_LIMIT_DELAY = 0.7  # Safe pacing for 42 API (limit is 2 req/sec)

# Core 42cursus projects (canonical slugs for high-priority subjects)
CORE_PROJECT_SLUGS = [
    # Circle 0
    "42cursus-libft",
    # Circle 1
    "42cursus-ft_printf",
    "42cursus-get_next_line",
    "born2beroot",
    # Circle 2
    "42cursus-push_swap",
    "so_long",
    "fract-ol",
    "42cursus-fdf",
    "pipex",
    "42cursus-minishell",
    # Circle 3
    "42cursus-philosophers",
    # Circle 4
    "netpractice",
    "cub3d",
    "minirt",
    "cpp-module-00",
    "cpp-module-01",
    "cpp-module-02",
    "cpp-module-03",
    "cpp-module-04",
    # Circle 5
    "cpp-module-05",
    "cpp-module-06",
    "cpp-module-07",
    "cpp-module-08",
    "cpp-module-09",
    "inception",
    "webserv",
    "ft_irc",
    # Circle 6
    "ft_transcendence",
]


class FortyTwoClient:
    """HTTP client handling 42 OAuth2 authentication, web scraping, and CDN downloads."""

    def __init__(self, uid: str, secret: str, cookie: str):
        self.uid = uid
        self.secret = secret
        self.cookie = cookie
        self.token: str | None = None
        self.token_expiry: float = 0.0

        cookie_header = cookie
        if "_intra_42_session_production=" not in cookie:
            cookie_header = f"_intra_42_session_production={cookie}"

        self.session_headers = {
            "Cookie": cookie_header,
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        }
        self.http = httpx.Client(timeout=25.0)

    def get_token(self) -> str:
        """Obtain or refresh OAuth2 client credentials token."""
        now = time.time()
        if self.token and now < self.token_expiry - 60:
            return self.token

        logger.info("Requesting new OAuth2 token from 42 Intra...")
        resp = self.http.post(
            f"{BASE_API_URL}/oauth/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self.uid,
                "client_secret": self.secret,
            },
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"Failed to authenticate with 42 API: {resp.status_code} {resp.text}"
            )

        data = resp.json()
        self.token = data["access_token"]
        self.token_expiry = now + data.get("expires_in", 7200)
        logger.info("Successfully acquired Bearer token.")
        return self.token

    def _safe_get(self, url: str, headers: dict[str, str], max_retries: int = 3) -> httpx.Response:
        """Send GET request with rate-limiting and retry logic."""
        time.sleep(RATE_LIMIT_DELAY)
        for attempt in range(max_retries):
            try:
                resp = self.http.get(url, headers=headers, follow_redirects=True)
                if resp.status_code == 429:
                    wait_time = int(resp.headers.get("Retry-After", 3)) + 1
                    logger.warning(f"Rate limited (429). Backing off for {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                return resp
            except (httpx.TimeoutException, httpx.NetworkError) as err:
                if attempt == max_retries - 1:
                    raise
                logger.warning(f"Network error on {url} ({err}). Retrying...")
                time.sleep(2.0)
        raise RuntimeError(f"Request failed after {max_retries} attempts: {url}")

    def fetch_cursus_projects(self, cursus_id: int = 21) -> list[dict[str, Any]]:
        """Fetch all projects belonging to the specified cursus from 42 Intra API."""
        token = self.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        projects: list[dict[str, Any]] = []
        page = 1

        logger.info(f"Discovering projects for cursus {cursus_id} from 42 API...")
        while True:
            url = (
                f"{BASE_API_URL}/v2/cursus/{cursus_id}/projects?page[size]=100&page[number]={page}"
            )
            resp = self._safe_get(url, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Error fetching page {page}: {resp.status_code}")
                break

            items = resp.json()
            if not items:
                break
            projects.extend(items)
            logger.info(
                f"  Page {page}: fetched {len(items)} projects (running total: {len(projects)})"
            )
            if len(items) < 100:
                break
            page += 1

        return projects

    def find_subject_cdn_urls(self, project_slug: str) -> list[str]:
        """Scrape the project page on projects.intra.42.fr to discover CDN subject URLs."""
        # Try both direct slug and 42cursus- prefixed slug
        slugs_to_try = [project_slug]
        if not project_slug.startswith("42cursus-"):
            slugs_to_try.append(f"42cursus-{project_slug}")
        else:
            slugs_to_try.append(project_slug.replace("42cursus-", ""))

        found_urls = set()
        for s in slugs_to_try:
            urls = [
                f"{BASE_PROJECTS_URL}/{s}/mine",
                f"{BASE_PROJECTS_URL}/projects/{s}",
            ]
            for page_url in urls:
                try:
                    resp = self._safe_get(page_url, headers=self.session_headers)
                    if resp.status_code == 200:
                        matches = re.findall(
                            r'https://cdn\.intra\.42\.fr/pdf/pdf/\d+/[^\s"\'<>]+',
                            resp.text,
                        )
                        for m in matches:
                            found_urls.add(m)
                        if found_urls:
                            return sorted(found_urls)
                except Exception as e:
                    logger.debug(f"Failed to check {page_url}: {e}")

        return sorted(found_urls)

    def download_pdf(self, cdn_url: str, output_path: Path) -> bool:
        """Download subject PDF from CDN using Bearer token authentication."""
        token = self.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        resp = self._safe_get(cdn_url, headers=headers)

        if resp.status_code != 200:
            logger.warning(f"Failed to download {cdn_url}: status {resp.status_code}")
            return False

        if not resp.content.startswith(b"%PDF"):
            logger.warning(f"Downloaded content from {cdn_url} is not a valid PDF file.")
            return False

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(resp.content)
        logger.info(f"  Saved ({len(resp.content):,} bytes) -> {output_path.name}")
        return True


def pick_best_subject(cdn_urls: list[str]) -> str | None:
    """Prefer en.subject.pdf, then subject.pdf, then any other english/subject pdf."""
    if not cdn_urls:
        return None
    for url in cdn_urls:
        if "en.subject.pdf" in url.lower():
            return url
    for url in cdn_urls:
        if "subject.pdf" in url.lower() and "fr." not in url.lower():
            return url
    for url in cdn_urls:
        if "subject" in url.lower():
            return url
    return cdn_urls[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch official 42 project subjects.")
    parser.add_argument(
        "--core-only",
        action="store_true",
        help="Fetch only standard common core projects (recommended first run)",
    )
    parser.add_argument(
        "--slug",
        type=str,
        help="Fetch a single project by slug (e.g., 'minishell' or '42cursus-libft')",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download PDFs even if they already exist locally",
    )
    parser.add_argument(
        "--env-file",
        type=str,
        default="tests/.env",
        help="Path to .env file containing UID, Secret, and INTRA_COOKIE",
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default="tests/42_subjects",
        help="Directory to save downloaded subjects and metadata",
    )
    args = parser.parse_args()

    # Load environment variables
    env_path = Path(args.env_file)
    if not env_path.is_file():
        logger.error(f"Environment file not found at {env_path.resolve()}")
        sys.exit(1)

    load_dotenv(dotenv_path=env_path)
    uid = os.getenv("UID")
    secret = os.getenv("SECRET") or os.getenv("Secret")  # noqa: SIM112
    cookie = os.getenv("INTRA_COOKIE") or os.getenv("intra_cookie")  # noqa: SIM112

    if not uid or not secret:
        logger.error("UID and Secret are required in .env")
        sys.exit(1)

    if not cookie:
        logger.error("INTRA_COOKIE is required in .env to discover subject download links")
        sys.exit(1)

    out_base = Path(args.out_dir)
    pdf_dir = out_base / "pdfs"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    metadata_file = out_base / "metadata.json"

    # Load existing metadata if available
    metadata: dict[str, Any] = {}
    if metadata_file.exists():
        try:
            metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
        except Exception:
            metadata = {}

    client = FortyTwoClient(uid=uid, secret=secret, cookie=cookie)

    # Determine list of projects to process
    projects_to_process: list[dict[str, str]] = []

    if args.slug:
        clean_slug = args.slug.strip()
        projects_to_process = [{"name": clean_slug, "slug": clean_slug}]
    elif args.core_only:
        logger.info(f"Running in --core-only mode ({len(CORE_PROJECT_SLUGS)} common-core subjects)")
        projects_to_process = [
            {"name": slug.replace("42cursus-", ""), "slug": slug} for slug in CORE_PROJECT_SLUGS
        ]
    else:
        # Full discovery mode: query cursus 21 projects
        try:
            discovered = client.fetch_cursus_projects(cursus_id=21)
            # Filter non-exam projects
            for p in discovered:
                if not p.get("exam", False):
                    projects_to_process.append(
                        {"name": p.get("name", p["slug"]), "slug": p["slug"]}
                    )
        except Exception as e:
            logger.error(
                f"Failed to fetch projects list from API: {e}. Falling back to core projects."
            )
            projects_to_process = [
                {"name": slug.replace("42cursus-", ""), "slug": slug} for slug in CORE_PROJECT_SLUGS
            ]

    logger.info(f"Total projects to check: {len(projects_to_process)}")
    downloaded_count = 0
    skipped_count = 0
    failed_count = 0

    for idx, item in enumerate(projects_to_process, 1):
        name = item["name"]
        slug = item["slug"]
        clean_name = slug.replace("42cursus-", "")
        dest_filename = f"{clean_name}.pdf"
        dest_path = pdf_dir / dest_filename

        logger.info(f"[{idx}/{len(projects_to_process)}] Processing '{name}' (slug: {slug})...")

        if dest_path.exists() and not args.force:
            logger.info(f"  Already exists locally -> {dest_filename} (skipping)")
            skipped_count += 1
            continue

        cdn_urls = client.find_subject_cdn_urls(slug)
        if not cdn_urls:
            logger.warning(f"  No subject CDN links found on Intra page for '{slug}'.")
            failed_count += 1
            continue

        chosen_url = pick_best_subject(cdn_urls)
        if not chosen_url:
            failed_count += 1
            continue

        logger.info(f"  Found CDN URL: {chosen_url}")
        success = client.download_pdf(chosen_url, dest_path)
        if success:
            downloaded_count += 1
            metadata[clean_name] = {
                "name": name,
                "slug": slug,
                "file": dest_filename,
                "cdn_url": chosen_url,
                "all_urls": cdn_urls,
                "downloaded_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            # Save metadata incrementally
            metadata_file.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        else:
            failed_count += 1

    logger.info("=" * 60)
    logger.info("Subject Fetching Completed!")
    logger.info(f"  Downloaded: {downloaded_count}")
    logger.info(f"  Skipped (already exists): {skipped_count}")
    logger.info(f"  Failed / No subject: {failed_count}")
    logger.info(f"  Subjects directory: {pdf_dir.resolve()}")
    logger.info(f"  Metadata catalog: {metadata_file.resolve()}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
