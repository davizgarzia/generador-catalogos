-- El panel exige sesión para todo, así que no hay motivo para exponer los datos
-- (incluido el stock del maestro de productos) a la clave anon publicada en el bundle.
-- Las políticas de administración existentes ya cubren el acceso completo de los admins.

drop policy if exists "active source products are publicly readable" on public.products;
create policy "active source products are readable by authenticated users"
  on public.products for select
  to authenticated
  using (not discontinued);

drop policy if exists "catalog products are publicly readable" on public.catalog_products;
create policy "catalog products are readable by authenticated users"
  on public.catalog_products for select
  to authenticated
  using (active = true);

drop policy if exists "catalog categories are publicly readable" on public.catalog_categories;
create policy "catalog categories are readable by authenticated users"
  on public.catalog_categories for select
  to authenticated
  using (active = true);

drop policy if exists "active catalogs are publicly readable" on public.catalogs;
create policy "active catalogs are readable by authenticated users"
  on public.catalogs for select
  to authenticated
  using (active = true);

drop policy if exists "cover products are publicly readable" on public.catalog_cover_products;
create policy "cover products are readable by authenticated users"
  on public.catalog_cover_products for select
  to authenticated
  using (true);
