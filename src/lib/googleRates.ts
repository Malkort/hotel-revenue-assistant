import { chromium } from 'playwright';
import type { GoogleRateResult } from './types';

const GOOGLE_HOTEL_URL =
  'https://www.google.com/travel/hotels/entity/ChgIs9eIt_6jl9E4GgwvZy8xMjYxZjFxbmsQAQ?q=cosmonaut&hl=ru-KZ&gl=kz&ssta=1';
const GOOGLE_HOTEL_QUERY_ID = '2%0x424340ce53300d9b:0x38a25d1fe6e22bb3';

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;

  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining);
  return Buffer.from(bytes);
}

function protobufVarint(fieldNumber: number, value: number): Buffer {
  return Buffer.concat([encodeVarint((fieldNumber << 3) | 0), encodeVarint(value)]);
}

function protobufBytes(fieldNumber: number, value: Buffer): Buffer {
  return Buffer.concat([
    encodeVarint((fieldNumber << 3) | 2),
    encodeVarint(value.length),
    value,
  ]);
}

function googleDateMessage(date: string): Buffer {
  const [year, month, day] = date.split('-').map(Number);
  return Buffer.concat([
    protobufVarint(1, year),
    protobufVarint(2, month),
    protobufVarint(3, day),
  ]);
}

export function buildGoogleTravelDateToken(arrival: string, departure: string): string {
  const dateRange = Buffer.concat([
    protobufBytes(1, googleDateMessage(arrival)),
    protobufBytes(2, googleDateMessage(departure)),
    protobufVarint(3, 1),
  ]);
  const stay = Buffer.concat([
    protobufBytes(2, dateRange),
    protobufBytes(6, Buffer.concat([protobufVarint(1, 0), protobufVarint(2, 0)])),
  ]);
  const hotel = Buffer.from(GOOGLE_HOTEL_QUERY_ID, 'utf8');
  const hotelQuery = protobufBytes(1, protobufBytes(2, hotel));
  const request = Buffer.concat([
    hotelQuery,
    protobufBytes(2, stay),
  ]);
  const currency = protobufBytes(1, protobufBytes(7, Buffer.from('KZT', 'ascii')));

  return Buffer.concat([
    protobufVarint(1, 1),
    protobufBytes(3, request),
    protobufBytes(5, currency),
  ]).toString('base64url');
}

function parsePrices(text: string): number[] {
  const prices: number[] = [];
  const pricePattern = /(\d[\d \u00a0\u202f]*(?:[,.]\d{1,2})?)\s*(?:₸|KZT)/gi;

  for (const match of Array.from(text.matchAll(pricePattern))) {
    const value = Number(match[1].replace(/[ \u00a0\u202f]/g, '').replace(',', '.'));
    if (Number.isFinite(value) && value > 0) prices.push(value);
  }

  return prices;
}

export function parseGoogleRatePageText(text: string): Omit<GoogleRateResult, 'date'> | null {
  const normalized = text.replace(/\r/g, '').replace(/[\u00a0\u202f]/g, ' ');
  const optionsStart = normalized.lastIndexOf('Все варианты');

  if (optionsStart >= 0) {
    const officialIndex = normalized.toLocaleLowerCase('ru-RU').indexOf('официальный сайт', optionsStart);
    if (officialIndex >= 0) {
      const nextLink = normalized.indexOf('Перейти на сайт', officialIndex);
      const officialOffer = normalized.slice(
        officialIndex,
        nextLink >= 0 ? nextLink : officialIndex + 600
      );
      const officialPrices = parsePrices(officialOffer);
      if (officialPrices.length > 0) {
        return { rate: officialPrices[officialPrices.length - 1], source: 'official' };
      }
    }
  }

  const panelStart = normalized.indexOf('Обзор');
  if (panelStart >= 0) {
    const checkInStart = normalized.indexOf('Заезд', panelStart);
    const summary = normalized.slice(panelStart, checkInStart >= 0 ? checkInStart : panelStart + 1200);
    const summaryPrices = parsePrices(summary);
    if (summaryPrices.length > 0) {
      return { rate: summaryPrices[0], source: 'partner' };
    }
  }

  return null;
}

function localDateInAlmaty(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Almaty',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthDates(year: number, month: number): string[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) =>
    `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
  );
}

function nextDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export async function fetchGoogleRatesForMonth(
  year: number,
  month: number
): Promise<GoogleRateResult[]> {
  const today = localDateInAlmaty();
  const dates = monthDates(year, month);
  const results: GoogleRateResult[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ locale: 'ru-RU', timezoneId: 'Asia/Almaty' });
    page.setDefaultTimeout(15000);

    for (const date of dates) {
      if (date < today) {
        results.push({ date, rate: null, source: 'unavailable' });
        continue;
      }

      const departure = nextDate(date);
      const url = new URL(GOOGLE_HOTEL_URL);
      url.searchParams.set('ts', buildGoogleTravelDateToken(date, departure));
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(
        ({ arrivalDate, departureDate }) => {
          const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(
            'input[jsname="yrriRe"]'
          )).filter((input) => input.getBoundingClientRect().width > 0);
          return inputs.some((input) =>
            input.getAttribute('aria-label') === 'Заезд' &&
            input.parentElement?.parentElement?.getAttribute('data-value') === arrivalDate
          ) && inputs.some((input) =>
            input.getAttribute('aria-label') === 'Выезд' &&
            input.parentElement?.parentElement?.getAttribute('data-value') === departureDate
          );
        },
        { arrivalDate: date, departureDate: departure },
        { timeout: 20000 }
      );
      await page.waitForTimeout(1000);

      const pageText = await page.locator('body').innerText();
      const quote = parseGoogleRatePageText(pageText);
      results.push(quote
        ? { date, ...quote }
        : { date, rate: null, source: 'unavailable' });
    }

    return results;
  } finally {
    await browser.close();
  }
}
