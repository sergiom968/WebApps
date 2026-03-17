-- ============================================================
-- TurnoShift — Esquema de base de datos para Supabase v1.3
-- IMPORTANTE: user_id es TEXT (device_id de la app, no auth.users)
-- RLS desactivado por defecto — la app filtra por user_id
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── turnos ──────────────────────────────────────────────────
create table if not exists public.turnos (
  id           uuid primary key default uuid_generate_v4(),
  user_id      text not null,
  lugar        text not null,
  nombre       text not null,
  inicio       text,
  fin          text,
  all_day      boolean not null default false,
  total_horas  numeric(5,2) not null default 0,
  color        text not null default '#5B5FED',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── asignaciones ────────────────────────────────────────────
create table if not exists public.asignaciones (
  id               uuid primary key default uuid_generate_v4(),
  user_id          text not null,
  turno_id         uuid not null references public.turnos(id) on delete cascade,
  fecha            date not null,
  override_inicio  text,
  override_fin     text,
  override_all_day boolean,
  override_horas   numeric(5,2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, turno_id, fecha)
);

-- ── eventos ─────────────────────────────────────────────────
create table if not exists public.eventos (
  id         uuid primary key default uuid_generate_v4(),
  user_id    text not null,
  nombre     text not null,
  fecha      date not null,
  inicio     text not null,
  fin        text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── informes ────────────────────────────────────────────────
create table if not exists public.informes (
  id           uuid primary key default uuid_generate_v4(),
  user_id      text not null,
  titulo       text not null,
  turno_ids    uuid[] not null default '{}',
  salario_base jsonb not null default '{"nombre":"Salario por hora","valorHora":0}',
  pagos_extra  jsonb not null default '[]',
  pagos_fijos  jsonb not null default '[]',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Índices ──────────────────────────────────────────────────
create index if not exists idx_turnos_user    on public.turnos(user_id);
create index if not exists idx_asig_user      on public.asignaciones(user_id);
create index if not exists idx_asig_fecha     on public.asignaciones(fecha);
create index if not exists idx_asig_turno     on public.asignaciones(turno_id);
create index if not exists idx_eventos_user   on public.eventos(user_id);
create index if not exists idx_eventos_fecha  on public.eventos(fecha);
create index if not exists idx_informes_user  on public.informes(user_id);

-- ── Trigger updated_at ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace trigger trg_turnos_upd
  before update on public.turnos for each row execute function public.set_updated_at();
create or replace trigger trg_asig_upd
  before update on public.asignaciones for each row execute function public.set_updated_at();
create or replace trigger trg_eventos_upd
  before update on public.eventos for each row execute function public.set_updated_at();
create or replace trigger trg_informes_upd
  before update on public.informes for each row execute function public.set_updated_at();

-- ============================================================
-- PASO OBLIGATORIO: DESACTIVAR RLS
-- Sin esto, todas las requests con anon key dan 401.
-- La app filtra por user_id en cada query, por lo que
-- desactivar RLS es seguro para este caso de uso.
-- ============================================================
alter table public.turnos       disable row level security;
alter table public.asignaciones disable row level security;
alter table public.eventos      disable row level security;
alter table public.informes     disable row level security;

-- ============================================================
-- MAPEO localStorage → columnas SQL
-- ============================================================
-- turnoshift_device_id (localStorage) → user_id en todas las tablas
--
-- shifts[].id              → turnos.id (uuid)
-- shifts[].lugar           → turnos.lugar
-- shifts[].nombre          → turnos.nombre
-- shifts[].inicio          → turnos.inicio (HH:MM)
-- shifts[].fin             → turnos.fin    (HH:MM)
-- shifts[].allDay          → turnos.all_day
-- shifts[].totalHoras      → turnos.total_horas
-- shifts[].color           → turnos.color (#hex)
--
-- assignments[].id             → asignaciones.id
-- assignments[].shiftId        → asignaciones.turno_id
-- assignments[].fecha          → asignaciones.fecha (YYYY-MM-DD)
-- assignments[].overrideInicio → asignaciones.override_inicio
-- assignments[].overrideFin    → asignaciones.override_fin
-- assignments[].overrideAllDay → asignaciones.override_all_day
-- assignments[].overrideHoras  → asignaciones.override_horas
--
-- events[].id              → eventos.id
-- events[].nombre          → eventos.nombre
-- events[].fecha           → eventos.fecha
-- events[].inicio          → eventos.inicio
-- events[].fin             → eventos.fin
--
-- informes[].id            → informes.id
-- informes[].titulo        → informes.titulo
-- informes[].turnoIds      → informes.turno_ids (uuid[])
-- informes[].salarioBase   → informes.salario_base (jsonb)
-- informes[].pagosExtra    → informes.pagos_extra (jsonb)
-- informes[].pagosFijos    → informes.pagos_fijos (jsonb)
--   pagosFijos[n].mes      → .mes ("YYYY-MM" | null)


-- ============================================================
-- TurnoShift — Fix de permisos para rol anon
-- Ejecutar en SQL Editor de Supabase si aparece:
-- "permission denied for schema public"
-- ============================================================

-- 1. Dar acceso al schema public a los roles que usa Supabase
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

-- 2. Dar permisos completos sobre las tablas al rol anon
grant all privileges on table public.turnos       to anon;
grant all privileges on table public.asignaciones to anon;
grant all privileges on table public.eventos      to anon;
grant all privileges on table public.informes     to anon;

-- 3. Mismos permisos para authenticated y service_role
grant all privileges on table public.turnos       to authenticated;
grant all privileges on table public.asignaciones to authenticated;
grant all privileges on table public.eventos      to authenticated;
grant all privileges on table public.informes     to authenticated;

grant all privileges on table public.turnos       to service_role;
grant all privileges on table public.asignaciones to service_role;
grant all privileges on table public.eventos      to service_role;
grant all privileges on table public.informes     to service_role;

-- 4. Permisos sobre secuencias (para uuid_generate_v4 y defaults)
grant usage, select on all sequences in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to service_role;

-- 5. Para tablas futuras, aplicar automáticamente
alter default privileges in schema public
  grant all privileges on tables to anon;

alter default privileges in schema public
  grant all privileges on tables to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to anon;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- 6. Confirmar que RLS sigue desactivado
alter table public.turnos       disable row level security;
alter table public.asignaciones disable row level security;
alter table public.eventos      disable row level security;
alter table public.informes     disable row level security;