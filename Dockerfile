# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ⭐ NHẬN ENV TỪ GITLAB CI
ARG NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC
ENV NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC=$NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3423
USER app
CMD ["npm", "run", "start"]
