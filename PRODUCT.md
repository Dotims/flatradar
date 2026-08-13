# Overheads

## What it is

A rental-listing radar for one person hunting a flat in Kraków. It collects new listings
from OLX and Otodom every fifteen minutes, works out what each one actually costs per
month, and rules out the districts and prices its owner does not want.

## The mechanism

Portals advertise a rent and hide the rest. The building fee is a separate number when
the advertiser bothers to fill it in, and utilities are prose in the description. Overheads
reassembles the real monthly cost from all three, says how much of that figure it actually
read versus assumed, and sorts by it.

Facts and verdicts are stored apart. Changing a threshold recomputes locally and never
refetches a portal.

## Who uses it, and where

The owner, Radek. On a laptop at a desk, several times a day, usually in the evening, and
on a phone when a listing needs checking before it disappears. Good listings in Kraków are
gone within hours, so speed of judgement matters more than browsing pleasure.

Second audience, in second place: recruiters. The repository is public and backs a search
for a React role, so the interface is also evidence of how its author works.

## The verdicts

- **W budżecie** - rent plus building fee plus utilities at or below 2600 zł.
- **Tani najem** - the rent alone is at or below 2200 zł, but the full cost is higher.
- **Odpada** - an excluded district, or too expensive to reach either bar.

Alongside each total sits how it was reached: read from the listing, claimed all-inclusive,
or assumed (a missing building fee is taken as 400 zł, and every verdict leaning on that
says so).

## Constraints that shape the product

- OLX refuses every request from a datacenter address, at the edge, before headers are
  read. It is collected from an ordinary connection: a local timer or a phone posting to
  the ingest endpoint. Nothing about the client is disguised.
- Otodom is collected in the cloud every fifteen minutes and is always current.
- Otodom pins a real address; OLX reports the centre of an area. The interface must not
  present the second as the first.
- Listing text is written by strangers and is escaped, never trusted.

## Language

Interface in Polish, the language its user reads listings in. Everything in the repository
is English.
