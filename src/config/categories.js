/**
 * Configuración visual de cada categoría del catálogo.
 * Modificar aquí para cambiar colores, iconos o descripciones.
 *
 * Color branding IMPORMED: extraído del logo (azul corporativo)
 *   accent: #2E70B2  (azul saturado del logotipo)
 *   bg:     #1A3F66  (versión oscura para fondos de separadores)
 *   light:  #EBF3FB  (tono muy claro para fondos secundarios)
 */
const BRAND = {
  accent: "#2E70B2",
  bg: "#1A3F66",
  light: "#EBF3FB",
}
export const CATEGORY_ORDER = [
  "ALCOHOL",
  "REFRESCOS",
  "ZUMOS Y LACTEOS",
  "CERVEZAS Y MALTAS",
  "LEGUMBRES",
  "HARINAS",
  "CAFE Y TE",
  "CONDIMENTOS",
  "CONGELADOS",
  "HELADOS",
  "PULPAS",
  "REFRIGERADOS",
  "CONSERVAS",
  "GALLETAS",
  "GOLOSINAS",
  "PASTAS",
  "SNAKS",
  "VARIOS",
]

/**
 * Mapeo de nombres de familia del Excel → clave de categoría en el catálogo.
 * Permite normalizar variaciones tipográficas del Excel.
 */
export const EXCEL_FAMILY_MAP = {
  "ALCOHOLES":           "ALCOHOL",
  "REFRESCOS":           "REFRESCOS",
  "ZUMOS Y LACTEOS":     "ZUMOS Y LACTEOS",
  "MALTAS Y CERVEZAS":   "CERVEZAS Y MALTAS",
  "CERVEZAS Y MALTAS":   "CERVEZAS Y MALTAS",
  "LEGUMBRES":           "LEGUMBRES",
  "HARINAS":             "HARINAS",
  "CAFE Y TE":           "CAFE Y TE",
  "CONDIMENTOS":         "CONDIMENTOS",
  "CONGELADOS":          "CONGELADOS",
  "HELADOS":             "HELADOS",
  "PULPAS":              "PULPAS",
  "REFRIGERADOS":        "REFRIGERADOS",
  "CONSERVAS":           "CONSERVAS",
  "GALLETAS":            "GALLETAS",
  "GOLOSINAS":           "GOLOSINAS",
  "PASTAS":              "PASTAS",
  "SNAKS":               "SNAKS",
  "UTENSILIOS":          "VARIOS",
  "HIGIENE Y COSMETICA": "VARIOS",
}

export const CATEGORY_CONFIG = {
  ALCOHOL: {
    ...BRAND,
    subtitle: "Aguardientes · Rones · Licores",
    /** Imágenes usadas en la portada (mosaico) */
    coverImages: ["/images/82018.jpg", "/images/76002.jpg", "/images/IP98015.jpg"],
  },
  REFRESCOS: {
    ...BRAND,
    subtitle: "Bebidas Refrescantes",
    coverImages: ["/images/63028.jpg", "/images/63037.jpg", "/images/63068.jpg"],
  },
  "ZUMOS Y LACTEOS": {
    ...BRAND,
    subtitle: "Zumos Naturales · Leches Vegetales",
    coverImages: ["/images/69015.jpg", "/images/69021.jpg", "/images/69027.jpg"],
  },
  "CERVEZAS Y MALTAS": {
    ...BRAND,
    subtitle: "Cervezas · Maltas",
    coverImages: ["/images/66003.jpg", "/images/66007.jpg", "/images/72004.jpg"],
  },
  LEGUMBRES: {
    ...BRAND,
    subtitle: "Legumbres · Granos",
    coverImages: [],
  },
  HARINAS: {
    ...BRAND,
    subtitle: "Harinas · Cereales",
    coverImages: [],
  },
  "CAFE Y TE": {
    ...BRAND,
    subtitle: "Café · Té · Infusiones",
    coverImages: [],
  },
  CONDIMENTOS: {
    ...BRAND,
    subtitle: "Salsas · Especias · Aderezos",
    coverImages: [],
  },
  CONGELADOS: {
    ...BRAND,
    subtitle: "Productos Congelados",
    coverImages: [],
  },
  HELADOS: {
    ...BRAND,
    subtitle: "Helados · Sorbetes",
    coverImages: [],
  },
  PULPAS: {
    ...BRAND,
    subtitle: "Pulpas de Frutas",
    coverImages: [],
  },
  REFRIGERADOS: {
    ...BRAND,
    subtitle: "Productos Refrigerados",
    coverImages: [],
  },
  CONSERVAS: {
    ...BRAND,
    subtitle: "Conservas · Enlatados",
    coverImages: [],
  },
  GALLETAS: {
    ...BRAND,
    subtitle: "Galletas · Bizcochos",
    coverImages: [],
  },
  GOLOSINAS: {
    ...BRAND,
    subtitle: "Caramelos · Chucherías",
    coverImages: [],
  },
  PASTAS: {
    ...BRAND,
    subtitle: "Pastas · Arroces",
    coverImages: [],
  },
  SNAKS: {
    ...BRAND,
    subtitle: "Snacks · Aperitivos",
    coverImages: [],
  },
  VARIOS: {
    ...BRAND,
    subtitle: "Utensilios · Higiene · Cosmética",
    coverImages: [],
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
