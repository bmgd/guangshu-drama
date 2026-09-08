# 多阶段构建：前端静态 + 后端 API 单镜像
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run generate

FROM node:20-slim AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
COPY --from=frontend-build /app/frontend/.output/public ../frontend/dist
RUN npm run typecheck || true

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/.output/public ./frontend/dist
COPY backend/workspace ./backend/workspace
ENV NODE_ENV=production
ENV PORT=5679
ENV DATABASE_URL=postgres://guangshu:guangshu@postgres:5432/guangshu_drama
ENV STORAGE_PATH=/app/data/static
VOLUME ["/app/data", "/app/backend/workspace"]
EXPOSE 5679
WORKDIR /app/backend
CMD ["npm", "start"]
