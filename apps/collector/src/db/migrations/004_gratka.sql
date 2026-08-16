-- A third portal. The check on `source` is a list of names, so it has to be replaced
-- rather than added to. `offers_source_check` is the name Postgres gave the inline check
-- in 001_init.sql, confirmed against the live database rather than assumed; `if exists`
-- covers a copy where it was named differently or already dropped.
--
-- The name is spelled out again rather than the check being dropped altogether: a typo in
-- a source name is otherwise a silent second portal that nothing collects and nothing
-- shows, and this column is the only place that would have caught it.
alter table offers drop constraint if exists offers_source_check;
alter table offers add constraint offers_source_check
  check (source in ('olx', 'otodom', 'gratka'));
