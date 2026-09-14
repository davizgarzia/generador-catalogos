-- La imagen es un atributo del producto maestro (el fichero en R2 ya era único
-- por producto). Se mueven los punteros de catalog_products a products; en el
-- vínculo por catálogo quedan solo la inclusión (active, sort_order) y el
-- encuadre visual (img_hidden, img_x, img_y, img_scale).

alter table public.products
  add column original_image_path text,
  add column processed_image_path text,
  add column image_variant text not null default 'original'
    check (image_variant in ('original', 'processed')),
  add column img_mode text not null default 'original'
    check (img_mode in ('original', 'blend', 'nobg')),
  add column image_version bigint not null default 0,
  add column nobg_version bigint;

update public.products product
set original_image_path = link.original_image_path,
    processed_image_path = link.processed_image_path,
    image_variant = link.image_variant,
    img_mode = link.img_mode,
    image_version = link.image_version,
    nobg_version = link.nobg_version
from (
  select distinct on (product_id)
    product_id, original_image_path, processed_image_path,
    image_variant, img_mode, image_version, nobg_version
  from public.catalog_products
  where original_image_path is not null or processed_image_path is not null
  order by product_id, image_version desc
) link
where product.id = link.product_id;

alter table public.catalog_products
  drop column original_image_path,
  drop column processed_image_path,
  drop column image_variant,
  drop column img_mode,
  drop column image_version,
  drop column nobg_version;
