create table if not exists public.products (
  id text primary key,
  article_name text not null,
  units text,
  family_name text not null,
  discontinued boolean not null default false,
  source_payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_products (
  product_id text primary key references public.products(id) on delete cascade,
  display_name text,
  units_label text,
  category text not null,
  image_path text,
  sort_order integer not null default 0,
  active boolean not null default true,
  img_hidden boolean not null default false,
  img_x numeric not null default 0,
  img_y numeric not null default 0,
  img_scale numeric not null default 1,
  img_mode text not null default 'original'
    check (img_mode in ('original', 'blend', 'nobg')),
  nobg_version bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_family_name_idx
  on public.products (family_name);

create index if not exists catalog_products_category_sort_order_idx
  on public.catalog_products (category, sort_order);

create table if not exists public.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_admins enable row level security;

create policy "users can read their own catalog admin membership"
  on public.catalog_admins for select
  to authenticated
  using (user_id = auth.uid());

create policy "active source products are publicly readable"
  on public.products for select
  to anon, authenticated
  using (not discontinued);

create policy "catalog products are publicly readable"
  on public.catalog_products for select
  to anon, authenticated
  using (active = true);

create policy "catalog admins manage source products"
  on public.products for all
  to authenticated
  using (exists (select 1 from public.catalog_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.catalog_admins where user_id = auth.uid()));

create policy "catalog admins manage catalog products"
  on public.catalog_products for all
  to authenticated
  using (exists (select 1 from public.catalog_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.catalog_admins where user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-images',
  'catalog-images',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "catalog admins insert images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalog-images'
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  );

create policy "catalog admins update images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  )
  with check (
    bucket_id = 'catalog-images'
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  );

create policy "catalog admins delete images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and exists (select 1 from public.catalog_admins where user_id = auth.uid())
  );
