import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { districtFromUrl, parseGratkaOffer, readSearchPage } from './parse.ts';
import type { GratkaListItem } from './types.ts';

const html = readFileSync(new URL('./__fixtures__/search-krakow.html', import.meta.url), 'utf8');
const page = readSearchPage(html);

function itemAt(index: number): GratkaListItem {
  const item = page.nodes[index];
  if (item === undefined) throw new Error(`The fixture has no listing ${index}.`);
  return item;
}

describe('reading the page', () => {
  test('finds the listings inside the payload the page ships', () => {
    assert.equal(page.nodes.length, 3);
  });

  /**
   * The trap this whole parser is built around. Gratka's payload is devalue-flattened,
   * so a number inside a container is an index into the payload, but the number it
   * eventually points at is a value. Following it one hop too far reads totalCount 2212
   * as whatever sits at index 2212, which in the recorded page is a photograph.
   */
  test('a number that is a value is not followed as another index', () => {
    assert.equal(page.totalCount, 2212);
  });

  test('a page that is not theirs fails loudly rather than yielding nothing', () => {
    assert.throws(() => readSearchPage('<html><body>nothing here</body></html>'), /__NUXT_DATA__/);
  });
});

describe('one listing', () => {
  test('reads the advertised rent, the floor area and the rooms', () => {
    const offer = parseGratkaOffer(itemAt(0));
    assert.equal(offer.pricePln, 3300);
    assert.equal(offer.areaM2, 42);
    assert.equal(offer.rooms, 2);
  });

  test('the building fee is never in a search result, so it is not invented', () => {
    // Which is what puts every Gratka listing on the documented 400 PLN assumption and
    // marks its cost estimated. A zero here would read as "no fee" and be a lie.
    assert.equal(parseGratkaOffer(itemAt(0)).rentPln, null);
  });

  test('the title is the headline the advertiser wrote, not the category', () => {
    // Every Gratka advert is titled "mieszkanie na wynajem". Dedupe compares titles, so
    // that name would make two different flats at the same rent look like one listing.
    const offer = parseGratkaOffer(itemAt(0));
    assert.equal(offer.title, 'Klima | Garaż | Zmywarka | Balkon | ENG');
  });

  test('photographs are decoded from the base64 their CDN addresses them by', () => {
    const [first] = parseGratkaOffer(itemAt(0)).photos;
    assert.ok(first?.startsWith('https://'), `not a URL: ${String(first)}`);
    assert.match(first ?? '', /\.jpg$/);
  });

  test('an agency and a private advertiser are told apart', () => {
    assert.equal(parseGratkaOffer(itemAt(0)).isPrivateOwner, false);
    assert.equal(parseGratkaOffer(itemAt(0)).advertiser, 'SALEVIEW');
    assert.equal(parseGratkaOffer(itemAt(1)).isPrivateOwner, true);
  });

  test('a date without a time stays a date, not today', () => {
    assert.equal(parseGratkaOffer(itemAt(0)).createdAtSource, '2026-08-15T00:00:00.000Z');
  });

  test('no coordinates are claimed, because the payload carries none', () => {
    const offer = parseGratkaOffer(itemAt(0));
    assert.equal(offer.lat, null);
    assert.equal(offer.coordsPrecision, null);
  });
});

describe('the district, which only the url knows', () => {
  test('is read out of the advert url', () => {
    assert.equal(parseGratkaOffer(itemAt(2)).district, 'Czyżyny');
  });

  test('is null when the url names a street instead', () => {
    assert.equal(parseGratkaOffer(itemAt(0)).district, null);
  });

  test('the longer name wins over the one that is a prefix of it', () => {
    const duchackie =
      'https://gratka.pl/nieruchomosci/mieszkanie-krakow-podgorze-duchackie-wloska/ob/1';
    const podgorze =
      'https://gratka.pl/nieruchomosci/mieszkanie-krakow-podgorze-limanowskiego/ob/2';
    assert.equal(districtFromUrl(duchackie), 'Podgórze Duchackie');
    assert.equal(districtFromUrl(podgorze), 'Podgórze');
  });

  test('the names match the ones the other portals report, letter for letter', () => {
    // Both OLX and Otodom store "Dębniki" and "Łagiewniki-Borek Fałęcki". An ASCII
    // spelling here would quietly become a nineteenth district the filters do not know.
    const debniki = 'https://gratka.pl/nieruchomosci/mieszkanie-krakow-debniki-zalesie/ob/3';
    const lagiewniki =
      'https://gratka.pl/nieruchomosci/mieszkanie-krakow-lagiewniki-borek-falecki/ob/4';
    assert.equal(districtFromUrl(debniki), 'Dębniki');
    assert.equal(districtFromUrl(lagiewniki), 'Łagiewniki-Borek Fałęcki');
  });

  test('a city that is not Kraków is not guessed at', () => {
    assert.equal(
      districtFromUrl('https://gratka.pl/nieruchomosci/mieszkanie-warszawa-mokotow/ob/5'),
      null,
    );
  });
});
