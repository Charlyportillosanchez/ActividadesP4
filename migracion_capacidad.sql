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

-- 4) IMPORTANTE: borrado en cascada.
--    Supabase tiene RLS que impide que el backend borre filas de "reservas",
--    por eso eliminar un garaje con reservas fallaba. Con ON DELETE CASCADE,
--    al borrar un garaje la base de datos elimina sus reservas automáticamente
--    (la cascada se ejecuta a nivel de Postgres y no la frena el RLS).
alter table reservas drop constraint if exists reservas_garaje_id_fkey;
alter table reservas
  add constraint reservas_garaje_id_fkey
  foreign key (garaje_id) references garajes(id) on delete cascade;
