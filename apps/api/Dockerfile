# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PNPM_HOME=/pnpm
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @guildhub/api...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @guildhub/api... build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @guildhub/api deploy --prod /out

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    INSTANCE_DIR=/app/instance
COPY --from=build --chown=node:node /out ./
COPY --chown=node:node instances/traceless ./instance
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/live').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "./instrumentation-loader.mjs", "dist/index.js"]
