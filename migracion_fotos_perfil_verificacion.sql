-- ============================================================
-- Migración IoTGaraje — fotos de garajes, perfil y verificación
-- Ejecutar UNA sola vez en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Fotos de garajes (lista de URLs públicas, máximo 3)
alter table garajes add column if not exists fotos jsonb not null default '[]';

-- 2) Perfil: teléfono del usuario
alter table usuarios add column if not exists telefono text;

-- 3) Verificación de email con código de 6 dígitos
alter table usuarios add column if not exists codigo_verificacion text;
alter table usuarios add column if not exists codigo_expira timestamptz;

-- 4) Bucket público para las fotos (Storage)
insert into storage.buckets (id, name, public)
values ('garajes', 'garajes', true)
on conflict (id) do nothing;

-- 5) Políticas del bucket: lectura pública y subida/borrado desde el backend
drop policy if exists "garajes_fotos_lectura" on storage.objects;
create policy "garajes_fotos_lectura" on storage.objects
  for select using (bucket_id = 'garajes');

drop policy if exists "garajes_fotos_subida" on storage.objects;
create policy "garajes_fotos_subida" on storage.objects
  for insert with check (bucket_id = 'garajes');

drop policy if exists "garajes_fotos_borrado" on storage.objects;
create policy "garajes_fotos_borrado" on storage.objects
  for delete using (bucket_id = 'garajes');
