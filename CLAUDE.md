# Catálogo IMPORMED 2025

Aplicación React/Vite para montar, revisar y exportar un catálogo imprimible de
productos IMPORMED. La app combina una vista visual del catálogo con herramientas
de edición, importación de datos, gestión de imágenes y generación de PDF.

## Cómo arrancarlo

```bash
npm install
npm run dev:all
```

Esto levanta:

- Vite en `http://localhost:5173`
- Servidor Express en `http://localhost:3001`

Para trabajar solo en la interfaz, `npm run dev` es suficiente, pero las funciones
de guardar overrides, importar Excel/imágenes, quitar fondos y generar PDF
requieren `npm run dev:all`.

## Scripts útiles

```bash
npm run dev       # Solo frontend Vite
npm run dev:all   # Frontend + servidor Express
npm run build     # Build de producción
npm run preview   # Preview del build
npm run pdf       # Script alternativo de PDF vía Puppeteer
```

El flujo principal para generar PDF actualmente es el botón **Guardar PDF** de la
app, que llama a `POST /api/generate-pdf`.

## Estructura principal

```text
src/
├── App.jsx                         # Orquesta portada, info, categorías y páginas
├── main.jsx                        # Providers globales
├── config/
│   └── categories.js               # Orden, colores, textos y datos de empresa
├── context/
│   ├── PrintContext.jsx            # Marcas de corte y tamaño A4/A5
│   ├── EditContext.jsx             # Producto seleccionado para edición
│   └── OverridesContext.jsx        # Overrides persistidos por producto
├── data/
│   ├── products.js                 # Fuente base de productos
│   └── overrides.json              # Ajustes persistidos desde la UI
└── components/
    ├── Cover.jsx/css               # Portada
    ├── InfoPage.jsx/css            # Página informativa/contacto
    ├── CategoryDivider.jsx/css     # Separadores de categoría
    ├── ProductGrid.jsx/css         # Páginas de productos
    ├── ProductCard.jsx/css         # Tarjeta de producto editable
    ├── Sidebar.jsx                 # Panel derecho de acciones
    ├── EditSidebar.jsx             # Edición de producto e imagen
    ├── ImportExcelButton.jsx       # Importación de catálogo desde Excel
    ├── ImportImagesButton.jsx      # Importación masiva de imágenes
    └── PageWrapper.jsx/css         # A4/A5, sangre y marcas de corte

server.js                           # API local Express
generate-pdf.js                     # Generación PDF alternativa desde build
public/images/                      # Imágenes originales
public/images-nobg/                 # PNGs procesados sin fondo
scripts/remove_bg_bulk.py           # Script auxiliar para quitar fondos en bulk
```

## Modelo de datos

`src/data/products.js` es la base del catálogo:

```js
{
  id: "76002",
  name: "AGUARDIENTE ANTIOQUEÑO 700 ML",
  fullName: "AGUARDIENTE ANTIOQUEÑO 700 ML (12UXC) 29º",
  unitsLabel: "12 Uds./Caja",
  category: "ALCOHOL",
  image: "/images/76002.jpg",
}
```

`src/data/overrides.json` guarda ajustes hechos desde la UI, sin tocar el producto
base:

```json
{
  "76002": {
    "name": "Nombre editado",
    "unitsLabel": "12 uds./caja",
    "imgHidden": false,
    "imgX": 0,
    "imgY": 0,
    "imgScale": 1,
    "imgMode": "nobg"
  }
}
```

Los overrides se cargan en `OverridesContext` y se aplican en `ProductCard`.

## Categorías y contenido fijo

La configuración visual y de negocio está en `src/config/categories.js`:

- `CATEGORY_ORDER`: orden de secciones.
- `CATEGORY_CONFIG`: color, subtítulo e imágenes destacadas por categoría.
- `COVER_MOSAIC`: imágenes de portada.
- `COMPANY`: teléfono, email, web, horario y pedido mínimo.
- `EXCEL_FAMILY_MAP`: normalización de familias del Excel.

Si se cambia una familia en el Excel o aparece una nueva categoría, revisar tanto
`EXCEL_FAMILY_MAP` como `CATEGORY_ORDER`/`CATEGORY_CONFIG`.

## Flujo de la app

1. `App.jsx` agrupa productos por categoría.
2. Crea metadatos de páginas: portada, información, separadores y grids.
3. Renderiza cada página dentro de `PageWrapper`.
4. `PageWrapper` aplica el formato:
   - Sin marcas: contenido A4 normal.
   - Con marcas A4: página con sangre y marcas de corte.
   - Con marcas A5: contenido escalado y centrado dentro de una hoja A4.
5. `Topbar`, `PageNavigator` y `Sidebar` son chrome de pantalla y se ocultan al imprimir/PDF.

El número de productos por página se controla con `PER_PAGE` en `src/App.jsx`.

