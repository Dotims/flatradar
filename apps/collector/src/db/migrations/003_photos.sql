-- The first photograph is what makes a listing recognisable without reading it, and the
-- dashboard draws thousands of cards at once. The URLs were already in `raw`, but reading
-- them back out per request measured 1987ms against 193ms for the same list without them:
-- `raw` is a jsonb column holding a JSON string, so every stored payload has to be parsed
-- whole before one field can be read.
--
-- So they are copied out once, on write, by the source parsers that already know each
-- portal's shape. This is still a portal fact, not our opinion, so it belongs on `offers`.
alter table offers add column photos jsonb not null default '[]'::jsonb;
