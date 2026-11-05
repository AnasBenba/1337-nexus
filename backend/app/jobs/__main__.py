import asyncio

from app.jobs.worker import run_worker_cli

if __name__ == "__main__":
    asyncio.run(run_worker_cli())
