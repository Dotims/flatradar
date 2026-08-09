-- The same flat is advertised on both portals, roughly one listing in twelve. Matching
-- them is text comparison, so it happens in the database on an index rather than by
-- pulling every row into the collector.
create extension if not exists pg_trgm;

-- Who placed the advert. Each source parser normalises its own portal's shape into this,
-- so the matcher never has to know which portal a row came from.
alter table offers add column advertiser text;

-- The listing this one repeats. Null means this is the one worth showing.
alter table offers add column duplicate_of integer references offers (id) on delete set null;

create index offers_duplicate_of_idx on offers (duplicate_of);

-- The blocking key: rent, floor area to the nearest square metre, and room count. Text
-- is only compared within a group that already agrees on all three.
create index offers_dedupe_block_idx on offers (price_pln, round(area_m2::numeric), rooms);
