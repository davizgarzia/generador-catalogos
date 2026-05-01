/**
 * Configuración visual de cada categoría del catálogo.
 * Modificar aquí para cambiar colores, iconos o descripciones.
 */
export const CATEGORY_ORDER = [
  "ALCOHOL",
  "REFRESCOS",
  "ZUMOS Y LACTEOS",
  "CERVEZAS Y MALTAS",
]

export const CATEGORY_CONFIG = {
  ALCOHOL: {
    bg: "#1B2A6B",
    accent: "#4A6CF7",
    light: "#E8ECFF",
    icon: "🥃",
    subtitle: "Aguardientes · Rones · Licores",
    /** Imágenes usadas en la portada (mosaico) */
    coverImages: ["/images/82018.jpg", "/images/76002.jpg", "/images/IP98015.jpg"],
  },
  REFRESCOS: {
    bg: "#0A6B45",
    accent: "#22C55E",
    light: "#E8FFF4",
    icon: "🥤",
    subtitle: "Bebidas Refrescantes",
    coverImages: ["/images/63028.jpg", "/images/63037.jpg", "/images/63068.jpg"],
  },
  "ZUMOS Y LACTEOS": {
    bg: "#7A3A0A",
    accent: "#F97316",
    light: "#FFF7ED",
    icon: "🧃",
    subtitle: "Zumos Naturales · Leches Vegetales",
    coverImages: ["/images/69015.jpg", "/images/69021.jpg", "/images/69027.jpg"],
  },
  "CERVEZAS Y MALTAS": {
    bg: "#5C3A00",
    accent: "#EAB308",
    light: "#FEFCE8",
    icon: "🍺",
    subtitle: "Cervezas · Maltas",
    coverImages: ["/images/66003.jpg", "/images/66007.jpg", "/images/72004.jpg"],
  },
}

/** Imágenes del mosaico de portada (12 fotos, 4×3) */
export const COVER_MOSAIC = [
  "/images/82018.jpg",
  "/images/76002.jpg",
  "/images/63028.jpg",
  "/images/66003.jpg",
  "/images/69015.jpg",
  "/images/82010.jpg",
  "/images/63037.jpg",
  "/images/69021.jpg",
  "/images/76022.jpg",
  "/images/63068.jpg",
  "/images/IP66005.jpg",
  "/images/72004.jpg",
]

/** Datos de contacto de la empresa */
export const COMPANY = {
  name: "IMPORMED",
  tagline: "Productos Internacionales",
  phone: "961 250 501",
  email: "pedidos@impormed.com",
  web: "www.impormed.com",
  minOrder: "50€",
  hours: "Lunes a Viernes · 9h a 18.30h",
}
