# =============================================================================
# Makefile - 1337 Nexus Backend
# =============================================================================
# Dynamically resolves uv from PATH first, then falls back to ~/.local/bin/uv
# so any team member can run targets without hardcoding paths.
#
# Usage:
#   make install     - create .venv and install all deps (incl. dev)
#   make test        - run the full test suite
#   make test-v      - run tests with verbose output
#   make test-cov    - run tests with coverage report
#   make lint        - run ruff linter
#   make fmt         - auto-format with ruff
#   make typecheck   - run mypy
#   make clean       - remove .venv and caches
# =============================================================================

# Resolve uv: prefer uv already on PATH, fall back to default install location.
UV := $(shell command -v uv 2>/dev/null || echo $${HOME}/.local/bin/uv)
UV_EXISTS := $(shell $(UV) --version 2>/dev/null && echo yes || echo no)

.PHONY: _require-uv
_require-uv:
ifeq ($(UV_EXISTS), no)
	@echo ""
	@echo "  uv not found. Install it with:"
	@echo "     curl -LsSf https://astral.sh/uv/install.sh | sh"
	@echo "  then restart your shell or run: source ~/.local/bin/env"
	@echo ""
	@exit 1
endif

.PHONY: install
install: _require-uv
	$(UV) sync --dev

.PHONY: test
test: _require-uv
	$(UV) run pytest tests/

.PHONY: test-v
test-v: _require-uv
	$(UV) run pytest tests/ -v

.PHONY: test-cov
test-cov: _require-uv
	$(UV) run pytest tests/ --cov=app --cov-report=term-missing

.PHONY: lint
lint: _require-uv
	$(UV) run ruff check .

.PHONY: fmt
fmt: _require-uv
	$(UV) run ruff format .

.PHONY: typecheck
typecheck: _require-uv
	$(UV) run mypy app/

.PHONY: clean
clean:
	rm -rf .venv .pytest_cache .mypy_cache .ruff_cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
