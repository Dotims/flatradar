# FlatRadar

Watches new rental listings in Kraków on OLX and Otodom, drops the ones outside the
target area, works out the real monthly cost (rent + building fee + utilities mentioned
in the description) and pings Telegram when something lands in budget.

It exists because checking the same listings several times a day is a waste of time,
and the good ones in Kraków are gone within hours.

## Status

Early. Working: database schema and migrations.

## How it works

Both portals serve structured JSON, so there is no HTML parsing and no headless browser.

| Portal | Data source                     | What it gives                                                  |
| ------ | ------------------------------- | -------------------------------------------------------------- |
| OLX    | `/api/v1/offers/` (public API)  | price, building fee, district, description, publish date       |
| Otodom | `/_next/data/<buildId>/...json` | price, building fee, street, district, estate, advertiser type |
| Otodom | listing page                    | exact coordinates (`radius: 0`), full description              |

## Stack

Node 26 + TypeScript with no build step (Node runs `.ts` natively). Storage is SQLite
through the built-in `node:sqlite` module, so the project has no native dependencies.

## Running it

```bash
pnpm install
pnpm --filter @flatradar/collector migrate   # creates data/flatradar.db
pnpm --filter @flatradar/collector status    # prints what is in the database
```

Quality gate before committing:

```bash
pnpm check   # prettier + eslint + tsc + tests
```

## Layout

```
apps/collector/       fetching, normalising, classifying, notifying
  src/db/             schema and migrations
```

## License

MIT
