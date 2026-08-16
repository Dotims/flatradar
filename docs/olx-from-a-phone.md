# Collecting OLX from a phone

A standby since 2026-08-16, not the arrangement: the cloud round collects OLX again.

For a week OLX answered 403 to anything from a datacenter address, verified against seven
request variants including a browser user agent and the plain homepage. Measured again on
2026-08-16, our own client gets a 200 from GitHub Actions while curl from the same runner
is still refused, so the refusal turned out to be about the shape of the client rather
than the address alone. It can come back, which is why this page stays.

The browser cannot do it either: the OLX API sends no `Access-Control-Allow-Origin`, so a
page on another origin may not read the response. A button on the dashboard is therefore
impossible for OLX, and syncs Otodom instead.

A phone app is not a browser and has no such restriction. It fetches from an ordinary
connection and posts the result here.

## The Shortcut (iOS)

Two actions, both **Get Contents of URL**:

**1. Fetch**

```
GET https://www.olx.pl/api/v1/offers/?offset=0&limit=50&category_id=15&city_id=8959&sort_by=created_at:desc
```

**2. Post it here**

```
POST https://<your-deployment>/api/ingest/olx
Headers:  Content-Type: application/json
          x-overheads-token: <INGEST_TOKEN>
Body:     the result of action 1, as JSON
```

Add the Shortcut to the home screen and it is a button. iOS has no interval automation,
so for anything unattended use time-of-day triggers or events like arriving home or
connecting a charger.

## From a computer

```bash
curl -s 'https://www.olx.pl/api/v1/offers/?offset=0&limit=50&category_id=15&city_id=8959&sort_by=created_at:desc' \
  | curl -s -X POST http://127.0.0.1:4317/api/ingest/olx \
      -H 'Content-Type: application/json' \
      -H "x-overheads-token: $INGEST_TOKEN" --data-binary @-
```

Or just `pnpm collect`, which does the same thing directly.

## Why a token

The endpoint writes to the database and is reachable from the internet once deployed. It
fails closed: with `INGEST_TOKEN` unset, nothing may write at all.
