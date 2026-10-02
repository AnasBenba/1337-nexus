#bin/bash

 sudo docker compose \
  --env-file deploy/.env \
  -f deploy/docker-compose.yml \
  down -v

sudo docker compose \
--env-file deploy/.env \
-f deploy/docker-compose.yml \
-f deploy/docker-compose.dev.yml \
up --build postgres backend