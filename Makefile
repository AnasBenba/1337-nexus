DOCKER ?= docker
COMPOSE = $(DOCKER) compose -p 1337-nexus --env-file deploy/.env -f deploy/docker-compose.yml
# 1. Run Stack
# Production / standard mode
up:
	$(COMPOSE) up -d --build
	$(COMPOSE) exec -u 0 backend python -m app.cli.ingest_subjects
# Development mode (adds hot reload mounts & exposed ports)
dev:
	$(COMPOSE) -f deploy/docker-compose.dev.yml up -d --build
down:
	$(COMPOSE) down
down-volumes:
	$(COMPOSE) down -v
# 2. List all containers
ps:
	$(COMPOSE) ps
# 3. Inspect stack volumes
volumes:
	$(DOCKER) volume ls --filter label=com.docker.compose.project=1337-nexus
	$(DOCKER) volume inspect $$($(DOCKER) volume ls -q --filter label=com.docker.compose.project=1337-nexus)
# 4. Inspect stack network
network:
	$(DOCKER) network inspect 1337-nexus_nexus
# 5. Logs (all containers)
logs:
	$(COMPOSE) logs -f
# Logs for each specific container
logs-backend:
	$(COMPOSE) logs -f backend
logs-postgres:
	$(COMPOSE) logs -f postgres
logs-nginx:
	$(COMPOSE) logs -f nginx
logs-prometheus:
	$(COMPOSE) logs -f prometheus
logs-grafana:
	$(COMPOSE) logs -f grafana
logs-postgres-exporter:
	$(COMPOSE) logs -f postgres-exporter
logs-nginx-exporter:
	$(COMPOSE) logs -f nginx-exporter
logs-node-exporter:
	$(COMPOSE) logs -f node-exporter
ingest:
	$(COMPOSE) exec -u 0 backend python -m app.cli.ingest_subjects
.lock:
	uv pip compile pyproject.toml --generate-hashes -o requirements.lock