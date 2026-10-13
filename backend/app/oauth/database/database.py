import os
from sqlalchemy.ext.asyncio import create_async_engine

def Connect_TO_DB() :
    db_url = os.getenv("DATABASE_URL")
    print(db_url)
    engine = create_async_engine(db_url, pool_pre_ping=True)
    