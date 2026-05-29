# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
# Deaktiviere fork-ts-checker (nur für TypeScript, nicht benötigt)
RUN sed -i 's/new ForkTsCheckerWebpackPlugin/\/\/ new ForkTsCheckerWebpackPlugin/g' \
    node_modules/react-scripts/config/webpack.config.js || true
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=2048
ENV CI=false
ENV GENERATE_SOURCEMAP=false
ENV TSC_COMPILE_ON_ERROR=true
ENV DISABLE_ESLINT_PLUGIN=true
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
