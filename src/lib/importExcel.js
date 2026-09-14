// El export por defecto de read-excel-file v9 devuelve TODAS las hojas
// como [{ sheet: "nombre", data: [[...]] }].
import readExcelSheets from "read-excel-file/browser"
import Papa from "papaparse"

// Mismo patrón que sanitizeProductId en netlify/functions/lib/r2-catalog.mjs.
export const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]+$/

const PREFERRED_SHEET = "Valoración de stocks"

// clave normalizada → campo
const HEADER_FIELDS = {
  "articulo": "id",
  "nombre articulo": "article_name",
  "nombre de familia": "family_name",
  "unidades": "stock_units",
}
const REQUIRED_FIELDS = ["id", "article_name", "family_name", "stock_units"]
export const EXPECTED_HEADERS = "Artículo, Nombre artículo, Nombre de familia y Unidades"

export function cleanName(fullName) {
  return fullName
    .replace(/\s*\([^)]*(?:U\s*x\s*C|UXC|UDS?|UNI(?:D(?:AD(?:ES)?)?)?|CAJA|PACKS?|DISPLAY)[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function unitsPerCase(fullName) {
  const patterns = [
    /\((?:[^)]*?\b)?(\d+)\s*(?:U\s*x\s*C|UXC|UDS?\s*\/?\s*C(?:AJA)?|UNI(?:D(?:AD(?:ES)?)?)?(?:\s*X\s*CAJA)?|PACKS?|DISP(?:L|LAY)?)[^)]*\)/i,
    /\b(?:CAJA|DISPLAY)\s*(?:X\s*)?(\d+)\s*(?:UNI(?:D(?:AD(?:ES)?)?)?|UDS?)\b/i,
  ]
  for (const pattern of patterns) {
    const match = fullName.match(pattern)
    if (match) return Number.parseInt(match[1], 10)
  }
  return null
}

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function findHeaderColumns(headerRow) {
  if (!Array.isArray(headerRow)) return null
  const columns = {}
  headerRow.forEach((cell, index) => {
    const field = HEADER_FIELDS[normalizeHeader(cell)]
    if (field && columns[field] === undefined) columns[field] = index
  })
  return REQUIRED_FIELDS.every(field => columns[field] !== undefined) ? columns : null
}

// Las cabeceras pueden no estar en la primera fila (títulos, filas vacías).
const HEADER_SCAN_ROWS = 10

function findHeaderIndex(rows) {
  const limit = Math.min(rows.length, HEADER_SCAN_ROWS)
  for (let index = 0; index < limit; index++) {
    if (findHeaderColumns(rows[index])) return index
  }
  return -1
}

function parseStock(value) {
  if (value === null || value === undefined || value === "") return NaN
  if (typeof value === "number") return value
  const raw = String(value).trim()
  // Formato español "1.234,5" → coma decimal; si no hay coma, parseo directo.
  if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."))
  return Number(raw)
}

async function readCsvRows(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      delimiter: "",
      skipEmptyLines: "greedy",
      complete: result => resolve(result.data),
      error: parseError => reject(new Error(`No se pudo leer el CSV: ${parseError.message}`)),
    })
  })
}

async function readExcelRows(file) {
  const sheets = await readExcelSheets(file)
  if (!sheets?.length) throw new Error("El Excel no contiene hojas.")

  // Preferimos la hoja habitual del stock; si no, la primera con las cabeceras.
  const preferred = sheets.find(item => item.sheet === PREFERRED_SHEET)
  const candidates = preferred
    ? [preferred, ...sheets.filter(item => item !== preferred)]
    : sheets
  for (const candidate of candidates) {
    const rows = candidate.data ?? []
    if (findHeaderIndex(rows) !== -1) return rows
  }
  // Sin cabeceras en ninguna hoja: devolver todo para tratarlo como lista de refs.
  return sheets.flatMap(item => item.data ?? [])
}

