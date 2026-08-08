---
target: web design (apps/web/src/App.tsx)
total_score: 21
max_score: 40
na_heuristics:
p0_count: 2
p1_count: 2
timestamp: 2026-08-08T22-32-10Z
slug: apps-web-src-app-tsx
---

Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| #         | Heuristic                       | Score     | Key issue                                                                                               |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 2         | The freshness stamp measures the browser's own fetch, not portal collection, and freezes on API failure |
| 2         | Match System / Real World       | 3         | `za m²` divides by rent while the card's dominant figure is the total; two bases, unlabelled            |
| 3         | User Control and Freedom        | 2         | No URL state, no sort control, no way to dismiss or save a listing                                      |
| 4         | Consistency and Standards       | 2         | One tier filter, two toggles, two grammars, and only one shows state                                    |
| 5         | Error Prevention                | 2         | The shipped default filters contradict each other (see P0-2)                                            |
| 6         | Recognition Rather Than Recall  | 2         | Tier rules and the 400 PLN assumption live only in `title=`                                             |
| 7         | Flexibility and Efficiency      | 1         | Used several times a day: no sort, no shortcuts, no "new since last visit"                              |
| 8         | Aesthetic and Minimalist Design | 3         | Coherent and restrained, but 19 district pills and a 6-node graph own the first screen                  |
| 9         | Error Recovery                  | 2         | Background poll failures are swallowed; a sync error renders like a success                             |
| 10        | Help and Documentation          | 2         | The API ships `reasons[]` per offer and the UI discards it                                              |
| **Total** |                                 | **21/40** | **Works, needs work**                                                                                   |

No heuristic scored n/a.

## Design Specificity Verdict

Split, and the split is the problem.

Specific: the pipeline graph writes product constraints into the interface as copy ("z łącza domowego" on OLX, "co 15 min, w chmurze" on Otodom). Filled dot versus hollow circle on the map. A certainty label under every price. No other product uses these unchanged.

Generic below the fold: left filter rail, wide map, two-column card grid, price top-right over a four-cell spec table. Swap the labels and it is a used-car listing.

