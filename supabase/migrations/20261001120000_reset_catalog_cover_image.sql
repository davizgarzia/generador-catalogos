-- catalogs.cover_image_path (heredada de la era Supabase Storage y sin uso
-- desde entonces) pasa a guardar la portada propia por catálogo en R2
-- (catalog/{catalog_id}/cover-…webp). Se limpia cualquier ruta antigua que
-- apuntase al bucket retirado.

update public.catalogs
set cover_image_path = null
where cover_image_path is not null;
