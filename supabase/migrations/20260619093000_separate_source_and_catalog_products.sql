create table public.catalog_products (
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

insert into public.catalog_products (
  product_id,
  display_name,
  units_label,
  category,
  image_path,
  sort_order,
  active,
  img_hidden,
  img_x,
  img_y,
  img_scale,
  img_mode,
  nobg_version,
  created_at,
  updated_at
)
select
  p.id,
  o.name,
  coalesce(o.units_label, p.units_label),
  p.category,
  p.image_path,
  p.sort_order,
  p.active,
  coalesce(o.img_hidden, false),
  coalesce(o.img_x, 0),
  coalesce(o.img_y, 0),
  coalesce(o.img_scale, 1),
  coalesce(o.img_mode, 'original'),
  o.nobg_version,
  p.created_at,
  greatest(p.updated_at, coalesce(o.updated_at, p.updated_at))
from public.products p
left join public.product_overrides o on o.product_id = p.id;

alter table public.products rename column full_name to article_name;
alter table public.products rename column units_label to units;
alter table public.products rename column category to family_name;

alter table public.products
  add column discontinued boolean not null default false,
  add column source_payload jsonb not null default '{}'::jsonb,
  add column source_updated_at timestamptz;

drop policy if exists "catalog products are publicly readable" on public.products;
drop policy if exists "authenticated users manage products" on public.products;

alter table public.products
  drop column name,
  drop column image_path,
  drop column sort_order,
  drop column active;

drop table public.product_overrides;

drop index if exists public.products_category_sort_order_idx;
create index products_family_name_idx on public.products (family_name);
create index catalog_products_category_sort_order_idx
  on public.catalog_products (category, sort_order);

alter table public.catalog_products enable row level security;

create policy "active source products are publicly readable"
  on public.products for select
  to anon, authenticated
  using (not discontinued);

create policy "authenticated users manage source products"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

create policy "catalog products are publicly readable"
  on public.catalog_products for select
  to anon, authenticated
  using (active = true);

create policy "authenticated users manage catalog products"
  on public.catalog_products for all
  to authenticated
  using (true)
  with check (true);
