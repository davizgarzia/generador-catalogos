alter table public.products
  alter column stock_units type numeric(12,3)
  using stock_units::numeric(12,3);
