'use client';

import React, { useState, useEffect } from 'react';
import { DailyMetricInput, DailyMetricRow } from '../lib/types';
import { 
  calculateAvailableRooms, 
  calculateOccupancy, 
  calculateRevenue, 
  calculateRevPAR, 
  calculateADR, 
  getOccupancyBand, 
  getOccupancyStyles 
} from '../lib/calculations';
import { X, Save, Calculator, AlertCircle, RefreshCw } from 'lucide-react';

interface DailyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: DailyMetricRow | null;
  totalRooms: number;
  currency: string;
  onSave: (updated: DailyMetricInput) => void;
}

export const DailyEditModal: React.FC<DailyEditModalProps> = ({
  isOpen,
  onClose,
  row,
  totalRooms,
  currency,
  onSave,
}) => {
  const [formData, setFormData] = useState<DailyMetricInput>({
    date: '',
    roomsSold: 0,
    oooRooms: 0,
    standardRate: 0,
    pickupYesterday: 0,
    actualizedOccupancy: null,
    senatorRate: null,
    updatedRate: null,
    notes: '',
  });

  useEffect(() => {
    if (row) {
      setFormData({
        date: row.date,
        roomsSold: row.roomsSold,
        oooRooms: row.oooRooms,
        standardRate: row.standardRate,
        pickupYesterday: row.pickupYesterday,
        actualizedOccupancy: row.actualizedOccupancy ?? null,
        senatorRate: row.senatorRate ?? null,
        updatedRate: row.updatedRate ?? null,
        notes: row.notes || '',
      });
    }
  }, [row]);

  if (!isOpen || !row) return null;

  // Динамический пересчет прямо в форме
  const availableRooms = calculateAvailableRooms(totalRooms, formData.oooRooms);
  const autoOccupancy = calculateOccupancy(formData.roomsSold, availableRooms);
  const effectiveOccupancy =
    formData.actualizedOccupancy !== null && !isNaN(Number(formData.actualizedOccupancy))
      ? Number(formData.actualizedOccupancy)
      : autoOccupancy;

  const currentRate = (formData.updatedRate && formData.updatedRate > 0) 
    ? formData.updatedRate 
    : formData.standardRate;
  const revenue = calculateRevenue(formData.roomsSold, currentRate);
  const adr = calculateADR(revenue, formData.roomsSold);
  const revpar = calculateRevPAR(revenue, availableRooms);
  const band = getOccupancyBand(effectiveOccupancy);
  const styles = getOccupancyStyles(band);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden transition-all my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Редактирование показателей на {formData.date}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                {row.dayOfWeek}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Общий номерной фонд: <span className="font-semibold text-slate-700 dark:text-slate-200">{totalRooms}</span> номеров
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Быстрая панель расчетных метрик (Live KPI preview) */}
        <div className="p-4 mx-6 mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <span className="text-[11px] uppercase text-slate-500 font-semibold block">Доступный фонд</span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
              {availableRooms} ном.
            </span>
            <span className="text-[10px] text-slate-400 block">(фонд - OOO)</span>
          </div>

          <div>
            <span className="text-[11px] uppercase text-slate-500 font-semibold block">Статус загрузки</span>
            <span className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded ${styles.badge}`}>
              {effectiveOccupancy}% • {styles.label.split(' ')[0]}
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase text-slate-500 font-semibold block">Выручка дня</span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
              {revenue.toLocaleString('ru-RU')} {currency}
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase text-slate-500 font-semibold block">RevPAR</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {revpar.toLocaleString('ru-RU')} {currency}
            </span>
          </div>
        </div>

        {/* Форма ввода параметров */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Продано номеров */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Продано номеров *
              </label>
              <input
                type="number"
                min="0"
                max={totalRooms}
                required
                value={formData.roomsSold}
                onChange={(e) => setFormData({ ...formData, roomsSold: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Номера OOO (Out of order) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Номера Out of Order (Ремонт/Блок)
              </label>
              <input
                type="number"
                min="0"
                max={totalRooms}
                value={formData.oooRooms}
                onChange={(e) => setFormData({ ...formData, oooRooms: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Тариф стандарт */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Тариф стандарт ({currency}) *
              </label>
              <input
                type="number"
                min="0"
                step="50"
                required
                value={formData.standardRate}
                onChange={(e) => setFormData({ ...formData, standardRate: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Забронировано с прошлого дня (Pickup) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Абронировано с прошлого дня (Pickup)
              </label>
              <input
                type="number"
                value={formData.pickupYesterday}
                onChange={(e) => setFormData({ ...formData, pickupYesterday: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Актуализированный % загрузки */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Актуализированный % загрузки
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, actualizedOccupancy: null })}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                  title="Использовать точный расчет"
                >
                  <RefreshCw className="w-3 h-3" /> Авто: {autoOccupancy}%
                </button>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder={`Автоматически: ${autoOccupancy}%`}
                value={formData.actualizedOccupancy ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    actualizedOccupancy: e.target.value === '' ? null : parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Текущий тариф в отеле "SENATOR" */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Текущий тариф отеля "SENATOR" ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="Например, 5200"
                value={formData.senatorRate ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    senatorRate: e.target.value === '' ? null : parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Обновленный тариф дня */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Обновленный тариф дня (решение Revenue Manager, {currency})
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="Оставьте пустым для использования Стандартного"
                  value={formData.updatedRate ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      updatedRate: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  className="flex-1 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-400 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, updatedRate: formData.standardRate })}
                  className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Скопировать стандарт
                </button>
              </div>
            </div>
          </div>

          {/* Заметки / обоснование изменения тарифа */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Комментарий / Обоснование стратегии
            </label>
            <input
              type="text"
              placeholder="Например: Повышение из-за выставки в Экспоцентре, Senator поднял цену"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Кнопки действий */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              Сохранить изменения
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
