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
  "REFRESCOS, MALTAS Y CERVEZAS",
  "ZUMOS Y LACTEOS",
  "LEGUMBRES",
  "HARINAS Y PASTAS",
  "CAFE Y TE",
  "CONDIMENTOS",
  "CONGELADOS",
  "HELADOS",
  "PULPAS",
  "REFRIGERADOS",
  "CONSERVAS",
  "GALLETAS",
  "GOLOSINAS",
  "SNAKS",
  "VARIOS",
]

/**
 * Mapeo de nombres de familia del Excel → clave de categoría en el catálogo.
 * Permite normalizar variaciones tipográficas del Excel.
 */
export const EXCEL_FAMILY_MAP = {
  "ALCOHOLES":           "ALCOHOL",
  "REFRESCOS":           "REFRESCOS, MALTAS Y CERVEZAS",
  "ZUMOS Y LACTEOS":     "ZUMOS Y LACTEOS",
  "MALTAS Y CERVEZAS":   "REFRESCOS, MALTAS Y CERVEZAS",
  "CERVEZAS Y MALTAS":   "REFRESCOS, MALTAS Y CERVEZAS",
  "LEGUMBRES":           "LEGUMBRES",
  "HARINAS":             "HARINAS Y PASTAS",
  "CAFE Y TE":           "CAFE Y TE",
  "CONDIMENTOS":         "CONDIMENTOS",
  "CONGELADOS":          "CONGELADOS",
  "HELADOS":             "HELADOS",
  "PULPAS":              "PULPAS",
  "REFRIGERADOS":        "REFRIGERADOS",
  "CONSERVAS":           "CONSERVAS",
  "GALLETAS":            "GALLETAS",
  "GOLOSINAS":           "GOLOSINAS",
  "PASTAS":              "HARINAS Y PASTAS",
  "SNAKS":               "SNAKS",
  "UTENSILIOS":          "VARIOS",
  "HIGIENE Y COSMETICA": "VARIOS",
}

export const CATEGORY_CONFIG = {
  ALCOHOL: {
    ...BRAND,
    subtitle: "Aguardientes · Rones · Licores",
    coverImages: ["/category-covers/cat-alcohol.png"],
  },
  "REFRESCOS, MALTAS Y CERVEZAS": {
    ...BRAND,
    subtitle: "Refrescos · Maltas · Cervezas",
    coverImages: ["/category-covers/cat-refrescos.png"],
  },
  "ZUMOS Y LACTEOS": {
    ...BRAND,
    subtitle: "Zumos Naturales · Leches Vegetales",
    coverImages: ["/category-covers/cat-zumos-lacteos.png"],
  },
  LEGUMBRES: {
    ...BRAND,
    subtitle: "Legumbres · Granos",
    coverImages: ["/category-covers/cat-legumbres.png"],
  },
  "HARINAS Y PASTAS": {
    ...BRAND,
    subtitle: "Harinas · Pastas",
    coverImages: ["/category-covers/cat-harinas.png"],
  },
  "CAFE Y TE": {
    ...BRAND,
    subtitle: "Café · Té · Infusiones",
    coverImages: ["/category-covers/cat-cafe-te.png"],
  },
  CONDIMENTOS: {
    ...BRAND,
    subtitle: "Salsas · Especias · Aderezos",
    coverImages: ["/category-covers/cat-condimentos.png"],
  },
  CONGELADOS: {
    ...BRAND,
    subtitle: "Productos Congelados",
    coverImages: ["/category-covers/cat-congelados.png"],
  },
  HELADOS: {
    ...BRAND,
    subtitle: "Helados · Sorbetes",
    coverImages: ["/category-covers/cat-helados.png"],
  },
  PULPAS: {
    ...BRAND,
    subtitle: "Pulpas de Frutas",
    coverImages: ["/category-covers/cat-pulpas.png"],
  },
  REFRIGERADOS: {
    ...BRAND,
    subtitle: "Productos Refrigerados",
    coverImages: ["/category-covers/cat-refrigerados.png"],
  },
  CONSERVAS: {
    ...BRAND,
    subtitle: "Conservas · Enlatados",
    coverImages: ["/category-covers/cat-conservas.png"],
  },
  GALLETAS: {
    ...BRAND,
    subtitle: "Galletas · Bizcochos",
    coverImages: ["/category-covers/cat-galletas.png"],
  },
  GOLOSINAS: {
    ...BRAND,
    subtitle: "Caramelos · Chucherías",
    coverImages: ["/category-covers/cat-golosinas.png"],
  },
  SNAKS: {
    ...BRAND,
    subtitle: "Snacks · Aperitivos",
    coverImages: ["/category-covers/cat-snaks.png"],
  },
  VARIOS: {
    ...BRAND,
    subtitle: "Utensilios · Higiene · Cosmética",
    coverImages: ["/category-covers/cat-varios.png"],
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
  whatsapp: "620 685 462",
  email: "pedidos@impormed.com",
  web: "www.impormed.com",
  minOrder: "70€",
  hours: "Lunes a Jueves · 9h a 18.30h · Viernes · 9h a 13.30h",
}