## Edición de productos

Al hacer clic en una tarjeta, se abre `EditSidebar`:

- Cambiar nombre visible.
- Cambiar unidades.
- Ocultar/mostrar imagen.
- Ajustar posición horizontal/vertical.
- Ajustar escala.
- Subir una imagen manual procesada como PNG sin fondo.
- Activar/desactivar imagen sin fondo.
- Lanzar un ajuste automático masivo de escala/centrado desde el sidebar.

Los cambios se persisten con:

- `GET /api/overrides`
- `PATCH /api/overrides/:id`

Vite ignora cambios en `src/data/overrides.json` para evitar recargas constantes
mientras se edita.

## Imágenes

Las imágenes originales viven en `public/images/` y se nombran por referencia:

```text
public/images/<id>.jpg
public/images/<id>.jpeg
public/images/<id>.png
```

Las imágenes procesadas sin fondo viven en:

```text
public/images-nobg/<id>.png
```

`imgMode` puede ser:

- `"original"`: usa la imagen original.
- `"nobg"`: usa el PNG de `images-nobg`.
- `"blend"`: modo heredado para `mix-blend-mode: multiply`; no es el flujo principal actual.

El servidor usa Python y `withoutbg` para quitar fondos:

- `POST /api/remove-bg/:id`
- `POST /api/remove-bg-bulk`
- `POST /api/remove-bg-bulk/stop`

Para que funcione, el entorno local debe tener disponible `python3` y el paquete
Python `withoutbg`.

El sidebar también incluye **Ajustar tamaño automático**, que llama a
`POST /api/auto-fit-images-bulk`. Este flujo usa Python/Pillow para detectar el
bounding box visual del producto y persiste `imgScale`, `imgX` e `imgY` en
`overrides.json`. No recorta ni sobrescribe imágenes.

## Importar Excel

`ImportExcelButton` sube un `.xlsx` al servidor:

- Preview: `POST /api/import-excel`
- Confirmación: `POST /api/import-excel?confirm=1`

El Excel esperado contiene columnas equivalentes a:

```text
Artículo | Nombre artículo | Unidades | Nombre de familia | Artículo de baja
```

La importación:

- Ignora artículos de baja.
- Normaliza familias con `EXCEL_FAMILY_MAP`.
- Extrae `unitsLabel` desde patrones tipo `(12UXC)`.
- Regenera `src/data/products.js`.
- Conserva los overrides existentes.

## Importar imágenes

`ImportImagesButton` permite subir una carpeta o lote de imágenes:

- Preview: `POST /api/import-images`
- Confirmación: `POST /api/import-images?confirm=1`

La referencia del producto sale del nombre del archivo sin extensión. Por ejemplo:

```text
76002.jpg -> producto 76002
IP12050.png -> producto IP12050
```

Solo se copian imágenes que coinciden con productos existentes. En confirmación,
se actualiza `products.js` para rellenar `image: null` cuando corresponda.

## Generación de PDF

La app genera PDF desde el servidor Express:

```http
POST /api/generate-pdf
Body: { "marks": true, "size": "A4" }
```

Parámetros:

- `marks`: activa/desactiva marcas de corte.
- `size`: `"A4"` o `"A5"`.

El servidor abre `http://localhost:5173?marks=...&size=...` con Puppeteer, espera
las imágenes, aplica CSS de impresión y devuelve el PDF.

Importante: para usar este flujo, Vite debe estar corriendo en `localhost:5173`,
por eso lo normal es arrancar con `npm run dev:all`.

`generate-pdf.js` existe como flujo alternativo: hace build, sirve `dist/` y crea
un PDF desde capturas de página. No es el camino principal de la UI.

## Endpoints del servidor

```text
GET   /api/overrides
PATCH /api/overrides/:id
POST  /api/revert/:id
POST  /api/upload/:id
GET   /api/nobg-exists/:id
POST  /api/remove-bg/:id
POST  /api/remove-bg-bulk
POST  /api/remove-bg-bulk/stop
POST  /api/auto-fit-images-bulk
POST  /api/generate-pdf
POST  /api/import-excel
POST  /api/import-images
```

## Notas de mantenimiento

- `server.js` y `src/config/categories.js` tienen mapas de familias Excel parecidos.
  Si se cambia la normalización de categorías, mantenerlos alineados o centralizar
  esa lógica.
- `DetectBgButton` existe en `Sidebar.jsx`, pero no está renderizado y apunta a un
  endpoint `/api/detect-bg-bulk` que actualmente no existe.
- Hay textos estáticos con `2025` en componentes y nombres de salida PDF. Si cambia
  el año del catálogo, revisar `Cover.jsx`, `Topbar.jsx`, `server.js`,
  `generate-pdf.js` y este documento.
- Antes de tocar generación PDF o layout de impresión, validar con `npm run build`
  y una exportación real desde la UI.
