# Equipa — Industrial Equipment Rental MVP

Monorepo for a Brazilian B2B equipment rental system:

- `apps/api` — NestJS + Prisma + PostgreSQL
- `apps/web` — Next.js (pt-BR / EN)

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 16 (local or Docker)

Default database URL:

```text
postgresql://equipa:equipa@localhost:5432/equipa?schema=public
```

## Quick start (local Postgres)

```bash
# 1) Create role/db (once)
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'equipa') THEN
    CREATE ROLE equipa LOGIN PASSWORD 'equipa';
  END IF;
END
$$;
SELECT 'CREATE DATABASE equipa OWNER equipa'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'equipa')\gexec
GRANT ALL PRIVILEGES ON DATABASE equipa TO equipa;
SQL

# 2) Install + migrate + seed
pnpm install
pnpm db:setup

# 3) Run API (3001) and web (3000)
pnpm --filter @equipa/api dev
pnpm --filter @equipa/web dev
```

Or from the root: `pnpm dev`.

## Docker Postgres (optional)

```bash
docker compose up -d postgres
pnpm install
pnpm db:setup
pnpm dev
```

## Demo login

- URL: http://localhost:3000/login
- Email: `admin@equipa.com.br`
- Password: `admin123`

## Seed highlights

- 3 branches (SP-01, RJ-01, MG-01)
- 10 machines
- Weekly / monthly / yearly pricing
- Contract renewal with period change (YEARLY → MONTHLY)
- Invoice with PIX + boleto payments
- Mock NFS-e authorization

## API smoke test

```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@equipa.com.br","password":"admin123"}'
```

## Language

Use the **PT | EN** control on the login card or in the app sidebar. Preference persists in `localStorage` (`equipa_locale`). Currency stays BRL.
