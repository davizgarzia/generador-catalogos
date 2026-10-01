-- Imágenes propias por catálogo para las hojas de relleno de la versión
-- impresa y la contraportada. Viven en R2 bajo catalog/{catalog_id}/… y aquí
-- solo se guardan las rutas. Hueco/null = fallback de marca (portadas de
-- categoría barajadas / contraportada generada con logo y contacto).

alter table public.catalogs
  add column filler_images jsonb not null default '[]'::jsonb,
  add column back_cover_image_path text;
