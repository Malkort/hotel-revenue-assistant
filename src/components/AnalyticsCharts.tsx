'use client';

import React, { useState } from 'react';
import { DailyMetricRow } from '../lib/types';
import { getOccupancyStyles } from '../lib/calculations';
import { BarChart3, TrendingUp, Layers } from 'lucide-react';

interface AnalyticsChartsProps {
  data: DailyMetricRow[];
  currency: string;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ data, currency }) => {
  const [metric, setMetric] = useState<'occupancy' | 'revenue'>('occupancy');

  if (!data || data.length === 0) return null;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 100000);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Динамика загрузки и выручки на месяц
          </h3>
          <p className="text-xs text-slate-500">
            Визуальный тренд с цветовой подсветкой порогов загрузки (Красный ≤30%, Желтый 31-70%, Зеленый &gt;70%)
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs font-medium">
          <button
            onClick={() => setMetric('occupancy')}
            className={`px-3 py-1 rounded-md transition ${
              metric === 'occupancy'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            % Загрузки
          </button>
          <button
            onClick={() => setMetric('revenue')}
            className={`px-3 py-1 rounded-md transition ${
              metric === 'revenue'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Выручка ({currency})
          </button>
        </div>
      </div>

      {/* Барчарт */}
      <div className="h-48 flex items-end gap-2 pt-6 pb-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-thin">
        {data.map((item) => {
          const heightPercent =
            metric === 'occupancy'
              ? Math.min(100, item.effectiveOccupancy)
              : Math.min(100, Math.round((item.revenue / maxRevenue) * 100));

          const barColor =
            item.band === 'high'
              ? 'bg-emerald-500 hover:bg-emerald-600'
              : item.band === 'medium'
              ? 'bg-amber-400 hover:bg-amber-500'
              : 'bg-rose-400 hover:bg-rose-500';

          return (
            <div
              key={item.date}
              className="flex-1 min-w-[28px] max-w-[44px] flex flex-col items-center gap-1 group relative h-full justify-end"
            >
              {/* Тултип при наведении */}
              <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center pointer-events-none whitespace-nowrap bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg">
                <span className="font-semibold">{item.date} ({item.dayOfWeek})</span>
                <span>Загрузка: {item.effectiveOccupancy}%</span>
                <span>Выручка: {item.revenue.toLocaleString('ru-RU')} {currency}</span>
              </div>

              {/* Текстовая метка над столбцом */}
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {metric === 'occupancy' ? `${Math.round(item.effectiveOccupancy)}%` : `${Math.round(item.revenue / 1000)}k`}
              </span>

              {/* Сам столбик */}
              <div
                style={{ height: `${Math.max(6, heightPercent)}%` }}
                className={`w-full rounded-t-md transition-all duration-300 ${barColor}`}
              />
            </div>
          );
        })}
      </div>

      {/* Подписи дат снизу */}
      <div className="flex gap-2 pt-2 text-[10px] text-slate-400 font-mono overflow-x-auto scrollbar-thin">
        {data.map((item) => (
          <div key={item.date} className="flex-1 min-w-[28px] max-w-[44px] text-center">
            <div>{item.date.split('-')[2]}</div>
            <div className="text-[9px] text-slate-500 font-sans">{item.dayOfWeek}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
