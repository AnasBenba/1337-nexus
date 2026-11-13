FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN useradd -m app

COPY backend/requirements.lock /tmp/requirements.lock
RUN pip install --require-hashes --no-cache-dir -r /tmp/requirements.lock \
    && rm /tmp/requirements.lock

COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY backend/entrypoint.sh ./entrypoint.sh
COPY backend/content ./content

# /media is the shared media volume (nginx serves it read-only); the app writes avatars there.
RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /media/avatars \
    && chown -R app:app /app /media
RUN chmod +x /app/entrypoint.sh && chown -R app:app /app

USER app
EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]