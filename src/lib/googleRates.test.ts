import assert from 'node:assert/strict';
import { buildGoogleTravelDateToken, parseGoogleRatePageText } from './googleRates';

const officialPage = `
Обзор
Цены
Отзывы
Cosmonaut Hotel
51 408 ₸
19–20 нояб.
Заезд
Все варианты
Cosmonaut Hotel
Официальный сайт
Цена для участников программы (экономия 10 %)
57 120 ₸
51 408 ₸
Перейти на сайт
Bluepillow.com
47 844 ₸
`;

const partnerOnlyPage = `
Обзор
Цены
Отзывы
Cosmonaut Hotel
49 539 ₸
21–22 нояб.
Заезд
Все варианты
Bluepillow.com
49 539 ₸
Перейти на сайт
`;

assert.deepEqual(parseGoogleRatePageText(officialPage), { rate: 51408, source: 'official' });
assert.deepEqual(parseGoogleRatePageText(partnerOnlyPage), { rate: 49539, source: 'partner' });
assert.equal(parseGoogleRatePageText('Google Travel temporarily unavailable'), null);
assert.equal(
  buildGoogleTravelDateToken('2026-11-19', '2026-11-20'),
  'CAEaSQopEicyJTB4NDI0MzQwY2U1MzMwMGQ5YjoweDM4YTI1ZDFmZTZlMjJiYjMSHBIUCgcI6g8QCxgTEgcI6g8QCxgUGAEyBAgAEAAqBwoFOgNLWlQ'
);
console.log('Google Travel rate parsing tests passed.');
