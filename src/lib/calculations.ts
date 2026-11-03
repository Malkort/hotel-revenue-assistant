import type { DailyMetricInput, DailyMetricRow, OccupancyBand } from './types';

/**
 * 1. Доступный фонд номеров (Available Rooms)
 * Доступный фонд = Общий фонд - Out of Order (OOO).
 * Не может быть меньше 0.
 */
export function calculateAvailableRooms(totalRooms: number, oooRooms: number): number {
  return Math.max(0, totalRooms - Math.max(0, oooRooms));
}

/**
 * 2. % Загрузки (Occupancy Rate)
 * % Загрузки = (Продано номеров / Доступный фонд) * 100.
 * Округляем до 1 знака после запятой. Если доступных номеров нет — 0%.
 */
export function calculateOccupancy(roomsSold: number, availableRooms: number): number {
  if (availableRooms <= 0) return 0;
  const occ = (roomsSold / availableRooms) * 100;
  return Math.round(occ * 10) / 10;
}

/**
 * 3. Расчетная выручка от номеров (Room Revenue)
 * Выручка = Продано номеров * Действующий тариф (Обновленный либо Стандарт).
 */
export function calculateRevenue(roomsSold: number, rate: number): number {
  if (roomsSold <= 0 || rate <= 0) return 0;
  return Math.round(roomsSold * rate);
}

/**
 * 4. ADR (Average Daily Rate — Средняя цена проданного номера)
 * ADR = Выручка от номеров / Продано номеров.
 */
export function calculateADR(revenue: number, roomsSold: number): number {
  if (roomsSold <= 0) return 0;
  return Math.round((revenue / roomsSold) * 100) / 100;
}

/**
 * 5. RevPAR (Revenue Per Available Room — Выручка на доступный номер)
 * RevPAR = Выручка от номеров / Доступный фонд номеров.
 */
export function calculateRevPAR(revenue: number, availableRooms: number): number {
  if (availableRooms <= 0) return 0;
  return Math.round((revenue / availableRooms) * 100) / 100;
}

/**
 * 6. Определение цветового диапазона загрузки:
 * - Красный (low): Загрузка <= 30%
 * - Желтый (medium): 30% < Загрузка <= 70%
 * - Зеленый (high): Загрузка > 70%
 */
export function getOccupancyBand(occupancy: number): OccupancyBand {
  if (occupancy <= 30) return 'low';
  if (occupancy <= 70) return 'medium';
  return 'high';
}

/**
 * Стили Tailwind для ячеек и бейджей в зависимости от загрузки
 */
export function getOccupancyStyles(band: OccupancyBand) {
  switch (band) {
    case 'low':
      return {
        badge: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
        cellHighlight: 'bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-300 font-semibold',
        dot: 'bg-red-500',
        label: 'Низкая (≤30%)',
      };
    case 'medium':
      return {
        badge: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
        cellHighlight: 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 font-semibold',
        dot: 'bg-amber-500',
        label: 'Средняя (31-70%)',
      };
    case 'high':
      return {
        badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
        cellHighlight: 'bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-semibold',
        dot: 'bg-emerald-500',
        label: 'Высокая (>70%)',
      };
  }
}

const RU_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function getDayOfWeekName(dateString: string): string {
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? '' : RU_DAYS[d.getDay()];
}

/**
 * Полный расчет строки на основе входных данных
 */
export function calculateRowMetrics(input: DailyMetricInput, totalRooms: number): DailyMetricRow {
  const availableRooms = calculateAvailableRooms(totalRooms, input.oooRooms);
  const calculatedOccupancy = calculateOccupancy(input.roomsSold, availableRooms);
  
  // Если задана ручная актуализация — берем ее, иначе авто-расчет
  const effectiveOccupancy =
    typeof input.actualizedOccupancy === 'number' && !isNaN(input.actualizedOccupancy)
      ? input.actualizedOccupancy
      : calculatedOccupancy;

  const activeRate = (input.updatedRate && input.updatedRate > 0) ? input.updatedRate : input.standardRate;
  const revenue = calculateRevenue(input.roomsSold, activeRate);
  const adr = calculateADR(revenue, input.roomsSold);
  const revpar = calculateRevPAR(revenue, availableRooms);
  const band = getOccupancyBand(effectiveOccupancy);

  return {
    ...input,
    dayOfWeek: getDayOfWeekName(input.date),
    availableRooms,
    calculatedOccupancy,
    effectiveOccupancy,
    revenue,
    adr,
    revpar,
    band,
  };
}
