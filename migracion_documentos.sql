-- ============================================================
-- Migración IoTGaraje — documentos, altura y datos extra del vehículo
-- Ejecutar UNA sola vez en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1) GARAJES: tercera dimensión (altura) + documentos del dueño
-- ------------------------------------------------------------
alter table garajes add column if not exists altura        numeric; -- metros
alter table garajes add column if not exists doc_carnet    text;    -- URL foto carnet
alter table garajes add column if not exists doc_propiedad text;    -- URL tarjeta propiedad inmueble

-- ------------------------------------------------------------
-- 2) VEHÍCULOS: datos completos + documento de propiedad
-- ------------------------------------------------------------
alter table vehiculos add column if not exists asientos      integer;
alter table vehiculos add column if not exists estado_vehiculo text;  -- 'bueno'|'regular'|'malo'
alter table vehiculos add column if not exists dueno_nombre  text;    -- nombre del propietario real
alter table vehiculos add column if not exists doc_propiedad text;    -- URL tarjeta propiedad vehículo

-- ------------------------------------------------------------
-- 3) Bucket para documentos (carnet, tarjetas de propiedad)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do nothing;

drop policy if exists "documentos_lectura" on storage.objects;
create policy "documentos_lectura" on storage.objects
  for select using (bucket_id = 'documentos');

drop policy if exists "documentos_subida" on storage.objects;
create policy "documentos_subida" on storage.objects
  for insert with check (bucket_id = 'documentos');

drop policy if exists "documentos_borrado" on storage.objects;
create policy "documentos_borrado" on storage.objects
  for delete using (bucket_id = 'documentos');
