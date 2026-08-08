-- A missing building fee is now assumed rather than left unknown, which adds a fourth
-- value to cost_certainty. SQLite cannot alter a check constraint, so the table is
-- rebuilt. Nothing is preserved on purpose: every row here is derived from `offers` and
-- the classify command rewrites all of them in one pass.
drop table if exists classifications;

create table classifications (
  offer_id       integer primary key references offers (id) on delete cascade,
  tier           text    not null check (tier in ('top', 'worth', 'other')),
  total_cost_pln integer,
  -- exact     = every part of the total came from the listing
  -- all_in    = the description states the price covers everything
  -- estimated = no building fee was given, so one was assumed
  -- uncertain = no rent was stated, so there is nothing to add up
  cost_certainty text    not null
                 check (cost_certainty in ('exact', 'all_in', 'estimated', 'uncertain')),
  reasons        text    not null,
  rules_version  integer not null,
  classified_at  text    not null
);

create index classifications_tier_idx on classifications (tier);
