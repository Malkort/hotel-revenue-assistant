'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DailyMetricInput } from '../lib/types';
import { calculateRowMetrics } from '../lib/calculations';
import { CalendarGrid } from '../components/CalendarGrid';
import { DashboardKPI } from '../components/DashboardKPI';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { parseMetricsFile } from '../lib/importMetrics';
import type { GoogleRateResult, DailyMetricInput as DailyMetric } from '../lib/types';
import {
  Building2,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarDays,
} from 'lucide-react';

const TOTAL_ROOMS = 92;
const HOTEL_NAME = 'Cosmonaut';
const CURRENCY = '₸'; // Казахстанский тенге (KZT)

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function Home() {
  const [rawRecords, setRawRecords] = useState<DailyMetricInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [googleRatesMessage, setGoogleRatesMessage] = useState<string | null>(null);
  const [googleRatesError, setGoogleRatesError] = useState<string | null>(null);
  const [isFetchingGoogleRates, setIsFetchingGoogleRates] = useState(false);

  // Загрузка данных из Supabase через API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/metrics');
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Ошибка загрузки');
      setRawRecords(json.data);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Пересчет расчетных метрик из сырых данных
  const calculatedRows = useMemo(
    () => rawRecords.map((item) => calculateRowMetrics(item, TOTAL_ROOMS)),
    [rawRecords]
  );

  // Сохранение изменений в Supabase
  const handleSaveRow = async (updated: DailyMetricInput) => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRawRecords((prev) => {
        const existing = prev.some((item) => item.date === updated.date);
        const next = existing
          ? prev.map((item) => item.date === updated.date ? updated : item)
          : [...prev, updated];
        return next.sort((a, b) => a.date.localeCompare(b.date));
      });
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      throw error;
    }
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleAddNextDay = async () => {
    const lastDate = rawRecords.length > 0
      ? new Date(rawRecords[rawRecords.length - 1].date)
      : new Date();
    lastDate.setDate(lastDate.getDate() + 1);
    const nextDateStr = lastDate.toISOString().slice(0, 10);

    const newRecord: DailyMetricInput = {
      date: nextDateStr,
      roomsSold: 20,
      oooRooms: 0,
      standardRate: 4500,
      pickupYesterday: 0,
      actualizedOccupancy: null,
      senatorRate: 4800,
      updatedRate: null,
      notes: 'Новый день',
    };

    try {
      await handleSaveRow(newRecord);
    } catch {
      // The save status above already reports the failure.
    }
  };

  const handleImportFile = async (file: File) => {
    setImportMessage(null);
    setImportError(null);
    setIsImporting(true);
    try {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('Файл превышает максимальный размер 20 МБ.');
      }
      const importedRows = await parseMetricsFile(file, TOTAL_ROOMS);
      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedRows),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? 'Не удалось сохранить импортированные данные.');
      }
      setRawRecords((prev) => {
        const byDate = new Map(prev.map((row) => [row.date, row]));
        importedRows.forEach((row) => byDate.set(row.date, row));
        return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
      });
      setImportMessage(`Импортировано и сохранено строк: ${importedRows.length}. Данные на совпадающие даты обновлены.`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Не удалось импортировать файл.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFetchGoogleRates = async (year: number, month: number) => {
    setGoogleRatesMessage(null);
    setGoogleRatesError(null);
    setIsFetchingGoogleRates(true);

    try {
      const response = await fetch(`/api/google-rates?year=${year}&month=${month}`);
      const result = await response.json() as {
        success: boolean;
        data?: GoogleRateResult[];
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? 'Не удалось получить тарифы Google Travel.');
      }

      const pricedRates = result.data.filter(
        (item): item is GoogleRateResult & { rate: number } => item.rate !== null
      );
      if (pricedRates.length > 0) {
        const existingByDate = new Map(rawRecords.map((row) => [row.date, row]));
        const rowsToSave: DailyMetric[] = pricedRates.map(({ date, rate }) => ({
          ...(existingByDate.get(date) ?? {
            date,
            roomsSold: 0,
            oooRooms: 0,
            standardRate: 0,
            pickupYesterday: 0,
            actualizedOccupancy: null,
            senatorRate: null,
            updatedRate: null,
            notes: '',
          }),
          standardRate: rate,
        }));

        const saveResponse = await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rowsToSave),
        });
        const saveResult = await saveResponse.json();
        if (!saveResponse.ok || !saveResult.success) {
          throw new Error(saveResult.error ?? 'Не удалось сохранить тарифы в базу данных.');
        }

        setRawRecords((previous) => {
          const byDate = new Map(previous.map((row) => [row.date, row]));
          rowsToSave.forEach((row) => byDate.set(row.date, row));
          return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
        });
      }

      const officialCount = pricedRates.filter((item) => item.source === 'official').length;
      const partnerCount = pricedRates.filter((item) => item.source === 'partner').length;
      const missingCount = result.data.length - pricedRates.length;
      setGoogleRatesMessage(
        `Обновлено тарифов: ${pricedRates.length} (официальный сайт: ${officialCount}, партнёры Google: ${partnerCount}). Даты без найденной цены: ${missingCount}; прежние значения сохранены.`
      );
    } catch (error) {
      setGoogleRatesError(error instanceof Error ? error.message : 'Не удалось получить тарифы Google Travel.');
    } finally {
      setIsFetchingGoogleRates(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Шапка */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Hotel Revenue Assistant
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  MVP v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Объект:{' '}
                <strong className="text-slate-700 dark:text-slate-300">{HOTEL_NAME}</strong> •
                Фонд:{' '}
                <strong className="text-slate-700 dark:text-slate-300">{TOTAL_ROOMS} номеров</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Статус сохранения */}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Сохранение...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Сохранено в БД
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                Ошибка сохранения
              </span>
            )}

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>

            <button
              onClick={handleAddNextDay}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-40"
            >
              <PlusCircle className="w-4 h-4" />
              Добавить день
            </button>
          </div>
        </header>

        {/* Статус загрузки */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span>Загрузка данных из базы данных...</span>
          </div>
        )}

        {loadError && !loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <strong>Ошибка подключения к базе данных:</strong> {loadError}
            </div>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {/* 1. KPI карточки */}
            <DashboardKPI data={calculatedRows} totalRooms={TOTAL_ROOMS} currency={CURRENCY} />

            {/* 2. График */}
            <AnalyticsCharts data={calculatedRows} currency={CURRENCY} />

            {/* 3. Таблица-календарь */}
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                  Forecast Calendar (данные из Supabase)
                </h2>
                <p className="text-xs text-slate-500">
                  Синие поля редактируются отдельно и сохраняются автоматически; вычисляемые показатели обновляются на основе номерного фонда {TOTAL_ROOMS}
                </p>
              </div>
              <CalendarGrid
                data={calculatedRows}
                totalRooms={TOTAL_ROOMS}
                currency={CURRENCY}
                onSaveCell={handleSaveRow}
                importMessage={importMessage}
                importError={importError}
                isImporting={isImporting}
                onImportFile={handleImportFile}
                onFetchGoogleRates={handleFetchGoogleRates}
                isFetchingGoogleRates={isFetchingGoogleRates}
                googleRatesMessage={googleRatesMessage}
                googleRatesError={googleRatesError}
              />
            </section>
          </>
        )}
      </div>

    </main>
  );
}