// Importador universal: detecta el formato del fichero.
// - Con cabeceras de stock → { kind: "full", products, discarded }
// - Sin cabeceras (lista de referencias) → { kind: "references", references }
export async function parseImportFile(file) {
  const isCsv = /\.csv$/i.test(file.name)
  const rows = isCsv ? await readCsvRows(file) : await readExcelRows(file)
  if (!rows.length) throw new Error("El fichero está vacío.")

  const headerIndex = findHeaderIndex(rows)
  if (headerIndex === -1) {
    return { kind: "references", references: extractReferences(rows) }
  }
  const columns = findHeaderColumns(rows[headerIndex])

  const products = []
  const discarded = []
  const seen = new Map()

  rows.slice(headerIndex + 1).forEach((row, index) => {
    const rowNumber = headerIndex + index + 2
    const id = String(row[columns.id] ?? "").trim()
    const articleName = String(row[columns.article_name] ?? "").replace(/\s+/g, " ").trim()
    const familyName = String(row[columns.family_name] ?? "").trim()

    if (!id && !articleName && !familyName) return

    if (!id || !articleName || !familyName) {
      discarded.push({ rowNumber, id, reason: "Faltan datos (artículo, nombre o familia)" })
      return
    }
    if (!PRODUCT_ID_PATTERN.test(id)) {
      discarded.push({ rowNumber, id, reason: "La referencia solo admite letras, números, guiones y guiones bajos" })
      return
    }
    const stock = parseStock(row[columns.stock_units])
    if (Number.isNaN(stock)) {
      discarded.push({ rowNumber, id, reason: "Stock no numérico" })
      return
    }
    if (seen.has(id)) {
      discarded.push({ rowNumber, id, reason: `Referencia duplicada en el fichero (se usa la fila ${seen.get(id)})` })
      return
    }

    seen.set(id, rowNumber)
    products.push({
      id,
      article_name: articleName,
      display_name: cleanName(articleName),
      family_name: familyName,
      stock_units: stock,
      units_per_case: unitsPerCase(articleName),
      sort_order: products.length,
    })
  })

  return { kind: "full", products, discarded }
}

// Lista simple de referencias (una por celda/fila, sin cabeceras de stock).
function extractReferences(rows) {
  const ids = []
  const seen = new Set()
  const push = value => {
    const id = String(value ?? "").trim()
    if (id && PRODUCT_ID_PATTERN.test(id) && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  rows.forEach(row => (Array.isArray(row) ? row : [row]).forEach(push))

  if (!ids.length) {
    throw new Error(
      `El fichero no contiene ni las columnas ${EXPECTED_HEADERS} ni una lista de referencias reconocible.`
    )
  }
  return ids
}

function roundStock(value) {
  return Math.round(Number(value ?? 0) * 1000) / 1000
}

// Diff contra el catálogo activo. Las cifras definitivas las da la RPC;
// esto alimenta la previsualización.
export function computeImportDiff({ fileProducts, currentProducts, categories }) {
  const currentById = new Map(currentProducts.map(product => [product.id, product]))
  const categoryBySource = new Map(categories.map(category => [category.source_name, category]))
  const fileIds = new Set(fileProducts.map(product => product.id))

  const added = []
  const updated = []
  const unchanged = []
  const reactivated = []
  const manualConflicts = []
  const unknownFamiliesSet = new Set()

  for (const item of fileProducts) {
    const category = categoryBySource.get(item.family_name)
    if (!category) unknownFamiliesSet.add(item.family_name)

    const current = currentById.get(item.id)
    if (!current) {
      added.push(item)
      continue
    }
    if (current.sourceType === "manual") {
      manualConflicts.push({ id: item.id, name: current.name })
      continue
    }
    if (current.discontinued) {
      reactivated.push({ id: item.id, name: current.name })
      continue
    }

    const changes = []
    if (roundStock(current.stockUnits) !== roundStock(item.stock_units)) {
      changes.push({ field: "Stock", before: roundStock(current.stockUnits), after: roundStock(item.stock_units) })
    }
    if (current.fullName !== item.article_name) {
      changes.push({ field: "Nombre", before: current.fullName, after: item.article_name })
    }
    if (category && current.categoryId !== category.id) {
      changes.push({ field: "Familia", before: current.category, after: category.display_name })
    }

    if (changes.length) updated.push({ id: item.id, name: current.name, changes })
    else unchanged.push(item)
  }

  const discontinuedNow = currentProducts.filter(
    product => product.sourceType === "excel" && !product.discontinued && !fileIds.has(product.id)
  )

  return {
    toSend: fileProducts,
    added,
    updated,
    unchanged,
    reactivated,
    manualConflicts,
    discontinuedNow,
    unknownFamilies: [...unknownFamiliesSet],
  }
}
