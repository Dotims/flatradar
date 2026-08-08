-- OLX reports the centre of an area plus a blur radius, while Otodom gives an exact
-- pin for most listings (radius 0). A shared map has to keep the two apart, otherwise
-- an approximate point looks like a specific address.
alter table offers add column coords_precision text
  check (coords_precision in ('exact', 'approximate'));
