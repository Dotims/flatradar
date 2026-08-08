-- Facts as reported by the portal. Nothing here reflects our own opinion or price
-- thresholds, so changing the criteria never requires fetching the listings again.
create table offers (
  id                integer generated always as identity primary key,
  source            text        not null check (source in ('olx', 'otodom')),
  source_id         text        not null,
  url               text        not null,
  title             text        not null,
  description       text,

  -- Whole PLN. Both portals report rent and building fee as separate numbers.
  price_pln         integer,
  rent_pln          integer,
  deposit_pln       integer,

  area_m2           double precision,
  rooms             integer,
  floor             text,

  city              text        not null default 'Kraków',
  district          text,
  subdistrict       text,
  street            text,
  lat               double precision,
  lng               double precision,
  coords_precision  text        check (coords_precision in ('exact', 'approximate')),

  is_private_owner  boolean,
  status            text        not null default 'active' check (status in ('active', 'expired')),

  -- Published, versus bumped back to the top. A bumped month-old listing is not new.
  created_at_source timestamptz,
  pushed_up_at      timestamptz,

  -- Ours, not the portal's.
  first_seen_at     timestamptz not null,
  last_seen_at      timestamptz not null,

  -- The complete portal response, so a parsing fix can be replayed over stored rows.
  raw               jsonb       not null,

  unique (source, source_id)
);

create index offers_created_at_source_idx on offers (created_at_source desc);
create index offers_district_idx on offers (district);
create index offers_first_seen_idx on offers (first_seen_at desc);

-- Our verdict, kept apart from the facts. Changing a threshold clears and recomputes
-- this table and touches nothing else.
create table classifications (
  offer_id       integer     primary key references offers (id) on delete cascade,
  tier           text        not null check (tier in ('top', 'worth', 'other')),
  total_cost_pln integer,
  cost_certainty text        not null
                 check (cost_certainty in ('exact', 'all_in', 'estimated', 'uncertain')),
  reasons        jsonb       not null,
  rules_version  integer     not null,
  classified_at  timestamptz not null
);

create index classifications_tier_idx on classifications (tier);

-- Appended only when an amount actually changed.
create table price_history (
  id        integer generated always as identity primary key,
  offer_id  integer     not null references offers (id) on delete cascade,
  price_pln integer,
  rent_pln  integer,
  seen_at   timestamptz not null
);

create index price_history_offer_idx on price_history (offer_id, seen_at);

-- Set by hand from the dashboard.
create table offer_marks (
  offer_id   integer     primary key references offers (id) on delete cascade,
  state      text        not null check (state in ('new', 'seen', 'shortlisted', 'rejected')),
  note       text,
  updated_at timestamptz not null
);

-- So a bumped listing is not sent to Telegram twice.
create table notifications (
  id       integer generated always as identity primary key,
  offer_id integer     not null references offers (id) on delete cascade,
  channel  text        not null check (channel in ('telegram')),
  sent_at  timestamptz not null,
  unique (offer_id, channel)
);

-- Without this there is no telling "no new listings" from "the collector died on Tuesday".
create table fetch_runs (
  id          integer generated always as identity primary key,
  source      text        not null,
  started_at  timestamptz not null,
  finished_at timestamptz,
  ok          boolean,
  items_seen  integer     not null default 0,
  items_new   integer     not null default 0,
  error       text
);

create index fetch_runs_source_idx on fetch_runs (source, started_at desc);
