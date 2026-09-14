-- 1. Datos comerciales globales: una sola fila de empresa compartida por todos
--    los catálogos (antes cada catálogo duplicaba teléfono, email, etc.).
-- 2. La importación de Excel pasa a sincronizar SOLO el maestro de productos;
--    la composición de cada catálogo se gestiona desde la UI.

create table public.company_profile (
  id smallint primary key default 1 check (id = 1),
  name text,
  phone text,
  whatsapp text,
  email text,
  website text,
  business_hours text,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.company_profile enable row level security;

create policy "company profile readable by authenticated users"
  on public.company_profile for select
  to authenticated
  using (true);

create policy "catalog admins manage company profile"
  on public.company_profile for all
  to authenticated
  using (exists (select 1 from public.catalog_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.catalog_admins where user_id = auth.uid()));

insert into public.company_profile (id, name, phone, whatsapp, email, website, business_hours, settings)
select 1, name, phone, whatsapp, email, website, business_hours, coalesce(settings, '{}'::jsonb)
from public.catalogs
order by created_at asc
limit 1
on conflict (id) do nothing;

-- RPC de sincronización del maestro. Las bajas vuelven a ser globales (es la
-- fuente de verdad del stock) pero opcionales; al reincorporarse un producto,
-- se reactiva su vínculo en todos los catálogos donde la baja lo desactivó.

-- La RPC import_catalog_products aparece en migraciones antiguas pero nunca
-- llegó a existir en la base de datos remota (la Edge Function implementaba
-- la importación por su cuenta): drop defensivo por si acaso.
drop function if exists public.import_catalog_products(jsonb, text, uuid);
drop function if exists public.import_catalog_products(jsonb, text, uuid, boolean);
drop function if exists public.import_catalog_products(jsonb, text);

create function public.import_master_products(
  input_products jsonb,
  input_requested_by uuid,
  input_mark_missing boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  imported_ids text[];
  reactivated_ids text[];
  unknown_families text[];
  added_count integer;
  updated_count integer;
  discontinued_count integer := 0;
begin
  if not exists (
    select 1 from public.catalog_admins where user_id = input_requested_by
  ) then
    raise exception 'Not authorized';
  end if;

  select array_agg(distinct item->>'family_name')
  into unknown_families
  from jsonb_array_elements(input_products) item
  left join public.catalog_categories category
    on category.source_name = item->>'family_name'
  where category.id is null;

  if coalesce(array_length(unknown_families, 1), 0) > 0 then
    raise exception 'Unknown families: %', array_to_string(unknown_families, ', ');
  end if;

  select array_agg(item->>'id')
  into imported_ids
  from jsonb_array_elements(input_products) item;

  select count(*) into added_count
  from jsonb_array_elements(input_products) item
  left join public.products product on product.id = item->>'id'
  where product.id is null;

  select count(*) into updated_count
  from jsonb_array_elements(input_products) item
  join public.products product on product.id = item->>'id';

  select coalesce(array_agg(id), '{}') into reactivated_ids
  from public.products
  where id = any(coalesce(imported_ids, '{}'))
    and source_type = 'excel'
    and discontinued = true;

  insert into public.products (
    id, article_name, display_name, stock_units, units_per_case, category_id,
    source_type, discontinued, imported_at, updated_at
  )
  select
    item->>'id',
    item->>'article_name',
    coalesce(existing.display_name, item->>'display_name', item->>'article_name'),
    nullif(item->>'stock_units', '')::numeric(12,3),
    nullif(item->>'units_per_case', '')::integer,
    category.id,
    'excel',
    false,
    now(),
    now()
  from jsonb_array_elements(input_products) item
  join public.catalog_categories category
    on category.source_name = item->>'family_name'
  left join public.products existing
    on existing.id = item->>'id'
  on conflict (id) do update
  set article_name = excluded.article_name,
      stock_units = excluded.stock_units,
      units_per_case = coalesce(excluded.units_per_case, products.units_per_case),
      category_id = excluded.category_id,
      discontinued = false,
      imported_at = now(),
      updated_at = now()
  where products.source_type = 'excel';

  update public.catalog_products
  set active = true, updated_at = now()
  where product_id = any(reactivated_ids)
    and active = false;

  if input_mark_missing then
    update public.products
    set discontinued = true, updated_at = now()
    where source_type = 'excel'
      and not (id = any(imported_ids))
      and discontinued = false;

    get diagnostics discontinued_count = row_count;

    update public.catalog_products catalog_product
    set active = false, updated_at = now()
    from public.products product
    where catalog_product.product_id = product.id
      and product.source_type = 'excel'
      and product.discontinued = true
      and catalog_product.active = true;
  end if;

  return jsonb_build_object(
    'total', jsonb_array_length(input_products),
    'added', added_count,
    'updated', updated_count,
    'discontinued', discontinued_count,
    'reactivated', coalesce(array_length(reactivated_ids, 1), 0)
  );
end;
$$;

revoke all on function public.import_master_products(jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.import_master_products(jsonb, uuid, boolean) to service_role;
