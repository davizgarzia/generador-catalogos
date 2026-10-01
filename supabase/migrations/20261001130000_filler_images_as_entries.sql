-- Las hojas de imagen dejan de ser posicionales al final del catálogo y pasan
-- a poder colocarse entre secciones: cada elemento de filler_images es ahora
-- {path, after}, donde after es el id de la categoría tras cuya sección se
-- inserta la hoja, "start" para antes de la primera categoría, o null para el
-- tramo final (antes de la contraportada). Las rutas antiguas (array de
-- strings) se convierten en entradas al final.

update public.catalogs
set filler_images = coalesce(
  (
    select jsonb_agg(jsonb_build_object('path', elem.value, 'after', null))
    from jsonb_array_elements(filler_images) as elem(value)
    where jsonb_typeof(elem.value) = 'string'
  ),
  '[]'::jsonb
)
where jsonb_typeof(filler_images) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(filler_images) as elem(value)
    where jsonb_typeof(elem.value) = 'string'
  );
