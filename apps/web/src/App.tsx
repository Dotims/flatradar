import { useEffect, useMemo, useState } from 'react';
import { applyFilters, availableDistricts, DEFAULT_FILTERS, type Filters } from './filters.ts';
import type { Offer, Tier } from './types.ts';

const TIERS: Tier[] = ['top', 'worth', 'other'];

/**
 * `top`, `worth` and `other` are names for the code, not for a person reading a table.
 * Each label carries the rule that produced it, so the panel never has to be explained
 * twice: short text for the column, the whole rule on hover and next to the checkbox.
 */
const TIER_LABEL: Record<Tier, { short: string; rule: string }> = {
  top: { short: 'W budżecie', rule: 'całość (najem + czynsz + media) do 2600 zł' },
  worth: { short: 'Tani najem', rule: 'sam najem do 2200 zł, ale całość wychodzi drożej' },
  other: { short: 'Odpada', rule: 'zła dzielnica albo za drogo' },
};

/** What the certainty of a total means, in the language the owner reads the panel in. */
const CERTAINTY_LABEL: Record<string, string> = {
  exact: 'z ogłoszenia',
  all_in: 'wszystko w cenie',
  estimated: 'czynsz szacowany',
  uncertain: 'brak ceny',
};

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function App() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/offers', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json() as Promise<{ offers: Offer[] }>;
      })
      .then((body) => setOffers(body.offers))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const districts = useMemo(() => availableDistricts(offers), [offers]);
  const visible = useMemo(() => applyFilters(offers, filters), [offers, filters]);

  if (loading) return <p>Ładowanie...</p>;
  if (error !== null) {
    return (
      <p>
        Nie udało się pobrać ofert: {error}. Czy działa{' '}
        <code>pnpm --filter @flatradar/collector serve</code>?
      </p>
    );
  }

  return (
    <main>
      <h1>FlatRadar</h1>

      <fieldset>
        <legend>Filtry</legend>

        <p>
          <label>
            Koszt całkowity maks. (zł){' '}
            <input
              type="number"
              step={50}
              value={filters.maxCostPln}
              onChange={(event) =>
                setFilters({ ...filters, maxCostPln: Number(event.target.value) })
              }
            />
          </label>
        </p>

        <p>
          <label>
            Metraż min. (m²){' '}
            <input
              type="number"
              step={5}
              value={filters.minAreaM2}
              onChange={(event) =>
                setFilters({ ...filters, minAreaM2: Number(event.target.value) })
              }
            />
          </label>
        </p>

        <p>
          Ocena:
          <br />
          {TIERS.map((tier) => (
            <label key={tier} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={filters.tiers.includes(tier)}
                onChange={() => setFilters({ ...filters, tiers: toggle(filters.tiers, tier) })}
              />
              <strong>{TIER_LABEL[tier].short}</strong> - {TIER_LABEL[tier].rule}
            </label>
          ))}
        </p>

        <p>
          <label>
            <input
              type="checkbox"
              checked={filters.privateOnly}
              onChange={(event) => setFilters({ ...filters, privateOnly: event.target.checked })}
            />
            Tylko oferty prywatne
          </label>
        </p>

        <p>
          Dzielnice (nic zaznaczonego = wszystkie):
          <br />
          {districts.map((district) => (
            <label key={district}>
              <input
                type="checkbox"
                checked={filters.districts.includes(district)}
                onChange={() =>
                  setFilters({ ...filters, districts: toggle(filters.districts, district) })
                }
              />
              {district}{' '}
            </label>
          ))}
        </p>

        <p>
          <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset
          </button>
        </p>
      </fieldset>

      <p>
        {visible.length} z {offers.length} ofert
      </p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Ocena</th>
            <th>Dzielnica</th>
            <th>Najem</th>
            <th>Czynsz</th>
            <th>Razem</th>
            <th>Skąd kwota</th>
            <th>m²</th>
            <th>Pokoje</th>
            <th>Kto</th>
            <th>Ogłoszenie</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((offer) => (
            <tr key={offer.id}>
              <td title={TIER_LABEL[offer.tier].rule}>{TIER_LABEL[offer.tier].short}</td>
              <td>{offer.district ?? '-'}</td>
              <td>{offer.pricePln ?? '-'}</td>
              <td>{offer.rentPln ?? '-'}</td>
              <td>{offer.totalCostPln ?? '-'}</td>
              <td title={offer.reasons.join(' ')}>
                {CERTAINTY_LABEL[offer.costCertainty] ?? offer.costCertainty}
              </td>
              <td>{offer.areaM2 ?? '-'}</td>
              <td>{offer.rooms ?? '-'}</td>
              <td>
                {offer.isPrivateOwner === null ? '-' : offer.isPrivateOwner ? 'prywatne' : 'firma'}
              </td>
              <td>
                {/* rel keeps the portal from seeing where the click came from, and
                    React escapes the title, which is text written by a stranger. */}
                <a href={offer.url} target="_blank" rel="noreferrer noopener">
                  {offer.title}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
