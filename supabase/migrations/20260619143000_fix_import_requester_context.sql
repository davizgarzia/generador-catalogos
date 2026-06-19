drop function public.import_catalog_products(jsonb, text);

create function public.import_catalog_products(
  input_products jsonb,
  input_catalog_slug text,
  input_requested_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_catalog_id uuid;
  imported_ids text[];
  unknown_families text[];
  added_count integer;
  updated_count integer;
  discontinued_count integer;
begin
  if not exists (
    select 1 from public.catalog_admins where user_id = input_requested_by
  ) then
    raise exception 'Not authorized';
  end if;

  select id into target_catalog_id
  from public.catalogs
  where slug = input_catalog_slug;

  if target_catalog_id is null then
    raise exception 'Catalog not found: %', input_catalog_slug;
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

  insert into public.catalog_products (catalog_id, product_id, sort_order, active)
  select target_catalog_id, item->>'id', (item->>'sort_order')::integer, true
  from jsonb_array_elements(input_products) item
  on conflict (catalog_id, product_id) do update
  set sort_order = excluded.sort_order,
      active = true,
      updated_at = now();

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
    and catalog_product.catalog_id = target_catalog_id
    and product.source_type = 'excel'
    and product.discontinued = true;

  return jsonb_build_object(
    'total', jsonb_array_length(input_products),
    'added', added_count,
    'updated', updated_count,
    'discontinued', discontinued_count
  );
end;
$$;

revoke all on function public.import_catalog_products(jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.import_catalog_products(jsonb, text, uuid) to service_role;
