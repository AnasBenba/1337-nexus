#!/usr/bin/env bash
set -e
# Target container name
CONTAINER="deploy-backend-1"
# 1. Verify that the backend container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "❌ Error: Container '${CONTAINER}' is not running."
    echo "💡 Run 'cd deploy && docker compose up -d' first."
    exit 1
fi
# Helper function to run alembic inside the container
run_alembic() {
    docker exec -w /app "${CONTAINER}" alembic "$@"
}
# 2. Check for multiple heads (branch divergence)
# When two branches create migrations independently, Alembic sees multiple 'heads'.
HEAD_COUNT=$(run_alembic heads | grep -c "(head)" || true)
if [ "$HEAD_COUNT" -gt 1 ]; then
    echo "⚠️ Detected ${HEAD_COUNT} divergent heads. Auto-merging heads..."
    run_alembic merge heads -m "auto_merge_heads"
    echo "✅ Heads merged successfully."
fi
# 3. Decision: Create a new migration OR just upgrade?
MIGRATION_MESSAGE="$1"
if [ -n "$MIGRATION_MESSAGE" ]; then
    echo "📦 1/2: Generating new migration: '${MIGRATION_MESSAGE}'..."
    run_alembic revision --autogenerate -m "${MIGRATION_MESSAGE}"
    
    echo "🚀 2/2: Applying migration to database..."
    run_alembic upgrade head
    echo "🎉 Migration created and applied to database!"
else
    echo "🚀 Applying pending migrations to head..."
    run_alembic upgrade head
    echo "🎉 Database is up to date!"
fi
# 4. Display the current database state
echo ""
echo "📊 Current Database Revision:"
run_alembic current