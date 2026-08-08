# FlatRadar

Watches new rental listings in Kraków on OLX and Otodom, drops the ones outside the
target area, works out the real monthly cost (rent + building fee + utilities mentioned
in the description) and pings Telegram when something lands in budget.

It exists because checking the same listings several times a day is a waste of time,
and the good ones in Kraków are gone within hours.

## Status

Early. Working: OLX collection and classification into tiers. Missing: Otodom, Telegram,
the dashboard.

## Tiers

A listing is judged on two numbers. `worth` means the advertised rent alone is at or
below 2200 PLN. `top` means the full monthly cost, rent plus building fee plus utilities,
is at or below 2600 PLN. Districts outside the target area are rejected first, whatever
they cost.

The building fee and utilities are the awkward part. Portals report the fee as a number
when the advertiser bothers to fill it in, and describe utilities in prose when they
mention them at all. A listing that gives no fee is judged on an assumed 400 PLN, which
is roughly what a Kraków flat costs to run, unless the description says the price covers
everything or that there is no fee. Every verdict carries a `cost_certainty` saying
whether its total was read or assumed, and a list of reasons in plain words.

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
pnpm --filter @flatradar/collector migrate      # creates data/flatradar.db
pnpm --filter @flatradar/collector collect:olx  # fetches and stores listings
pnpm --filter @flatradar/collector classify     # judges what is stored, no network
pnpm --filter @flatradar/collector status       # prints what is in the database
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
