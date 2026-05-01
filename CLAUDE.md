# Catálogo de Bebidas IMPORMED 2025

Aplicación React/Vite que genera un catálogo de productos imprimible en formato A4.
El objetivo final es producir un PDF de calidad para enviar a clientes y para imprimir.

## Cómo arrancarlo

```bash
npm install
npm run dev        # → http://localhost:5173
```

Para generar el PDF: abrir en el navegador y hacer **Ctrl+P → Guardar como PDF**
con márgenes en **Ninguno** y escala al **100%**.

## Estructura del proyecto

```
src/
├── data/
│   └── products.js          # ← FUENTE DE VERDAD: todos los productos
├── config/
│   └── categories.js        # ← Colores, iconos y orden de categorías
├── components/
│   ├── Cover.jsx/css         # Portada (mosaico + logo + franja)
│   ├── InfoPage.jsx/css      # Página de info corporativa y contacto
│   ├── CategoryDivider.jsx/css  # Página separadora por categoría
│   ├── ProductCard.jsx/css   # Tarjeta individual de producto
│   └── ProductGrid.jsx/css   # Grid de productos (8 por página A4)
├── App.jsx                   # Orquesta el orden de todas las páginas
├── main.jsx
└── index.css                 # Reset global + estilos de impresión (@page)

public/
└── images/                   # 60 fotos de productos (nombradas por código Ref)
```

## Datos de productos (`src/data/products.js`)

Cada producto tiene esta forma:

```js
{
  id: "76002",                           // Código de referencia (Ref)
  name: "AGUARDIENTE ANTIOQUEÑO 700 ML", // Nombre limpio (sin unidades/caja)
  fullName: "AGUARDIENTE... (12UXC) 29º",// Nombre original del Excel
  unitsLabel: "12 Uds./Caja",           // Extraído del nombre original
  category: "ALCOHOL",                   // Una de las 4 categorías
  image: "/images/76002.jpg",            // Ruta pública, o null si no hay foto
}
```

**Para añadir o editar productos**, editar directamente `src/data/products.js`.

## Categorías y colores (`src/config/categories.js`)

- `CATEGORY_ORDER` — controla el orden de aparición de las secciones.
- `CATEGORY_CONFIG` — color de fondo, color de acento, icono y subtítulo de cada categoría.
- `COVER_MOSAIC` — array de 12 rutas de imagen para el mosaico de portada.
- `COMPANY` — datos de contacto (teléfono, email, web, horario).

## Páginas del catálogo (en orden)

1. **Cover** — Portada: mosaico 4×3, logo IMPORMED, franja azul con año
2. **InfoPage** — Servicios de la empresa + datos de pedido
3. Por cada categoría (en `CATEGORY_ORDER`):
   - **CategoryDivider** — Página separadora de color sólido con icono
   - **ProductGrid** — Páginas A4 con grid 4×2 (8 productos por página)

## Parámetros a ajustar

| Qué                        | Dónde                                   |
|----------------------------|-----------------------------------------|
| Número de productos/página | `perPage` en `App.jsx` (default: 8)     |
| Colores de categoría       | `CATEGORY_CONFIG` en `categories.js`   |
| Orden de categorías        | `CATEGORY_ORDER` en `categories.js`    |
| Fotos de portada           | `COVER_MOSAIC` en `categories.js`      |
| Datos de contacto          | `COMPANY` en `categories.js`           |
| Año del catálogo           | `Cover.jsx` (texto estático "2025")    |

## Imágenes

Las imágenes están en `public/images/` con el nombre `<id>.jpg` o `<id>.jpeg`.
Si un producto no tiene imagen, `image: null` muestra un placeholder "SIN IMAGEN".

Para añadir una imagen nueva: copiarla a `public/images/<id>.jpg` y actualizar
`image` en `products.js`.

## Tareas pendientes / ideas de mejora

- [ ] Añadir precios al catálogo (columna extra en products.js)
- [ ] Versión en inglés o francés para mercado internacional
- [ ] Página de contraportada
- [ ] Script automático para regenerar products.js desde el Excel
- [ ] Logo vectorial oficial de IMPORMED en lugar del texto
