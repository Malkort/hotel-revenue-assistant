export type UserRole = 'ADMIN' | 'REVENUE_MANAGER' | 'FRONT_DESK';

export interface Hotel {
  id: string;
  name: string;
  totalRooms: number;
  currency: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  hotelId: string;
}

export interface DailyMetricInput {
  date: string; // YYYY-MM-DD
  roomsSold: number;
  oooRooms: number; // Out of order
  standardRate: number; // Тариф стандарт
  pickupYesterday: number; // Абронировано с прошлого дня
  actualizedOccupancy?: number | null; // Актуализированный % загрузки
  senatorRate?: number | null; // Тариф отеля "SENATOR"
  updatedRate?: number | null; // Обновленный тариф дня
  notes?: string;
}

export type OccupancyBand = 'low' | 'medium' | 'high';

export interface DailyMetricRow extends DailyMetricInput {
  dayOfWeek: string;
  availableRooms: number;
  calculatedOccupancy: number; // %
  effectiveOccupancy: number; // % (actualized if provided, else calculated)
  revenue: number;
  adr: number;
  revpar: number;
  band: OccupancyBand;
}

export type GoogleRateSource = 'official' | 'partner' | 'unavailable';

export interface GoogleRateResult {
  date: string;
  rate: number | null;
  source: GoogleRateSource;
}

export type CalendarViewMode = 'all' | 'occupancy' | 'revenue' | 'rates';
