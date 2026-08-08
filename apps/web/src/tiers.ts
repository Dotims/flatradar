import type { CostCertainty, Tier } from './types.ts';

/** top/worth/other are names for the code. Each label carries the rule behind it. */
export const TIER: Record<Tier, { label: string; rule: string; dot: string; ring: string }> = {
  top: {
    label: 'W budżecie',
    rule: 'całość (najem + czynsz + media) do 2600 zł',
    dot: 'bg-ember-400',
    ring: 'ring-ember-500/60',
  },
  worth: {
    label: 'Tani najem',
    rule: 'sam najem do 2200 zł, ale całość wychodzi drożej',
    dot: 'bg-amber-300',
    ring: 'ring-amber-400/40',
  },
  other: {
    label: 'Odpada',
    rule: 'zła dzielnica albo za drogo',
    dot: 'bg-stone-500',
    ring: 'ring-white/10',
  },
};

export const CERTAINTY: Record<CostCertainty, { label: string; hint: string }> = {
  exact: { label: 'z ogłoszenia', hint: 'każda część kwoty pochodzi z ogłoszenia' },
  all_in: { label: 'wszystko w cenie', hint: 'opis mówi, że cena obejmuje wszystko' },
  estimated: { label: 'czynsz szacowany', hint: 'brak czynszu w ofercie, przyjęto 400 zł' },
  uncertain: { label: 'brak ceny', hint: 'ogłoszenie nie podaje najmu' },
};

/** The budget the gauge on each card fills against. */
export const BUDGET_PLN = 2600;
