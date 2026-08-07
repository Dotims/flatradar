-- Facts as reported by the portal. Nothing here reflects our own opinion or price
-- thresholds, so changing the criteria never requires fetching the listings again.
create table offers (
  id                integer primary key,
  source            text    not null check (source in ('olx', 'otodom')),
  source_id         text    not null,
  url               text    not null,
  title             text    not null,
  description       text,

  -- Amounts in whole PLN. Both portals report the rent and the building fee as
  -- separate numbers, so neither is parsed out of free text.
  price_pln         integer,
  rent_pln          integer,
  deposit_pln       integer,

  area_m2           real,
  rooms             integer,
  floor             text,

  city              text    not null default 'Kraków',
  district          text,
  subdistrict       text,
  street            text,
  lat               real,
  lng               real,

  is_private_owner  integer check (is_private_owner in (0, 1)),
  status            text    not null default 'active' check (status in ('active', 'expired')),

  -- Portal timestamps (ISO 8601, UTC). created_at_source is when the listing was
  -- published, pushed_up_at when it was last bumped back to the top. The distinction
  -- matters: a bumped month-old listing is not a new offer.
  created_at_source text,
  pushed_up_at      text,

  -- Our timestamps: when we first and last saw the listing.
  first_seen_at     text    not null,
  last_seen_at      text    not null,

  -- The complete portal response. It costs disk space, but it lets us recompute
  -- everything without hitting the portal again when the parsing changes.
  raw               text    not null,

  unique (source, source_id)
);

create index offers_created_at_source_idx on offers (created_at_source desc);
create index offers_district_idx on offers (district);
create index offers_first_seen_idx on offers (first_seen_at desc);

-- Our verdict about a listing, deliberately kept in its own table. Changing the
-- thresholds then means clearing and recomputing this one table, never touching
-- the source data.
create table classifications (
  offer_id       integer primary key references offers (id) on delete cascade,
  tier           text    not null check (tier in ('top', 'worth', 'other')),
  total_cost_pln integer,
  -- exact     = rent and building fee are the complete cost
  -- all_in    = the description states everything is included
  -- uncertain = the description mentions utilities without giving amounts
  cost_certainty text    not null check (cost_certainty in ('exact', 'all_in', 'uncertain')),
  reasons        text    not null,
  rules_version  integer not null,
  classified_at  text    not null
);

create index classifications_tier_idx on classifications (tier);

-- Price history. A row is appended only when an amount actually changed.
create table price_history (
  id        integer primary key,
  offer_id  integer not null references offers (id) on delete cascade,
  price_pln integer,
  rent_pln  integer,
  seen_at   text    not null
);

create index price_history_offer_idx on price_history (offer_id, seen_at);

-- State set by hand from the dashboard.
create table offer_marks (
  offer_id   integer primary key references offers (id) on delete cascade,
  state      text    not null check (state in ('new', 'seen', 'shortlisted', 'rejected')),
  note       text,
  updated_at text    not null
);

-- Delivery log, so the same listing is not sent to Telegram a second time after
-- the owner bumps it.
create table notifications (
  id       integer primary key,
  offer_id integer not null references offers (id) on delete cascade,
  channel  text    not null check (channel in ('telegram')),
  sent_at  text    not null,
  unique (offer_id, channel)
);

-- Log of fetch runs. Without it there is no way to tell "no new listings" apart
-- from "the collector has been dead for three days".
create table fetch_runs (
  id          integer primary key,
  source      text    not null,
  started_at  text    not null,
  finished_at text,
  ok          integer check (ok in (0, 1)),
  items_seen  integer not null default 0,
  items_new   integer not null default 0,
  error       text
);

create index fetch_runs_source_idx on fetch_runs (source, started_at desc);
