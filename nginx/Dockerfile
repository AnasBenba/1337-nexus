ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS frontend-build

WORKDIR /src

COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN npm ci --prefix frontend

COPY frontend ./frontend

RUN npm run build --prefix frontend


ARG NGINX_IMAGE=nginx:1.27-alpine

FROM ${NGINX_IMAGE}

COPY --from=frontend-build /src/frontend/dist /usr/share/nginx/html