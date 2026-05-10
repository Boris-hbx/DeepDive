# syntax=docker/dockerfile:1
# Build context = experiments/Boris/  (so this image can pull in
# daily-report/ and prompts/ which live one level above site/).
# Multi-stage build for Next.js standalone output (output: 'standalone').

FROM node:20-alpine AS base

# ----- deps -----
FROM base AS deps
WORKDIR /app
COPY site/package.json site/package-lock.json* ./
RUN npm ci

# ----- builder -----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY site/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ----- runner -----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Data files live outside the standalone bundle; expose their absolute paths
# so reports.ts / claude.ts pick them up via env (dev fallback unchanged).
ENV REPORTS_DIR=/app/data/daily-report
ENV PROMPTS_DIR=/app/data/prompts

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# external data: bake md + prompts into the image (no DB, no remote fetch)
COPY --chown=nextjs:nodejs daily-report ./data/daily-report
COPY --chown=nextjs:nodejs prompts ./data/prompts

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
