import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { NotifiableOffer } from '../db/notifications.ts';
import { offerMessage } from './telegram.ts';

function offer(overrides: Partial<NotifiableOffer> = {}): NotifiableOffer {
  return {
    id: 1,
    source: 'olx',
    url: 'https://www.olx.pl/d/oferta/1',
    title: 'Kawalerka na Podgórzu',
    district: 'Podgórze',
    areaM2: 33,
    rooms: 1,
    floor: '2',
    pricePln: 1800,
    rentPln: 400,
    totalCostPln: 2200,
    costCertainty: 'exact',
    isPrivateOwner: true,
    photo: 'https://ireland.apollo.olxcdn.com:443/v1/files/abc-PL/image;s=800x600',
    ...overrides,
  };
}

describe('the message a listing becomes', () => {
  test('leads with the full monthly cost, which is the number that decides', () => {
    const lines = offerMessage(offer()).split('\n');

    assert.equal(lines[0], '<b>2200 zł miesięcznie</b>');
    assert.equal(lines[1], 'Kawalerka na Podgórzu');
    assert.equal(lines.at(-1), 'https://www.olx.pl/d/oferta/1');
  });

  test('says when the building fee was assumed rather than quoted', () => {
    const message = offerMessage(offer({ costCertainty: 'estimated', rentPln: null }));

    assert.match(message, /\(szacowane\)/);
    assert.match(message, /czynsz niepodany/);
  });

  /**
   * The injection surface. A title is a stranger's text arriving in a message Telegram
   * parses as HTML: unescaped, `<b>` would style the message, and a stray `<` would make
   * Telegram reject the whole thing, which is one advert silently stopping the alerts.
   */
  test('markup in a title arrives as characters, not as markup', () => {
    const message = offerMessage(offer({ title: '<b>OKAZJA</b> & tanio <script>' }));

    assert.match(message, /&lt;b&gt;OKAZJA&lt;\/b&gt; &amp; tanio &lt;script&gt;/);
    // Only the line this code wrote itself is allowed to carry a tag.
    assert.equal(message.split('\n').filter((line) => line.includes('<b>')).length, 1);
  });

  test('leaves out what the portal did not say', () => {
    const message = offerMessage(
      offer({ district: null, rooms: null, floor: null, isPrivateOwner: null }),
    );

    assert.match(message, /^33 m²$/m);
  });
});
