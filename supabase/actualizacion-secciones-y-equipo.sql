-- ============================================================================
-- Secciones editables del catálogo + información ampliada del equipo
-- Supabase → SQL Editor. Idempotente: se puede ejecutar varias veces.
-- ============================================================================

-- Secciones del catálogo (Calidad, Equipamiento, Reseñas, Equipo)
alter table public.businesses
  add column if not exists sections jsonb not null default '{}'::jsonb;

comment on column public.businesses.sections is
  'Secciones editables del catálogo: {quality:{...}, equipment:{...}, reviews:{...}, team:{...}}';

-- Ficha ampliada de cada profesional
alter table public.professionals
  add column if not exists photo_url     text not null default '',
  add column if not exists bio           text not null default '',
  add column if not exists website       text not null default '',
  add column if not exists phone         text not null default '',
  add column if not exists whatsapp      text not null default '',
  add column if not exists city          text not null default '',
  add column if not exists rating        numeric(3,2),
  add column if not exists reviews_count integer not null default 0,
  add column if not exists price         numeric(12,2),
  add column if not exists price_note    text not null default '',
  add column if not exists sort_order    integer not null default 0;

create index if not exists professionals_order_idx
  on public.professionals (business_id, sort_order);
