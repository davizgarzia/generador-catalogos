import fs from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import XLSX from "xlsx"

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = path.join(ROOT, "data")
const EXCEL_PATH = path.join(DATA_DIR, "BASE14052026.xlsx")
const SOURCE_IMAGES_DIR = path.join(DATA_DIR, "PRODUCTOS")
const PUBLIC_IMAGES_DIR = path.join(ROOT, "public/images")
const PRODUCTS_PATH = path.join(ROOT, "src/data/products.js")

const EXCEL_FAMILY_MAP = {
  "ALCOHOLES": "ALCOHOL",
  "ALCOHOL": "ALCOHOL",
  "REFRESCOS": "REFRESCOS, MALTAS Y CERVEZAS",
  "REFRESCOS, MALTAS Y CERVEZAS": "REFRESCOS, MALTAS Y CERVEZAS",
  "ZUMOS Y LACTEOS": "ZUMOS Y LACTEOS",
  "MALTAS Y CERVEZAS": "REFRESCOS, MALTAS Y CERVEZAS",
  "CERVEZAS Y MALTAS": "REFRESCOS, MALTAS Y CERVEZAS",
  "LEGUMBRES": "LEGUMBRES",
  "HARINAS": "HARINAS Y PASTAS",
  "HARINAS Y PASTAS": "HARINAS Y PASTAS",
  "CAFE Y TE": "CAFE Y TE",
  "CONDIMENTOS": "CONDIMENTOS",
  "CONGELADOS": "CONGELADOS",
  "HELADOS": "HELADOS",
  "PULPAS": "PULPAS",
  "REFRIGERADOS": "REFRIGERADOS",
  "CONSERVAS": "CONSERVAS",
  "GALLETAS": "GALLETAS",
  "GOLOSINAS": "GOLOSINAS",
  "PASTAS": "HARINAS Y PASTAS",
  "SNAKS": "SNAKS",
  "UTENSILIOS": "UTENSILIOS",
  "HIGIENE Y COSMETICA": "HIGIENE Y COSMETICA",
  "VARIOS": "VARIOS",
}

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function columnIndex(headers, names) {
  const normalizedNames = names.map(normalizeHeader)
  return headers.findIndex(header => normalizedNames.includes(normalizeHeader(header)))
}

function extractUnitsLabel(fullName) {
  const text = String(fullName)
  const patterns = [
    /\((?:[^)]*?\b)?(\d+)\s*(?:U\s*x\s*C|UXC|UDS?\s*\/?\s*C(?:AJA)?|UNI(?:D(?:AD(?:ES)?)?)?(?:\s*X\s*CAJA)?|PACKS?|DISP(?:L|LAY)?)[^)]*\)/i,
    /\b(?:CAJA|DISPLAY)\s*(?:X\s*)?(\d+)\s*(?:UNI(?:D(?:AD(?:ES)?)?)?|UDS?)\b/i,
    /\b(\d+)\s*(?:UNI(?:D(?:AD(?:ES)?)?)?|UDS?)\b/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return `${Number.parseInt(match[1], 10)} uds./caja`
  }

  return null
}

function cleanProductName(fullName) {
  return String(fullName)
    .replace(/\s*\([^)]*(?:U\s*x\s*C|UXC|UDS?\s*\/?\s*C(?:AJA)?|UNI(?:D(?:AD(?:ES)?)?)?(?:\s*X\s*CAJA)?|CAJA|PACKS?|DISP(?:L|LAY)?)[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function readExcelProducts() {
  const wb = XLSX.readFile(EXCEL_PATH)
  const sheets = wb.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 }),
  }))
  const sheet = sheets.find(({ rows }) => {
    const headers = rows[0] ?? []
    return columnIndex(headers, ["Artículo", "Articulo"]) !== -1
      && columnIndex(headers, ["Nombre artículo", "Nombre articulo"]) !== -1
      && columnIndex(headers, ["Nombre de familia"]) !== -1
  })

  if (!sheet) throw new Error("No se encontró una hoja con columnas de catálogo")

  const headers = sheet.rows[0] ?? []
  const idIndex = columnIndex(headers, ["Artículo", "Articulo"])
  const fullNameIndex = columnIndex(headers, ["Nombre artículo", "Nombre articulo"])
  const familyIndex = columnIndex(headers, ["Nombre de familia"])
  const bajaIndex = columnIndex(headers, ["Artículo de baja", "Articulo de baja"])

  const unknownFamilies = []
  const products = sheet.rows.slice(1).flatMap((row, offset) => {
    const id = row[idIndex]
    const fullName = row[fullNameIndex]
    const family = row[familyIndex]
    const baja = bajaIndex === -1 ? null : row[bajaIndex]

    if (!id || !fullName || !family) return []
    if (String(baja).toLowerCase() === "sí" || String(baja).toLowerCase() === "si") return []

    const category = EXCEL_FAMILY_MAP[String(family).trim().toUpperCase()]
    if (!category) {
      unknownFamilies.push({ row: offset + 2, id: String(id).trim(), family: String(family) })
      return []
    }

    const cleanFullName = String(fullName).replace(/\s+/g, " ").trim()
    return [{
      id: String(id).trim(),
      name: cleanProductName(cleanFullName),
      fullName: cleanFullName,
      unitsLabel: extractUnitsLabel(cleanFullName),
      category,
      image: null,
    }]
  })

  return { products, unknownFamilies }
}

