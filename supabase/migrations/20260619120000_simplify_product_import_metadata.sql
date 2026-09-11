alter table public.products
  drop column source_payload;

alter table public.products
  rename column source_updated_at to imported_at;
