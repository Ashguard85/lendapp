# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json ./
# overrides erzwingen saubere ajv-Versionen
RUN npm install --legacy-peer-deps
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=2048
ENV CI=false
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
