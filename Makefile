UV := /opt/pyenv/versions/3.13.1/bin/uv

UV_CACHE_DIR := /tmp/uv-cache
UV_PYTHON_INSTALL_DIR := /tmp/uv-python
UV_PROJECT_ENVIRONMENT := /tmp/1337-nexus-venv

BACKEND := backend

export UV_CACHE_DIR
export UV_PYTHON_INSTALL_DIR
export UV_PROJECT_ENVIRONMENT

.PHONY: setup sync run clean

setup:
	@mkdir -p $(UV_CACHE_DIR) $(UV_PYTHON_INSTALL_DIR)
	$(UV) python install 3.12
	cd $(BACKEND) && $(UV) sync

sync:
	cd $(BACKEND) && $(UV) sync

run: setup
	cd $(BACKEND) && $(UV) run python -m app.cli.ingest_subjects

clean:
	rm -rf $(UV_CACHE_DIR) $(UV_PYTHON_INSTALL_DIR) $(UV_PROJECT_ENVIRONMENT)
