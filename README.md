# Pantry Tracker

Self-hosted home pantry and fridge inventory. Scan barcodes to add and use stock, and get a shopping list
built from per-item thresholds plus a usage forecast. Everything runs on your own hardware against your own
Postgres server.

| Part | Path | Stack |
| --- | --- | --- |
| API server | `apps/server` | Node 22, Fastify, `pg`, plain SQL migrations |
| Desktop app | `apps/desktop` | Electron + React (Vite); works with USB barcode scanners |
| iPhone app | `apps/mobile` | Expo (React Native) + `expo-camera` barcode scanning |
| Shared types + API client | `packages/shared` | TypeScript |

## 1. Prepare Postgres

On your Postgres server, create a role and database (any names work):

```sql
CREATE ROLE pantry LOGIN PASSWORD 'change-me';
CREATE DATABASE pantry OWNER pantry;
```

Make sure `pg_hba.conf` allows the machine that will run the API server. The server creates its tables on
first start; there is nothing else to run.

## 2. Run the API server

```sh
npm install                      # once, from the repo root
cp apps/server/.env.example apps/server/.env   # then edit the PG* values
npm run server                   # dev mode with reload
```

Configuration (environment variables, read from `apps/server/.env` with Docker, or your shell otherwise):

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | – | Full connection string; overrides the `PG*` variables |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE` | libpq defaults | Standard Postgres settings |
| `HOST` / `PORT` | `0.0.0.0` / `8080` | Where the API listens |
| `API_TOKEN` | unset | Shared secret; when set, both apps must be given it in Settings |
| `PRODUCT_LOOKUP` | `true` | Look up names of unknown barcodes on Open Food Facts. `false` keeps the server fully offline |

Without Docker, load the env file yourself, e.g. `set -a; . apps/server/.env; set +a; npm run server`.

To run it permanently with Docker (API only; it uses your existing Postgres):

```sh
docker compose up -d --build
```

Or as a plain process: `npm start -w @pantry/server` under systemd, pm2, etc.

Check it: `curl http://<server-ip>:8080/api/health` should print `{"ok":true,"database":true}`.

## 3. Desktop app

```sh
npm run desktop                       # dev mode (Vite + Electron)
npm run dist -w @pantry/desktop       # installer for this OS in apps/desktop/release/
```

Open **Settings**, enter `http://<server-ip>:8080`, and press **Test connection**. On the **Scan** tab the
input stays focused, so a USB or Bluetooth scanner (which types the code and presses Enter) works hands-free.

## 4. iPhone app

The quickest route is Expo Go (free, App Store):

```sh
npm run mobile     # starts the Expo dev server and prints a QR code
```

Scan the QR code with the iPhone camera while the phone is on the same Wi-Fi. In the app, open **Settings**,
enter `http://<server-ip>:8080`, and press **Connect**.

For a permanent install that doesn't need the dev server running, build it once with Xcode on a Mac:

```sh
cd apps/mobile
npx expo run:ios --device --configuration Release
```

A free Apple ID works but the app must be re-signed every 7 days; a paid developer account lasts a year.
`app.json` allows plain HTTP so the app can talk to a home server without a certificate.

## How the shopping list works

Each item has a **minimum** (the trigger) and a **target** (what to restock up to). The server averages
usage from scan-outs over the usage window (default 30 days) and projects stock forward by the look-ahead
(default 7 days). An item is listed when its current or projected quantity is at or below its minimum,
unless shopping is turned off for it or it is snoozed. Suggested amount = target − projected stock, at
least 1. Items without a minimum use the global default. All three globals are editable in Settings.

## Development

```sh
npm run typecheck
TEST_DATABASE_URL=postgres://user@localhost/pantry_test npm test   # wipes that database
```

API endpoints are listed in `packages/shared/src/client.ts`; migrations live in `apps/server/migrations`
and run on server start (add `002_*.sql` and so on for changes).
