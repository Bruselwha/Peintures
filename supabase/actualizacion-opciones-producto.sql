-- ============================================================================
-- Opciones del producto: color, tamaño, litros y peso
-- Ejecuta esto en Supabase → SQL Editor si tu base ya existe.
-- Es idempotente: puedes ejecutarlo varias veces sin miedo.
--
-- Guarda listas de texto, por ejemplo:
--   { "colors": ["Blanco", "Beige"], "sizes": ["30x60"], "liters": ["4", "20"], "weights": ["1 kg"] }
-- Los productos sin opciones se quedan con {} y el catálogo no muestra selectores.
-- ============================================================================

alter table public.products
  add column if not exists options jsonb not null default '{}'::jsonb;

comment on column public.products.options is
  'Opciones del producto: {colors:[], sizes:[], liters:[], weights:[]}';
