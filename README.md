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

| Portal | Data source                     | What it gives                                                   |
| ------ | ------------------------------- | --------------------------------------------------------------- |
| OLX    | `/api/v1/offers/` (public API)  | price, building fee, district, description, blurred coordinates |
| Otodom | `/_next/data/<buildId>/...json` | price, building fee, street, district, advertiser type          |
| Otodom | listing page                    | exact coordinates (`radius: 0`), full description               |

Otodom publishes no API. What it does publish is the data endpoint Next.js serves its
own pages from, which is the same payload without the HTML. The `buildId` in that path
changes on every deploy of theirs, so it is scraped from the search page and refreshed
when a request comes back 404.

Otodom search results carry no description and no coordinates, and both cost a request
per listing. They are fetched only for listings that could still reach a tier, which on
a normal run is a handful out of seventy.

## Stack

Node 26 + TypeScript with no build step (Node runs `.ts` natively). Storage is Postgres
on Neon, reached through `postgres`, which is pure JavaScript: the project has no native
dependencies.

## Running it

```bash
pnpm install
cp .env.example .env                            # then put your Neon connection string in it
pnpm --filter @flatradar/collector migrate      # creates the schema
pnpm --filter @flatradar/collector collect:olx     # fetches and stores OLX listings
pnpm --filter @flatradar/collector collect:otodom # same for Otodom
pnpm --filter @flatradar/collector classify     # judges what is stored, no network
pnpm --filter @flatradar/collector status       # prints what is in the database
```

The dashboard needs two terminals: the API reads the database, the dev server serves the
page and proxies `/api` to it.

```bash
pnpm --filter @flatradar/collector serve   # http://127.0.0.1:4317
pnpm --filter @flatradar/web dev           # http://localhost:4318
```

Filters live in the browser: full monthly cost, minimum floor area, tier, district and
private advertisers only. The whole set is a few hundred rows, so it is sent once and
filtered in memory rather than queried per keystroke.

Quality gate before committing:

```bash
pnpm check   # prettier + eslint + tsc + tests
```

## Layout

```
apps/collector/       fetching, normalising, classifying, serving the API
  src/sources/        one folder per portal, each producing a NormalizedOffer
  src/domain/         the rules: districts, costs, tiers. No database, no network.
  src/db/             schema, migrations and checked row readers
  src/commands/       what the pnpm scripts run
apps/web/             the dashboard
```

## License

MIT
