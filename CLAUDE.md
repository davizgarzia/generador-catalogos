# Generador de catálogos IMPORMED

Aplicación React/Vite desplegada en Netlify. Supabase es la única fuente de
verdad para productos, catálogos y configuración. Las imágenes de producto se
almacenan y sirven desde Cloudflare R2; los assets del catálogo (portada,
logos, portadas de categoría) desde Supabase Storage.

## Desarrollo

```bash
npm install
npm run dev
npm run lint
```

Variables locales (ver `.env.example`):

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_CATALOG_SLUG=catalogo-principal
VITE_R2_PUBLIC_URL=...   # activa el camino R2 para imágenes de producto
```

## Modelo

- `products`: producto maestro, stock, categoría, origen y estado de baja.
- `catalog_products`: inclusión, orden, imágenes y ajustes por catálogo.
- `catalog_categories`: nombre, orden, colores, subtítulo y portada.
- `catalogs`: edición, datos comerciales, logos, portada y configuración.
- `catalog_cover_products`: mosaico ordenado de portada (aún sin render).
- `catalog_admins`: usuarios de Supabase Auth autorizados para editar.

Todo el panel requiere sesión de un usuario presente en `catalog_admins`;
las políticas RLS no permiten lecturas anónimas. Los productos e imágenes se
leen exclusivamente desde Supabase/R2, sin fallback a archivos locales.

## Administración

1. Crear el usuario en Supabase Auth con email y contraseña.
2. Insertar su UUID en `catalog_admins`.

Los administradores pueden:

- Crear y editar productos manuales.
- Dar de baja o retirar productos del catálogo.
- Importar el Excel de stock de forma transaccional.
- Subir imágenes individuales o en lote.
- Editar datos comerciales y configuración de categorías en **Ajustes**.
- Guardar el catálogo como PDF.

La importación Excel se procesa mediante la Edge Function
`import-catalog-products` (desplegada en Supabase; su código no está en este
repo). Los productos ausentes se marcan como baja; los productos manuales no
se modifican.

## PDF

El PDF se genera con el flujo de impresión nativo del navegador: el botón
**Guardar PDF** fuerza el render de todas las páginas lazy, precarga las
imágenes y llama a `window.print()`. Los estilos `@page` y los saltos de
página viven en `src/index.css` y se inyectan desde `CatalogPage`.
No existe generación de PDF en servidor.

## Storage

- Cloudflare R2 (`impormed-catalog`): originales y variantes WebP de producto
  (`thumb`, `preview`, `catalog`), servidas desde `VITE_R2_PUBLIC_URL`.
- `catalog-images` (Supabase): bucket heredado, solo fallback de lectura.
- `catalog-assets` (Supabase): portada, logos y portadas de categorías.

La subida de imágenes usa funciones Netlify: `r2-presign-product-image` firma
una URL de subida directa a R2 y `r2-process-product-image` genera las
variantes WebP con `sharp` antes de actualizar `catalog_products`.
`r2-delete-product` borra el producto y sus imágenes.

## Netlify

Variables requeridas:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_CATALOG_SLUG=catalogo-principal
VITE_R2_PUBLIC_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
R2_BUCKET_NAME=impormed-catalog
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` y las credenciales R2 solo están disponibles para
las funciones Netlify y nunca deben usar prefijo `VITE_`.

## Fuera de alcance por ahora

- Eliminación de fondos (`img_mode: nobg`) y autoajuste masivo: la
  infraestructura existe (variantes `processed`, switch deshabilitado en el
  editor) pero no hay pipeline operativo.
- Mosaico de portada: editable en Ajustes y persistido en
  `catalog_cover_products`, pero la portada solo pinta `cover_image_path`.
