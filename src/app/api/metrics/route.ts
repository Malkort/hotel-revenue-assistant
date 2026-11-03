import { NextResponse } from 'next/server';
import { supabase, DEFAULT_HOTEL_ID } from '@/lib/supabase';
import type { DailyMetricInput } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hotelId = searchParams.get('hotelId') || DEFAULT_HOTEL_ID;

  const { data, error } = await supabase
    .from('daily_revenue_metrics')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('metric_date', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Преобразуем snake_case из Supabase -> camelCase для фронтенда
  const mapped: DailyMetricInput[] = (data ?? []).map((r) => ({
    date: r.metric_date,
    roomsSold: r.rooms_sold,
    oooRooms: r.ooo_rooms,
    standardRate: parseFloat(r.standard_rate),
    pickupYesterday: r.pickup_yesterday,
    actualizedOccupancy: r.actualized_occupancy !== null ? parseFloat(r.actualized_occupancy) : null,
    senatorRate: r.senator_rate ? parseFloat(r.senator_rate) : null,
    updatedRate: r.updated_rate ? parseFloat(r.updated_rate) : null,
    notes: r.notes ?? '',
  }));

  return NextResponse.json({ success: true, data: mapped });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DailyMetricInput | DailyMetricInput[] | (DailyMetricInput & { hotelId?: string });
    const metrics = Array.isArray(body) ? body : [body];
    if (metrics.length === 0) {
      return NextResponse.json({ success: false, error: 'Нет данных для сохранения' }, { status: 400 });
    }

    const rows = metrics.map((metric) => {
      if (
        typeof metric.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(metric.date) ||
        typeof metric.roomsSold !== 'number' ||
        !Number.isInteger(metric.roomsSold) ||
        metric.roomsSold < 0 ||
        typeof metric.oooRooms !== 'number' ||
        !Number.isInteger(metric.oooRooms) ||
        metric.oooRooms < 0 ||
        typeof metric.standardRate !== 'number' ||
        !Number.isFinite(metric.standardRate) ||
        metric.standardRate < 0 ||
        typeof metric.pickupYesterday !== 'number' ||
        !Number.isFinite(metric.pickupYesterday) ||
        (metric.actualizedOccupancy != null &&
          (typeof metric.actualizedOccupancy !== 'number' ||
            !Number.isFinite(metric.actualizedOccupancy) ||
            metric.actualizedOccupancy < 0 ||
            metric.actualizedOccupancy > 100)) ||
        (metric.senatorRate != null &&
          (typeof metric.senatorRate !== 'number' ||
            !Number.isFinite(metric.senatorRate) ||
            metric.senatorRate < 0)) ||
        (metric.updatedRate != null &&
          (typeof metric.updatedRate !== 'number' ||
            !Number.isFinite(metric.updatedRate) ||
            metric.updatedRate < 0))
      ) {
        return null;
      }

      return {
        hotel_id: !Array.isArray(body) && 'hotelId' in body ? body.hotelId ?? DEFAULT_HOTEL_ID : DEFAULT_HOTEL_ID,
        metric_date: metric.date,
        rooms_sold: metric.roomsSold,
        ooo_rooms: metric.oooRooms,
        standard_rate: metric.standardRate,
        pickup_yesterday: metric.pickupYesterday,
        actualized_occupancy: metric.actualizedOccupancy ?? null,
        senator_rate: metric.senatorRate ?? null,
        updated_rate: metric.updatedRate ?? null,
        notes: metric.notes ?? null,
        updated_at: new Date().toISOString(),
      };
    });

    if (rows.some((row) => row === null)) {
      return NextResponse.json({ success: false, error: 'Некорректные данные в одной или нескольких строках' }, { status: 400 });
    }

    const validRows = rows.filter((row): row is NonNullable<typeof row> => row !== null);
    const { error } = await supabase
      .from('daily_revenue_metrics')
      .upsert(
        validRows,
        { onConflict: 'hotel_id,metric_date' }
      );

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Сохранено' });
  } catch {
    return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500 });
  }
}
