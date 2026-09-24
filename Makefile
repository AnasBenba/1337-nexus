# 1337 Nexus Makefile

SHELL := /bin/bash

DOCKER ?= docker
ENV_FILE := deploy/.env
COMPOSE_FILE := deploy/docker-compose.yml
DEV_COMPOSE_FILE := deploy/docker-compose.dev.yml

COMPOSE := $(DOCKER) compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)
DEV_COMPOSE := $(COMPOSE) -f $(DEV_COMPOSE_FILE)

BACKUP_SCRIPT := deploy/scripts/backup.sh
PERF_SCRIPT := deploy/scripts/perf-smoke.sh

.PHONY: \
	help \
	validate \
	dev-validate \
	dev \
	dev-build \
	down \
	ps \
	logs \
	logs-backend \
	logs-postgres \
	logs-nginx \
	postgres \
	backup \
	perf \
	lint \
	types \
	test \
	frontend-test \
	migrate \
	seed \
	ingest \
	gen-api \
	clean
help:
	@echo "1337 Nexus commands:"
	@echo "  make validate       Validate base Compose"
	@echo "  make dev-validate   Validate base + dev Compose"
	@echo "  make dev            Start development stack"
	@echo "  make dev-build      Build and start development stack"
	@echo "  make down           Stop development stack"
	@echo "  make ps             Show service status"
	@echo "  make logs           Follow all logs"
	@echo "  make logs-backend   Follow backend logs"
	@echo "  make logs-postgres  Follow PostgreSQL logs"
	@echo "  make logs-nginx     Follow Nginx logs"
	@echo "  make postgres       Start only PostgreSQL"
	@echo "  make backup         Run backup script"
	@echo "  make perf           Run performance smoke test"
	@echo "  make lint           Run Ruff"
	@echo "  make types          Run mypy"
	@echo "  make test           Run backend pytest"
	@echo "  make frontend-test  Run frontend Vitest"
	@echo "  make migrate        Run Alembic migrations"
	@echo "  make seed           Run seed command"
	@echo "  make ingest         Ingest curriculum subjects"
	@echo "  make gen-api        Export OpenAPI"
	@echo
	@echo 'Use DOCKER="sudo docker" if Docker requires sudo.'

validate:
	$(COMPOSE) config

dev-validate:
	$(DEV_COMPOSE) config

dev:
	$(DEV_COMPOSE) up

dev-build:
	$(DEV_COMPOSE) up --build

down:
	$(DEV_COMPOSE) down

ps:
	$(DEV_COMPOSE) ps

logs:
	$(DEV_COMPOSE) logs -f

logs-backend:
	$(DEV_COMPOSE) logs -f backend

logs-postgres:
	$(DEV_COMPOSE) logs -f postgres

logs-nginx:
	$(DEV_COMPOSE) logs -f nginx

postgres:
	$(COMPOSE) up -d postgres

backup:
	sudo ./$(BACKUP_SCRIPT)

perf:
	sudo ./$(PERF_SCRIPT)

lint:
	cd backend && python -m ruff check .

types:
	cd backend && python -m mypy .

test:
	cd backend && python -m pytest

frontend-test:
	cd frontend && npm run test

migrate:
	$(DEV_COMPOSE) exec backend alembic upgrade head

seed:
	$(DEV_COMPOSE) exec backend python -m app.cli.seed

ingest:
	$(DEV_COMPOSE) exec backend python -m app.cli.ingest_subjects

gen-api:
	$(DEV_COMPOSE) exec backend python -m app.cli.export_openapi

clean:
	$(DEV_COMPOSE) down --remove-orphans
