# syntax=docker/dockerfile:1
# Multi-stage build for Next.js standalone output.
# Built natively on the OCI ARM (aarch64) instance — no cross-compilation needed.

FROM node:22-alpine AS deps
WORKDIR /app
# HUSKY=0 skips the "prepare": "husky" script — .git is not in the build context.
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
# BUILD_STANDALONE switches next.config.js to output: 'standalone', which is what
# produces the .next/standalone/server.js the runner stage below starts. Vercel builds
# the same repo without it — see the comment in next.config.js.
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* variables are inlined into the client bundle at build time,
# so they must arrive as build args — runtime env vars are too late for them.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_PAYMENT_BANK_ID
ARG NEXT_PUBLIC_PAYMENT_ACCOUNT_NO
ARG NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_PAYMENT_BANK_ID=$NEXT_PUBLIC_PAYMENT_BANK_ID \
    NEXT_PUBLIC_PAYMENT_ACCOUNT_NO=$NEXT_PUBLIC_PAYMENT_ACCOUNT_NO \
    NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME=$NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
