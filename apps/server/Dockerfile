# Build from the repository root: docker build -f apps/server/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# The lockfile lists every workspace, so their manifests must be present even though only the server is installed.
COPY apps/desktop/package.json apps/desktop/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --workspace @pantry/server --include-workspace-root=false --omit=dev
COPY packages/shared packages/shared
COPY apps/server apps/server
WORKDIR /app/apps/server
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
USER node
CMD ["npx", "tsx", "src/index.ts"]
