DOCKER ?= docker
COMPOSE = $(DOCKER) compose -p 1337-nexus --env-file deploy/.env -f deploy/docker-compose.yml

.PHONY: up down down-volumes ps volumes network logs ingest lock \
        up-postgres up-backend up-nginx up-prometheus up-grafana \
        up-postgres-exporter up-nginx-exporter up-node-exporter \
        logs-postgres logs-backend logs-nginx logs-prometheus logs-grafana \
        logs-postgres-exporter logs-nginx-exporter logs-node-exporter

# 1. Run Complete Stack (Production mode)
up:
	$(COMPOSE) up -d --build
	$(COMPOSE) exec -u 0 backend python -m app.cli.ingest_subjects

down:
	$(COMPOSE) down

down-volumes:
	$(COMPOSE) down -v

# 2. Run Individual Containers
up-postgres:
	$(COMPOSE) up -d --build postgres

up-backend:
	$(COMPOSE) up -d --build backend

up-nginx:
	$(COMPOSE) up -d --build nginx

up-prometheus:
	$(COMPOSE) up -d --build prometheus

up-grafana:
	$(COMPOSE) up -d --build grafana

up-postgres-exporter:
	$(COMPOSE) up -d --build postgres-exporter

up-nginx-exporter:
	$(COMPOSE) up -d --build nginx-exporter

up-node-exporter:
	$(COMPOSE) up -d --build node-exporter

# 3. List all containers
ps:
	$(COMPOSE) ps

# 4. Inspect stack volumes
volumes:
	$(DOCKER) volume ls --filter label=com.docker.compose.project=1337-nexus
	$(DOCKER) volume inspect $$($(DOCKER) volume ls -q --filter label=com.docker.compose.project=1337-nexus)

# 5. Inspect stack network
network:
	$(DOCKER) network inspect 1337-nexus_nexus

# 6. Logs (all containers)
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

lock:
	uv pip compile backend/pyproject.toml --generate-hashes -o backend/requirements.lock
