import { NextResponse } from 'next/server';
import { fetchGoogleRatesForMonth } from '@/lib/googleRates';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));

  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json(
      { success: false, error: 'Укажите корректные год и месяц.' },
      { status: 400 }
    );
  }

  try {
    const data = await fetchGoogleRatesForMonth(year, month);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось получить тарифы Google Travel.';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
