// Activos de marca del catálogo. Viven en public/brand/ y se despliegan con la
// app: para cambiarlos, sustituir el archivo y desplegar (no se editan en Ajustes).
export const BRAND_ASSETS = {
  cover: "/brand/cover.webp",
  logo: "/brand/logo.jpg",
  logoWhite: "/brand/logo-white.png",
  // Hojas de imagen para completar la versión impresa a múltiplos de 4 páginas.
  // Añadir aquí los archivos cuando existan, p. ej. "/brand/filler-1.jpg".
  // Si faltan, se reutiliza la portada.
  fillers: [],
}

export function categoryCoverUrl(code) {
  return code ? `/brand/categories/${code}.webp` : null
}
