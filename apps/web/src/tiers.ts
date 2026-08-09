import type { CostCertainty, Tier } from './types.ts';

/** top/worth/other are names for the code. Each label carries the rule behind it. */
export const TIER: Record<Tier, { label: string; rule: string }> = {
  top: { label: 'w budżecie', rule: 'całość (najem + czynsz + media) do 2600 zł' },
  worth: { label: 'tani najem', rule: 'sam najem do 2200 zł, całość wychodzi drożej' },
  other: { label: 'poza budżetem', rule: 'sam najem powyżej 2200 zł' },
};

export const CERTAINTY: Record<CostCertainty, { label: string; hint: string }> = {
  exact: { label: 'z ogłoszenia', hint: 'każda część kwoty pochodzi z ogłoszenia' },
  all_in: { label: 'wszystko w cenie', hint: 'opis mówi, że cena obejmuje wszystko' },
  estimated: { label: 'czynsz szacowany', hint: 'brak czynszu w ofercie, przyjęto 400 zł' },
  uncertain: { label: 'brak ceny', hint: 'ogłoszenie nie podaje najmu' },
};
