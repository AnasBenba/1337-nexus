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

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/nexus.conf /etc/nginx/conf.d/nexus.conf
COPY nginx/entrypoint.sh /usr/local/bin/nginx-entrypoint.sh

RUN chmod 755 /usr/local/bin/nginx-entrypoint.sh \
    && mkdir -p /tmp/nginx/tls \
       /tmp/client_temp \
       /tmp/proxy_temp \
       /tmp/fastcgi_temp \
       /tmp/uwsgi_temp \
       /tmp/scgi_temp \
    && chown -R nginx:nginx /tmp/nginx /tmp/client_temp /tmp/proxy_temp \
       /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
    && chown -R nginx:nginx /usr/share/nginx/html

USER nginx

ENTRYPOINT ["/usr/local/bin/nginx-entrypoint.sh"]