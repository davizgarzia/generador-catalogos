create index catalog_cover_products_product_id_idx
  on public.catalog_cover_products (product_id);

create index pdf_exports_catalog_id_idx
  on public.pdf_exports (catalog_id);
