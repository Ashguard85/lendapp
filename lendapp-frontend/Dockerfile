# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

# Dependencies separat für besseres Caching
COPY package.json ./
RUN npm install --legacy-peer-deps --prefer-offline

# Quellcode kopieren
COPY . .

# Build-Umgebung
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV CI=false
ENV GENERATE_SOURCEMAP=false
ENV DISABLE_ESLINT_PLUGIN=true
ENV TSC_COMPILE_ON_ERROR=true
ENV SKIP_PREFLIGHT_CHECK=true

# Build mit vollem Output damit Fehler sichtbar sind
RUN npm run build || (echo "BUILD FAILED" && cat /tmp/npm-*.log 2>/dev/null && exit 1)

# Stage 2: nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
