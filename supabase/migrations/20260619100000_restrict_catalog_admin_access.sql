create table public.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.catalog_admins enable row level security;

create or replace function public.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.catalog_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_catalog_admin() from public;
grant execute on function public.is_catalog_admin() to anon, authenticated;

drop policy if exists "authenticated users manage source products" on public.products;
drop policy if exists "authenticated users manage catalog products" on public.catalog_products;

create policy "catalog admins manage source products"
  on public.products for all
  to authenticated
  using (public.is_catalog_admin())
  with check (public.is_catalog_admin());

create policy "catalog admins manage catalog products"
  on public.catalog_products for all
  to authenticated
  using (public.is_catalog_admin())
  with check (public.is_catalog_admin());

drop policy if exists "catalog images are publicly readable" on storage.objects;
drop policy if exists "authenticated users manage catalog images" on storage.objects;

create policy "catalog admins insert images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalog-images'
    and public.is_catalog_admin()
  );

create policy "catalog admins update images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and public.is_catalog_admin()
  )
  with check (
    bucket_id = 'catalog-images'
    and public.is_catalog_admin()
  );

create policy "catalog admins delete images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and public.is_catalog_admin()
  );
