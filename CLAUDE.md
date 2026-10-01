# Generador de catálogos IMPORMED

Aplicación React/Vite desplegada en Netlify. Supabase es la única fuente de
verdad para productos, catálogos y configuración (solo base de datos y Auth —
no se usa Supabase Storage). Las imágenes de producto se almacenan y sirven
desde Cloudflare R2; los assets de marca (portada, logos, portadas de
categoría) viven en `public/brand/` y se despliegan con la app.

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
VITE_R2_PUBLIC_URL=...   # obligatoria: dominio público R2 de las imágenes de producto
```

## Arquitectura de la app

- **Productos** (`/products`): el maestro global. Importar Excel/CSV de stock,
  subir imágenes en lote, crear productos manuales, dar de baja o eliminar.
- **Catálogos** (`/catalogs`): listado; crear vacío, con todos los productos
  activos o duplicando otro. `/catalogs/:slug` es el detalle: la vista de
  páginas, el PDF y el gestor de composición ("Gestionar productos": selección
  manual con buscador o desde un Excel con las referencias a incluir).
- **Ajustes** (`/settings`): datos de la empresa (`company_profile`, una sola
  fila) y categorías — todo compartido por todos los catálogos.

## Modelo

- `products`: maestro global — stock, categoría, origen, baja **e imagen**
  (`original_image_path`, `image_version`, `img_mode`, …). La imagen es única
  por producto y se ve igual en todos los catálogos.
- `catalog_products`: inclusión por catálogo — `active`, `sort_order` y el
  encuadre visual (`img_hidden`, `img_x`, `img_y`, `img_scale`).
- `catalog_categories`: globales — nombre, orden, colores, subtítulo.
- `catalogs`: nombre, edición y slug (los datos comerciales viven en
  `company_profile`; las columnas de contacto de `catalogs` quedaron sin uso).
- `company_profile`: fila única con nombre, contacto, horario y `settings`
  (textos de la página de información).
- `catalog_cover_products`: mosaico ordenado de portada (aún sin render).
- `catalog_admins`: usuarios de Supabase Auth autorizados para editar.

Todo el panel requiere sesión de un usuario presente en `catalog_admins`;
las políticas RLS no permiten lecturas anónimas.

## Administración

1. Crear el usuario en Supabase Auth con email y contraseña.
2. Insertar su UUID en `catalog_admins`.

La importación del maestro se procesa con la función Netlify
`import-master-products`, que valida el JWT y llama a la RPC
`import_master_products` (atómica): upsert del maestro con bajas globales
opcionales (`markMissing`); los productos manuales nunca se modifican. La
UI muestra previsualización completa (nuevos, cambios, bajas, descartes con
motivo) antes de confirmar. La lógica de parseo/diff vive en
`src/lib/importExcel.js` (xlsx y csv). La antigua Edge Function de Supabase
quedó retirada.

## PDF

El PDF se genera con el flujo de impresión nativo del navegador: el botón
**Guardar PDF** fuerza el render de todas las páginas lazy, precarga las
imágenes y llama a `window.print()`. Los estilos `@page` y los saltos de
página viven en `src/index.css` y se inyectan desde `CatalogPage`.
No existe generación de PDF en servidor.

## Imágenes de marca

Portada, logos, portadas de categoría y hojas de relleno viven versionadas en
`public/brand/` y se despliegan con la app — no se editan desde Ajustes. Para
cambiarlas: sustituir el archivo (mismo nombre) y desplegar. Las rutas están
centralizadas en `src/lib/brand.js`; las portadas de categoría se resuelven por
código: `public/brand/categories/{code}.png`.

## Storage

Cloudflare R2 (`impormed-catalog`) es el único almacenamiento de imágenes de
producto: originales y variantes WebP (`thumb`, `preview`, `catalog`), servidas
desde `VITE_R2_PUBLIC_URL`. Supabase Storage no se usa: los buckets heredados
(`catalog-images`, `catalog-assets`, `catalog-pdfs`) se eliminaron desde el
dashboard y la migración `20261001090000_retire_supabase_storage.sql` retiró
sus políticas.

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
