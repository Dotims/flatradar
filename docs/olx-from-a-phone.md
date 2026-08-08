# Collecting OLX from a phone

OLX answers 403 to anything from a datacenter address, verified against seven request
variants including a browser user agent and the plain homepage. The block is at the edge,
by address, before any header is read, so nothing about the request can change the answer.

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
          x-flatradar-token: <INGEST_TOKEN>
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
      -H "x-flatradar-token: $INGEST_TOKEN" --data-binary @-
```

Or just `pnpm collect`, which does the same thing directly.

## Why a token

The endpoint writes to the database and is reachable from the internet once deployed. It
fails closed: with `INGEST_TOKEN` unset, nothing may write at all.
