create policy "users can read their own catalog admin membership"
  on public.catalog_admins for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "catalog admins manage source products" on public.products;
drop policy if exists "catalog admins manage catalog products" on public.catalog_products;
drop policy if exists "catalog admins insert images" on storage.objects;
drop policy if exists "catalog admins update images" on storage.objects;
drop policy if exists "catalog admins delete images" on storage.objects;

drop function if exists public.is_catalog_admin();

create policy "catalog admins manage source products"
  on public.products for all
  to authenticated
  using (
    exists (
      select 1 from public.catalog_admins
      where user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.catalog_admins
      where user_id = auth.uid()
    )
  );

create policy "catalog admins manage catalog products"
  on public.catalog_products for all
  to authenticated
  using (
    exists (
      select 1 from public.catalog_admins
      where user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.catalog_admins
      where user_id = auth.uid()
    )
  );

create policy "catalog admins insert images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalog-images'
    and exists (
      select 1 from public.catalog_admins
      where user_id = auth.uid()
    )
  );

create policy "catalog admins update images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and exists (
      select 1 from public.catalog_admins
      where user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'catalog-images'
    and exists (
      select 1 from public.catalog_admins
      where user_id = auth.uid()
    )
  );

create policy "catalog admins delete images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and exists (
      select 1 from public.catalog_admins
      where user_id = auth.uid()
    )
  );
