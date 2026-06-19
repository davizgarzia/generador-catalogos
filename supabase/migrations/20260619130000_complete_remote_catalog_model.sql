alter table public.products
  add column source_type text not null default 'excel'
    check (source_type in ('excel', 'manual'));

alter table public.catalog_categories
  add column subtitle text not null default '',
  add column background_color text not null default '#1A3F66',
  add column accent_color text not null default '#2E70B2',
  add column light_color text not null default '#EBF3FB',
  add column cover_image_path text;

update public.catalog_categories
set subtitle = case code
  when 'alcohol' then 'Aguardientes · Rones · Licores'
  when 'refrescos-maltas-cervezas' then 'Refrescos · Maltas · Cervezas'
  when 'zumos-lacteos' then 'Zumos Naturales · Leches Vegetales'
  when 'legumbres' then 'Legumbres · Granos'
  when 'harinas-pastas' then 'Harinas · Pastas'
  when 'cafe-te' then 'Café · Té · Infusiones'
  when 'condimentos' then 'Salsas · Especias · Aderezos'
  when 'congelados' then 'Productos Congelados'
  when 'helados' then 'Helados · Sorbetes'
  when 'pulpas' then 'Pulpas de Frutas'
  when 'refrigerados' then 'Productos Refrigerados'
  when 'conservas' then 'Conservas · Enlatados'
  when 'galletas' then 'Galletas · Bizcochos'
  when 'golosinas' then 'Caramelos · Chucherías'
  when 'snaks' then 'Snacks · Aperitivos'
  when 'varios' then 'Utensilios · Higiene · Cosmética'
  else ''
end,
cover_image_path = 'category-covers/cat-' || case code
  when 'refrescos-maltas-cervezas' then 'refrescos'
  when 'zumos-lacteos' then 'zumos-lacteos'
  when 'harinas-pastas' then 'harinas'
  when 'cafe-te' then 'cafe-te'
  else code
end || '.png';

alter table public.catalogs
  add column edition text not null default '2025',
  add column tagline text not null default 'Productos Internacionales',
  add column phone text,
  add column whatsapp text,
  add column email text,
  add column website text,
  add column minimum_order text,
  add column business_hours text,
  add column cover_image_path text,
  add column logo_path text,
  add column logo_white_path text,
  add column settings jsonb not null default '{}'::jsonb;

update public.catalogs
set phone = '961 250 501',
    whatsapp = '620 685 462',
    email = 'pedidos@impormed.com',
    website = 'www.impormed.com',
    minimum_order = '70€',
    business_hours = 'Lunes a Jueves · 9h a 18.30h · Viernes · 9h a 13.30h',
    cover_image_path = 'assets/portada.png',
    logo_path = 'assets/logo.jpg',
    logo_white_path = 'assets/logo-white.png',
    settings = jsonb_build_object(
      'info_kicker', 'Distribución para profesionales',
      'info_title', '¿Por qué IMPORMED?',
      'info_description', 'Un catálogo internacional pensado para que restaurantes, tiendas y negocios especializados puedan comprar con agilidad y confianza.'
    )
where slug = 'catalogo-principal';

alter table public.catalog_products
  rename column image_path to original_image_path;

alter table public.catalog_products
  add column processed_image_path text,
  add column image_variant text not null default 'original'
    check (image_variant in ('original', 'processed')),
  add column image_version bigint not null default 0;

update public.catalog_products
set processed_image_path = 'nobg/' || product_id || '.png'
where img_mode = 'nobg';

create table public.catalog_cover_products (
  catalog_id uuid not null references public.catalogs(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (catalog_id, product_id)
);

insert into public.catalog_cover_products (catalog_id, product_id, sort_order)
select c.id, values_table.product_id, values_table.sort_order
from public.catalogs c
cross join (
  values
    ('82018', 10), ('76002', 20), ('63028', 30), ('66003', 40),
    ('69015', 50), ('82010', 60), ('63037', 70), ('69021', 80),
    ('76022', 90), ('63068', 100), ('IP66005', 110), ('72004', 120)
) as values_table(product_id, sort_order)
where c.slug = 'catalogo-principal'
  and exists (select 1 from public.products p where p.id = values_table.product_id)
on conflict do nothing;

create table public.pdf_exports (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.catalogs(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  options jsonb not null default '{}'::jsonb,
  storage_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.catalog_cover_products enable row level security;
alter table public.pdf_exports enable row level security;

create policy "cover products are publicly readable"
  on public.catalog_cover_products for select
  to anon, authenticated
  using (true);

create policy "catalog admins manage cover products"
  on public.catalog_cover_products for all
  to authenticated
  using (exists (select 1 from public.catalog_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.catalog_admins where user_id = auth.uid()));

create policy "admins read their pdf exports"
  on public.pdf_exports for select
  to authenticated
  using (
    requested_by = auth.uid()
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  );

create policy "admins create their pdf exports"
  on public.pdf_exports for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'catalog-assets',
    'catalog-assets',
    true,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'catalog-pdfs',
    'catalog-pdfs',
    false,
    104857600,
    array['application/pdf']
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "catalog admins insert assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalog-assets'
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  );

create policy "catalog admins update assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalog-assets'
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  )
  with check (
    bucket_id = 'catalog-assets'
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  );

create policy "catalog admins delete assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalog-assets'
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  );

create index catalog_cover_products_order_idx
  on public.catalog_cover_products (catalog_id, sort_order);

create index pdf_exports_request_idx
  on public.pdf_exports (requested_by, created_at desc);
