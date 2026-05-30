FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

# Copy the built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Config template — BACKEND_URL_PLACEHOLDER replaced at startup by entrypoint.sh
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Startup script that injects BACKEND_URL and launches nginx
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
