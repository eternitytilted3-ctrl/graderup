# GraderUP — production image (Next.js server + migration/seed scripts).
FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies (dev deps are needed for the build and for tsx-based migrate/seed scripts).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Test server builds: separate cookie names (same host, other port) and SITE_MODE=test (banner, noindex).
ARG NEXT_PUBLIC_COOKIE_PREFIX=gu
ARG SITE_MODE=live
ENV NEXT_PUBLIC_COOKIE_PREFIX=$NEXT_PUBLIC_COOKIE_PREFIX SITE_MODE=$SITE_MODE
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Apply pending migrations on every start, then serve on all interfaces.
CMD ["sh", "-c", "npm run db:migrate && npx next start -H 0.0.0.0 -p ${PORT}"]