The specificity is concentrated in the first 260px and evaporates where the owner actually works. The graph answers "how does FlatRadar work" (a recruiter's question); the owner's question, "what do I look at right now", gets the generic half.

The accent has degenerated. DESIGN.md says the warm colour marks only what is decided; under the shipped defaults 6 of 6 visible cards are `top`, so every total glows. When everything is lit, nothing is.

**Deterministic scan:** `detect.mjs` over `apps/web/src` returned 0 findings, exit 0, validated against a known-bad fixture. Coverage is limited: Tailwind utility classes in `.tsx` route to the regex engine, so resolved styles are never seen. A supplementary scan of the rendered DOM returned 2 hits: `dark-glow` on `.lit`/`.lit-num` and the map pin, which is the user's pinned brief and stays; `overused-font` is a false positive from Leaflet vendor CSS, overridden at `index.css:97-100`.

**Visual overlays:** none. Script injection worked over CDP and every DOM measurement is real in-page execution, but headless, so nothing was user-visible.

**Correction:** the untiled black band at the bottom of the map is a screenshot artifact, not a defect. Measured with a real load wait: 18/18 tiles desktop, 12/12 mid, 6/6 mobile, coverage exceeding the container.

## Overall Impression

The visual world holds and is consistent. But three of the best things in this product never reach the screen: selection highlights do not render at all, the whole `worth` tier is unreachable by default, and `reasons[]` (the mechanism the product leads with) is discarded. The biggest opportunity: the interface cannot answer the one question asked three times a day, "what changed since last time".

## What's Working

- **Source nodes turn an infrastructure constraint into user-facing truth.** "z łącza domowego" versus "co 15 min, w chmurze" says without a paragraph that one feed is reliable and the other depends on a machine at home being awake.
- **The mono/sans split is enforced, not decorative.** `.num` with `tabular-nums` on every amount aligns prices vertically down the grid, so totals can be scanned without reading. Highest-leverage typographic decision available in a comparison surface.
- **The map refuses to lie about precision.** Filled dot for Otodom's address, hollow circle for OLX's area centre (`OfferMap.tsx:102-129`).

## Priority Issues

**[P0] `.rule` kills every selection border in the app.**
Confirmed twice independently, from the served CSS and from the built bundle: `.border-signal-500/45` and `/60` compile before `.rule{border:1px solid var(--color-line)}`, same layer, same specificity, so the shorthand resets `border-color`. All three tier node buttons have zero visible state; the accent border on the rules hub and the `top` node never rendered (the visible halo is the `blur-2xl` div); `OfferCard`'s active highlight degrades to an invisible background shift, so hovering a map pin appears to do nothing. `hover:border-line-strong` compiles after `.rule`, so hover works and selection does not. `aria-pressed` is correct, so a screen reader gets state a sighted user cannot see.
_Fix:_ move `.rule` into `@layer components`, or drop `border-color` from it.
_Suggested command:_ `/impeccable polish`

**[P0] The `worth` tier is unreachable in the shipped default state.**
`DEFAULT_FILTERS` ships `tiers: ['top','worth']` with `maxCostPln: 2600`, but `worth` is defined as a total above 2600. Live data: the six `worth` offers total 2610, 2680, 2770, 2900, 2900, 3050. Zero pass. The app loads with the tier pill lit, a graph node advertising 6, and a list containing none.
_Fix:_ exempt `worth` from the total-cost cap (it is judged on rent), or annotate the control when another filter zeroes it.
_Suggested command:_ `/impeccable harden`

**[P1] Recency is invisible, unsortable and unremembered.**
Sorted by cost ascending with no sort control and no recency signal. The second card is 120 days old and styled identically to one posted an hour ago. `firstSeenAt` ships in every row and is never read. No seen/unseen, no dismiss.
_Fix:_ a two-option sort defaulting to newest; a NEW tag driven by `firstSeenAt` against a stored last-visit stamp; a viewed state.
_Suggested command:_ `/impeccable shape`

**[P1] The freshness stamp measures the wrong thing and lies on failure.**
`setFetchedAt(new Date())` on every successful load with a 60s poll can only read "just now" or "1 min ago"; it reports when the browser called its own API. The interval's error path is `.catch(() => undefined)`, so on failure no state changes, React never re-renders, and the header keeps claiming freshness while the API is dead. OLX is collected by a local timer and can genuinely be hours stale; that number appears nowhere.
_Fix:_ per-source last-collection time in the existing node caption slot, amber past ~30 minutes; an explicit disconnected state on background failure.
_Suggested command:_ `/impeccable harden`

**[P2] `reasons[]`, the product's mechanism, is discarded.**
The API ships a sentence array per offer explaining how the total was reached. The UI shows a two-word tag and hides the rest in `title=`, invisible on touch and to keyboard. At the moment of judgement the user asks whether 2500 PLN is the real number; the answer exists and is not shown. The array is English while the interface is Polish, so a translation decision comes first.
_Suggested command:_ `/impeccable clarify`

## Persona Red Flags

**Owner, 21:40, third check of the day, laptop.** Fails at the freshness stamp saying nothing about whether OLX ran since lunch; the absence of a seen state, so all six cards are new to the interface and none to him; the sort order putting a 120-day-old listing second; the lit and empty `worth` pill; the ~810px sticky rail whose last pills sit permanently below the sticky edge on a laptop viewport.

**Owner at a tram stop, phone, 90 seconds, sun on the screen.** Fails at 1450px of scrolling before the first listing; `title=` tooltips carrying the tier rules and the 400 PLN assumption, which do not exist on touch; a ~290px map with hover-only pin-to-card linking.

**Owner on day nine, ~200 listings seen.** Fails at no dismiss and no memory, so cards rejected on day two are still in the grid; 19 district pills, nine naming permanently excluded districts and 14 returning nothing; an empty state prescribing cost and area when the cause was a district or tier pill.

**Recruiter, 90 seconds on the public repo.** Fails at the tier nodes responding to a click with nothing visible (P0); "1 dni temu" on the top card; and `reasons[]` never rendered, so the interface does not demonstrate the mechanism PRODUCT.md leads with.

## Minor Observations

Measured, from real in-page execution:

- 3px horizontal document overflow below 640px (363/360, 393/390, 483/480), caused by the `absolute -inset-6` glow in `PipelineGraph.tsx:76` against `px-5` container padding. Clean from 640 up.
- Contrast 3.39:1 on `text-ink-faint/70` (`OfferCard.tsx:31`), 11px text, needs 4.5:1. The only pair below threshold; everything else runs 5.55-19.27.
- The 9x9px map marker is focusable (`tabindex="0" role="button"` from Leaflet) with an empty accessible name.
- 125 CircleMarkers are not focusable; their `click → window.open` is mouse-only.
- No favicon; `/favicon.ico` 404s.
- Bundle: 111.7 kB JS gzip, 10.9 kB CSS gzip.

Other:

- `since()` produces "1 dni temu"; Polish singular is missing.
- `2500 zł + —` under a label reading "z ogłoszenia"; the dash reads as a rendering gap.
- `pricePerM2` divides rent while the card's largest number is the total.
- `floor` ships in every row and is never shown; ground floor and fifth-without-a-lift are veto criteria.
- 79 of 232 offers (34%) have `lat: null` and drop off the map with no count anywhere.
- Listing titles are raw portal SEO spam, unclamped to 149 characters, desynchronising row heights in the two-column grid.
- `syncNote` never clears and renders errors in the same style as successes.
- The loading screen and the sync button both say "skanuję" for different operations.
- The offers list is a `div` grid, not a list; no `aria-live` on the results counter.
- Graph connectors use `preserveAspectRatio="none"`, so line angles distort across the lg-to-2xl range.

## Questions to Consider

1. If the dashboard could only show what changed since the last look, what would still need to be on the screen?
2. Why is the cost threshold a slider at all? 2600 and 2200 are documented decisions with a `rules_version` behind them, and the slider is precisely what silently voids the `worth` tier.
3. The product's actual output is a Telegram ping, not a page, so what is the page for? If alerting catches the vanishing-in-hours case, the dashboard's real job is the second read: comparing candidates, checking commute, recording a verdict. None of the three exists here.
