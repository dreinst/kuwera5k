# Image untuk server sendiri (Coolify di VPS). Vercel tidak memakai file ini.
FROM node:24-slim AS deps
WORKDIR /app
# prisma.config.ts mewajibkan DATABASE_URL terisi walau generate tidak menyambung ke database.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* ditanam ke bundel browser saat build, jadi harus tersedia di tahap ini.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
# SITE_NOINDEX=1 untuk salinan uji supaya tidak diindeks mesin pencari.
ARG SITE_NOINDEX
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
