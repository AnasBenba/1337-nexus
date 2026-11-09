# 1337 Nexus Makefile

SHELL := /bin/bash

DOCKER ?=  docker
# ENV_FILE := deploy/.env
COMPOSE_FILE := deploy/docker-compose.yml
DEV_COMPOSE_FILE := deploy/docker-compose.dev.yml

COMPOSE := $(DOCKER) compose -f $(COMPOSE_FILE)
DEV_COMPOSE := $(COMPOSE) -f $(DEV_COMPOSE_FILE)

BACKUP_SCRIPT := deploy/scripts/backup.sh
PERF_SCRIPT := deploy/scripts/perf-smoke.sh

PYTHON_VERSION ?= python3.12
VENV := backend/.venv
PYTHON := $(VENV)/bin/python

.PHONY: \
	all \
	start \
	help \
	validate \
	dev-validate \
	dev \
	dev-build \
	dev-wait \
	down \
	down-volumes \
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
	frontend-dev \
	frontend-build \
	frontend-test \
	migrate \
	seed \
	ingest \
	gen-api \
	setup \
	clean

.DEFAULT_GOAL := start

all: start

start: dev-build dev-wait migrate ingest
	@echo ""
	@echo "======================================================================"
	@echo " 🚀 1337 Nexus Development Stack is UP & READY!"
	@echo "======================================================================"
	@echo " • Frontend (Nginx HTTPS): https://localhost:8443 (or https://localhost)"
	@echo " • Backend API & Swagger:  http://localhost:8000/docs"
	@echo " • Backend Health:         http://localhost:8000/health/ready"
	@echo " • PostgreSQL Port:        localhost:5433"
	@echo "----------------------------------------------------------------------"
	@echo " Useful commands:"
	@echo " • View all logs:          make logs"
	@echo " • View backend logs:      make logs-backend"
	@echo " • View frontend/nginx:    make logs-nginx"
	@echo " • Run frontend dev server:make frontend-dev (Vite HMR on :5173)"
	@echo " • Stop stack:             make down"
	@echo "======================================================================"

help:
	@echo "1337 Nexus commands:"
	@echo "  make                Start full stack (backend, frontend, db, migrations, ingest)"
	@echo "  make start          Alias for starting the full stack"
	@echo "  make dev            Start development stack in foreground"
	@echo "  make dev-build      Build and start development stack in background"
	@echo "  make down           Stop development stack"
	@echo "  make down-volumes   Stop stack and remove volumes"
	@echo "  make ps             Show service status"
	@echo "  make logs           Follow all logs"
	@echo "  make logs-backend   Follow backend logs"
	@echo "  make logs-postgres  Follow PostgreSQL logs"
	@echo "  make logs-nginx     Follow Nginx logs"
	@echo "  make postgres       Start only PostgreSQL"
	@echo "  make frontend-dev   Start frontend Vite dev server (HMR on port 5173)"
	@echo "  make frontend-build Build frontend production bundle"
	@echo "  make frontend-test  Run frontend Vitest"
	@echo "  make backup         Run backup script"
	@echo "  make perf           Run performance smoke test"
	@echo "  make lint           Run Ruff"
	@echo "  make types          Run mypy"
	@echo "  make test           Run backend pytest"
	@echo "  make migrate        Run Alembic migrations"
	@echo "  make seed           Run seed command"
	@echo "  make ingest         Ingest curriculum subjects"
	@echo "  make gen-api        Export OpenAPI"
	@echo "  make validate       Validate base Compose"
	@echo "  make dev-validate   Validate base + dev Compose"
	@echo
	@echo 'Use DOCKER="sudo docker" if Docker requires sudo.'

validate:
	$(COMPOSE) config

dev-validate:
	$(DEV_COMPOSE) config

dev:
	$(DEV_COMPOSE) up

dev-build:
	$(DEV_COMPOSE) up --build -d

dev-wait:
	@echo "Waiting for backend service to become ready..."
	@for i in $$(seq 1 30); do \
		if curl -s http://localhost:8000/health/ready 2>/dev/null | grep -q 'ready'; then \
			echo "Backend is ready!"; \
			break; \
		fi; \
		sleep 1; \
	done

down:
	$(DEV_COMPOSE) down

down-volumes:
	$(DEV_COMPOSE) down -v

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
	cd backend && (test -x .venv/bin/ruff && .venv/bin/ruff check . || python3 -m ruff check .)

types:
	cd backend && (test -x .venv/bin/mypy && .venv/bin/mypy . || python3 -m mypy .)

test:
	cd backend && (test -x .venv/bin/pytest && .venv/bin/pytest || python3 -m pytest)

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && npm run test

migrate:
	$(DEV_COMPOSE) exec backend alembic upgrade head

seed:
	$(DEV_COMPOSE) exec backend python -m app.cli.seed

ingest:
	$(DEV_COMPOSE) exec -u 0 backend python -m app.cli.ingest_subjects

gen-api:
	$(DEV_COMPOSE) exec backend python -m app.cli.export_openapi

setup:
	@command -v $(PYTHON_VERSION) >/dev/null 2>&1 || \
		{ echo "ERROR: $(PYTHON_VERSION) is required but was not found."; exit 1; }

	@if [ ! -x "$(PYTHON)" ] || ! "$(PYTHON)" --version 2>/dev/null | grep -q '^Python 3\.12\.'; then \
		echo "Creating Python 3.12 virtual environment..."; \
		rm -rf "$(VENV)"; \
		$(PYTHON_VERSION) -m venv "$(VENV)"; \
	else \
		echo "Python 3.12 virtual environment already exists."; \
	fi

	@$(PYTHON) -m pip install --upgrade pip
	@$(PYTHON) -m pip install -e "backend[dev]"

	@echo
	@echo "Python development environment is ready."
	@echo "Python: $$($(PYTHON) --version)"

clean:
	$(DEV_COMPOSE) down --remove-orphans