'use client';

import React from 'react';
import { DailyMetricRow } from '../lib/types';
import { getOccupancyStyles } from '../lib/calculations';
import { 
  Building2, 
  TrendingUp, 
  Percent, 
  DollarSign, 
  Calendar, 
  BedDouble, 
  ArrowUpRight, 
  ArrowDownRight 
} from 'lucide-react';

interface DashboardKPIProps {
  data: DailyMetricRow[];
  totalRooms: number;
  currency: string;
}

export const DashboardKPI: React.FC<DashboardKPIProps> = ({ data, totalRooms, currency }) => {
  if (!data || data.length === 0) return null;

  // Сегодняшний или первый доступный день
  const todayRow = data[0];
  const todayStyles = getOccupancyStyles(todayRow.band);

  // Совокупные метрики за период
  const totalPeriodRevenue = data.reduce((acc, r) => acc + r.revenue, 0);
  const totalPeriodRoomsSold = data.reduce((acc, r) => acc + r.roomsSold, 0);
  const totalPeriodAvailableRooms = data.reduce((acc, r) => acc + r.availableRooms, 0);
  
  const avgOccupancy = totalPeriodAvailableRooms > 0 
    ? Math.round((totalPeriodRoomsSold / totalPeriodAvailableRooms) * 1000) / 10 
    : 0;
  
  const avgADR = totalPeriodRoomsSold > 0 
    ? Math.round(totalPeriodRevenue / totalPeriodRoomsSold) 
    : 0;

  const avgRevPAR = totalPeriodAvailableRooms > 0 
    ? Math.round(totalPeriodRevenue / totalPeriodAvailableRooms) 
    : 0;

  const totalPickup = data.reduce((acc, r) => acc + r.pickupYesterday, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Загрузка сегодня */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
          <span>Загрузка на сегодня</span>
          <Percent className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {todayRow.effectiveOccupancy}%
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${todayStyles.badge}`}>
            {todayStyles.label}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
          <span>Продано: {todayRow.roomsSold} из {todayRow.availableRooms} ном.</span>
          <span className="text-[11px] text-slate-400">OOO: {todayRow.oooRooms}</span>
        </div>
      </div>

      {/* 2. ADR (Средняя цена номера) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
          <span>Средний тариф (ADR)</span>
          <DollarSign className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
          {todayRow.adr.toLocaleString('ru-RU')} {currency}
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
          <span>Тариф дня: {(todayRow.updatedRate ?? todayRow.standardRate).toLocaleString('ru-RU')} {currency}</span>
          {todayRow.senatorRate && (
            <span className="text-[11px] text-slate-400">
              SENATOR: {todayRow.senatorRate.toLocaleString('ru-RU')} {currency}
            </span>
          )}
        </div>
      </div>

      {/* 3. RevPAR (Доход на номер фонда) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
          <span>RevPAR (Эффективность)</span>
          <TrendingUp className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
          {todayRow.revpar.toLocaleString('ru-RU')} {currency}
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
          <span>Средний по периоду:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
            {avgRevPAR.toLocaleString('ru-RU')} {currency}
          </span>
        </div>
      </div>

      {/* 4. Выручка периода и динамика Pickup */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
          <span>Выручка за период</span>
          <Calendar className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
          {totalPeriodRevenue.toLocaleString('ru-RU')} {currency}
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
          <span>Суммарный Pickup:</span>
          <span
            className={`font-semibold inline-flex items-center ${
              totalPickup >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {totalPickup >= 0 ? `+${totalPickup}` : totalPickup} ном.
          </span>
        </div>
      </div>
    </div>
  );
};
