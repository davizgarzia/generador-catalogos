-- Las hojas automáticas de relleno (las que completan la versión impresa a un
-- múltiplo de 4 páginas; su cantidad sigue siendo calculada) pasan a poder
-- colocarse entre secciones. filler_images deja de ser un array posicional de
-- rutas y pasa a descriptores {path, after} por hoja: path es la imagen propia
-- (null = diseño de marca) y after el id de la categoría tras cuya sección va
-- la hoja ("start" antes de la primera, null = tramo final).

update public.catalogs
set filler_images = coalesce(
  (
    select jsonb_agg(
      case
        when jsonb_typeof(elem.value) = 'string'
          then jsonb_build_object('path', elem.value, 'after', null)
        else jsonb_build_object('path', null, 'after', null)
      end
    )
    from jsonb_array_elements(filler_images) as elem(value)
    where jsonb_typeof(elem.value) in ('string', 'null')
  ),
  '[]'::jsonb
)
where jsonb_typeof(filler_images) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(filler_images) as elem(value)
    where jsonb_typeof(elem.value) in ('string', 'null')
  );
