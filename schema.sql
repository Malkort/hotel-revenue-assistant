-- ============================================================================
-- HOTEL REVENUE ASSISTANT - DATABASE SCHEMA (PostgreSQL)
-- ============================================================================

-- Расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Отели (Организации / Объекты размещения)
CREATE TABLE IF NOT EXISTS hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    total_rooms INT NOT NULL CHECK (total_rooms > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'KZT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Фиксированный отель, используемый приложением.
INSERT INTO hotels (id, name, total_rooms, currency)
VALUES ('a1b2c3d4-0000-0000-0000-000000000001', 'Cosmonaut', 92, 'KZT')
ON CONFLICT (id) DO UPDATE SET currency = 'KZT';

-- 2. Пользователи и роли (Admin, Revenue Manager, Front Desk)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'REVENUE_MANAGER', 'FRONT_DESK')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ежедневные показатели и тарифы (соответствует Excel-таблице)
CREATE TABLE IF NOT EXISTS daily_revenue_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    
    -- Сырые операционные данные
    rooms_sold INT NOT NULL DEFAULT 0 CHECK (rooms_sold >= 0),
    ooo_rooms INT NOT NULL DEFAULT 0 CHECK (ooo_rooms >= 0), -- Out of order
    standard_rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (standard_rate >= 0),
    pickup_yesterday INT NOT NULL DEFAULT 0, -- Абронировано с прошлого дня
    
    -- Конкурентный анализ и ценообразование
    senator_rate NUMERIC(12, 2) DEFAULT NULL, -- Тариф отеля-конкурента SENATOR
    updated_rate NUMERIC(12, 2) DEFAULT NULL, -- Обновленный тариф дня
    actualized_occupancy NUMERIC(5, 2) DEFAULT NULL, -- Фиксированный/актуализированный % загрузки
    
    notes TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_hotel_date UNIQUE (hotel_id, metric_date)
);

-- Индексы для быстрой выборки отчетов по периодам
CREATE INDEX IF NOT EXISTS idx_metrics_hotel_date ON daily_revenue_metrics (hotel_id, metric_date);

-- Представление (View) с автоматическим расчетом ключевых показателей (Occupancy, Revenue, ADR, RevPAR)
CREATE OR REPLACE VIEW v_daily_revenue_analytics AS
SELECT 
    m.id,
    m.hotel_id,
    h.name AS hotel_name,
    h.total_rooms,
    m.metric_date,
    TO_CHAR(m.metric_date, 'TMDay') AS day_of_week_name,
    EXTRACT(ISODOW FROM m.metric_date) AS day_of_week_number,
    
    m.rooms_sold,
    m.ooo_rooms,
    -- Доступный фонд = Общий фонд - OOO (не может быть отрицательным)
    GREATEST(h.total_rooms - m.ooo_rooms, 0) AS available_rooms,
    
    -- Расчетный % загрузки: (Продано / Доступный фонд) * 100
    CASE 
        WHEN (h.total_rooms - m.ooo_rooms) > 0 
        THEN ROUND((m.rooms_sold::NUMERIC / (h.total_rooms - m.ooo_rooms)::NUMERIC) * 100, 2)
        ELSE 0 
    END AS calculated_occupancy,
    
    -- Если актуализированный % задан вручную, используем его, иначе расчетный
    COALESCE(
        m.actualized_occupancy, 
        CASE 
            WHEN (h.total_rooms - m.ooo_rooms) > 0 
            THEN ROUND((m.rooms_sold::NUMERIC / (h.total_rooms - m.ooo_rooms)::NUMERIC) * 100, 2)
            ELSE 0 
        END
    ) AS effective_occupancy,

    m.standard_rate,
    m.pickup_yesterday,
    m.senator_rate,
    m.updated_rate,
    
    -- Выручка от номеров (Room Revenue) = Продано * Стандартный тариф (или обновленный)
    ROUND(m.rooms_sold * COALESCE(m.updated_rate, m.standard_rate), 2) AS estimated_revenue,
    
    -- ADR (Average Daily Rate) = Выручка / Продано номеров
    CASE 
        WHEN m.rooms_sold > 0 
        THEN ROUND((m.rooms_sold * COALESCE(m.updated_rate, m.standard_rate)) / m.rooms_sold, 2)
        ELSE 0 
    END AS adr,
    
    -- RevPAR (Revenue Per Available Room) = Выручка / Доступный фонд
    CASE 
        WHEN (h.total_rooms - m.ooo_rooms) > 0 
        THEN ROUND((m.rooms_sold * COALESCE(m.updated_rate, m.standard_rate)) / (h.total_rooms - m.ooo_rooms), 2)
        ELSE 0 
    END AS revpar,
    
    m.notes,
    m.updated_at
FROM daily_revenue_metrics m
JOIN hotels h ON h.id = m.hotel_id;
