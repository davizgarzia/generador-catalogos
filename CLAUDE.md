# Generador de catálogos IMPORMED

Aplicación React/Vite desplegada en Netlify. Supabase es la única fuente de
verdad para productos, catálogos, configuración e imágenes.

## Desarrollo

```bash
npm install
npm run dev
```

Variables locales:

```bash
VITE_SUPABASE_URL=https://bwfluudjcrbhchxjpwyd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_CATALOG_SLUG=catalogo-principal
```

## Modelo

- `products`: producto maestro, stock, categoría, origen y estado de baja.
- `catalog_products`: inclusión, orden, imágenes y ajustes por catálogo.
- `catalog_categories`: nombre, orden, colores, subtítulo y portada.
- `catalogs`: edición, datos comerciales, logos, portada y configuración.
- `catalog_cover_products`: mosaico ordenado de portada.
- `catalog_admins`: usuarios de Supabase Auth autorizados para editar.
- `pdf_exports`: trabajos de generación PDF.

Los productos e imágenes se leen exclusivamente desde Supabase. No existe
fallback a archivos locales.

## Administración

1. Crear el usuario en Supabase Auth con email y contraseña.
2. Insertar su UUID en `catalog_admins`.
3. Usar **Administrar** en la barra superior.

Los administradores pueden:

- Crear y editar productos manuales.
- Dar de baja o retirar productos del catálogo.
- Importar el Excel de stock de forma transaccional.
- Subir imágenes individuales o en lote.
- Editar datos comerciales y configuración de categorías.
- Generar PDFs.

La importación Excel se procesa mediante la Edge Function
`import-catalog-products`. Los productos ausentes se marcan como baja; los
productos manuales no se modifican.

## Storage

- `catalog-images`: imágenes originales y procesadas de producto.
- `catalog-assets`: portada, logos y portadas de categorías.
- `catalog-pdfs`: PDFs privados generados.

## Netlify

Variables requeridas:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_CATALOG_SLUG=catalogo-principal
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
R2_BUCKET_NAME=impormed-catalog
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` solo está disponible para la función Netlify y nunca
debe usar prefijo `VITE_`.

`generate-pdf-background` valida el JWT y `catalog_admins`, renderiza el catálogo
con Chromium y guarda el resultado en `catalog-pdfs`.

Las imágenes de producto se sirven desde Cloudflare R2 cuando
`VITE_R2_PUBLIC_URL` está configurado. La subida de imágenes usa funciones
Netlify: primero firma una URL de subida directa a R2 y después genera las
variantes WebP (`thumb`, `preview`, `catalog` y `nobg-*`) con `sharp`, antes de
actualizar `catalog_products`.

La eliminación de fondos y el autoajuste masivo están fuera de esta fase y no
aparecen como acciones operativas.
