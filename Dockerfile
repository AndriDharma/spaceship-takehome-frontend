# ------------------------------------------------------------
# Build
# ------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Vite inlines environment variables at build time, so the backend URL has to
# be present now - setting it on the Cloud Run service later would do nothing.
#
#   docker build --build-arg VITE_API_BASE=https://backend-xxxx.run.app .
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# ------------------------------------------------------------
# Serve
# ------------------------------------------------------------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run injects PORT; defaulted so the image also runs locally.
ENV PORT=8080
EXPOSE 8080