function listSourceImages() {
  const imageFiles = fs.readdirSync(SOURCE_IMAGES_DIR)
    .filter(file => /\.(jpe?g|png|webp)$/i.test(file))

  const byId = new Map()
  const duplicates = []

  for (const file of imageFiles) {
    const ext = path.extname(file)
    const id = path.basename(file, ext).trim()
    const current = byId.get(id)
    const cleanName = `${id}${ext}`
    const candidate = { id, file, cleanName }

    if (!current) {
      byId.set(id, candidate)
      continue
    }

    duplicates.push({ id, first: current.file, duplicate: file })

    const currentHasSpaces = current.file !== current.cleanName
    const candidateHasSpaces = file !== cleanName
    const currentExt = path.extname(current.file).toLowerCase()
    const candidateExt = ext.toLowerCase()
    const preferCandidate = (currentHasSpaces && !candidateHasSpaces)
      || (currentExt === ".jpeg" && candidateExt === ".jpg")

    if (preferCandidate) byId.set(id, candidate)
  }

  return { byId, duplicates, imageFiles }
}

function findPublicImage(id) {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const file = `${id}.${ext}`
    if (fs.existsSync(path.join(PUBLIC_IMAGES_DIR, file))) return `/images/${file}`
  }
  return null
}

async function main() {
  const currentProducts = (await import(`${pathToFileURL(PRODUCTS_PATH).href}?t=${Date.now()}`)).default
  const currentIds = new Set(currentProducts.map(product => product.id))
  const { products, unknownFamilies } = readExcelProducts()
  const { byId: sourceImages, duplicates, imageFiles } = listSourceImages()
  const excelIds = new Set(products.map(product => product.id))

  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true })

  let copied = 0
  let replaced = 0
  let newImages = 0
  const copiedIds = []

  for (const [id, image] of sourceImages) {
    const ext = path.extname(image.file).toLowerCase()
    const destName = `${id}${ext}`
    const src = path.join(SOURCE_IMAGES_DIR, image.file)
    const dest = path.join(PUBLIC_IMAGES_DIR, destName)
    const existed = fs.existsSync(dest)

    fs.copyFileSync(src, dest)
    copied++
    if (existed) replaced++
    else newImages++
    copiedIds.push(id)
  }

  for (const product of products) {
    product.image = findPublicImage(product.id)
  }

  const lines = products.map(product => `  {
    id: ${JSON.stringify(product.id)},
    name: ${JSON.stringify(product.name)},
    fullName: ${JSON.stringify(product.fullName)},
    unitsLabel: ${product.unitsLabel ? JSON.stringify(product.unitsLabel) : "null"},
    category: ${JSON.stringify(product.category)},
    image: ${product.image ? JSON.stringify(product.image) : "null"},
  },`)

  const fileContent = `// Generado automáticamente desde data — ${new Date().toISOString()}
// Para añadir o editar productos, edita este archivo directamente o sube un nuevo Excel.

const products = [
${lines.join("\n")}
]

export default products
`

  fs.writeFileSync(PRODUCTS_PATH, fileContent, "utf8")

  const added = products.filter(product => !currentIds.has(product.id)).map(product => product.id)
  const removed = currentProducts.filter(product => !excelIds.has(product.id)).map(product => product.id)
  const missingImages = products.filter(product => !product.image).map(product => product.id)
  const extraImages = [...sourceImages.keys()].filter(id => !excelIds.has(id))

  console.log(JSON.stringify({
    products: products.length,
    previousProducts: currentProducts.length,
    added,
    removed,
    copiedImages: copied,
    replacedImages: replaced,
    newImages,
    sourceImageFiles: imageFiles.length,
    sourceImageIds: sourceImages.size,
    duplicateImages: duplicates,
    missingImages,
    extraImages,
    unknownFamilies,
    copiedIds,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
