FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm install
RUN npm run build --workspace=@netsentry/shared
RUN npm run build --workspace=@netsentry/web

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@netsentry/web"]
