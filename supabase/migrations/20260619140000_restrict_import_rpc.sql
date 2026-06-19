revoke all on function public.import_catalog_products(jsonb, text) from anon, authenticated;
grant execute on function public.import_catalog_products(jsonb, text) to service_role;
