-- ============================================================
-- Migración IoTGaraje — capacidad de garajes y espacios por reserva
-- Ejecutar UNA sola vez en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Nuevas columnas (no rompe nada si ya existen)
alter table garajes  add column if not exists capacidad integer not null default 1;
alter table reservas add column if not exists espacios  integer not null default 1;

-- 2) Capacidad inicial razonable para los garajes que ya estaban creados
update garajes set capacidad = 20 where capacidad is null or capacidad <= 1;

-- 3) Marcar todos los garajes como disponibles.
--    El backend recalcula la disponibilidad real según las reservas activas.
update garajes set disponible = true;
