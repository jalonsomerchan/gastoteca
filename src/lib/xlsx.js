const ZIP_END = 0x06054b50
const ZIP_CENTRAL = 0x02014b50
const ZIP_LOCAL = 0x04034b50
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

function decode(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

function findEndOfCentralDirectory(view) {
  const start = Math.max(0, view.byteLength - 22 - 0xffff)
  for (let offset = view.byteLength - 22; offset >= start; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END) return offset
  }
  throw new Error('El fichero no parece ser un Excel válido.')
}

function centralEntries(buffer) {
  const view = new DataView(buffer)
  const end = findEndOfCentralDirectory(view)
  const count = view.getUint16(end + 10, true)
  const directoryOffset = view.getUint32(end + 16, true)
  const entries = []
  let offset = directoryOffset
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== ZIP_CENTRAL) throw new Error('La estructura del Excel está dañada.')
    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const fileName = decode(new Uint8Array(buffer, offset + 46, fileNameLength))
    entries.push({ fileName, flags, method, compressedSize, localOffset })
    offset += 46 + fileNameLength + extraLength + commentLength
  }
  return entries
}

async function readEntry(buffer, entry) {
  const view = new DataView(buffer)
  if (entry.flags & 1) throw new Error('El Excel está protegido con contraseña.')
  if (view.getUint32(entry.localOffset, true) !== ZIP_LOCAL) throw new Error('La estructura del Excel está dañada.')
  const fileNameLength = view.getUint16(entry.localOffset + 26, true)
  const extraLength = view.getUint16(entry.localOffset + 28, true)
  const start = entry.localOffset + 30 + fileNameLength + extraLength
  const compressed = new Uint8Array(buffer, start, entry.compressedSize)
  if (entry.method === 0) return compressed
  if (entry.method !== 8 || typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no puede descomprimir el Excel seleccionado.')
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function xmlDocument(bytes) {
  const document = new DOMParser().parseFromString(decode(bytes), 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('No se pudo leer el contenido XML del Excel.')
  return document
}

function descendants(element, name) {
  return [...element.getElementsByTagNameNS(MAIN_NS, name)]
}

function columnNumber(reference) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || ''
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

export async function readXlsxRows(file) {
  const buffer = await file.arrayBuffer()
  const entries = centralEntries(buffer)
  const byName = new Map(entries.map((entry) => [entry.fileName, entry]))
  const stringsEntry = byName.get('xl/sharedStrings.xml')
  const sheetEntry = byName.get('xl/worksheets/sheet1.xml')
  if (!sheetEntry) throw new Error('No se encontró la primera hoja del Excel.')

  const sharedStrings = stringsEntry
    ? descendants(xmlDocument(await readEntry(buffer, stringsEntry)).documentElement, 'si').map((item) => descendants(item, 't').map((text) => text.textContent || '').join(''))
    : []
  const sheet = xmlDocument(await readEntry(buffer, sheetEntry))
  return descendants(sheet.documentElement, 'row').map((row) => {
    const values = []
    descendants(row, 'c').forEach((cell) => {
      const index = columnNumber(cell.getAttribute('r') || '')
      const type = cell.getAttribute('t')
      const inline = type === 'inlineStr' ? descendants(cell, 't').map((text) => text.textContent || '').join('') : null
      const valueNode = descendants(cell, 'v')[0]
      const raw = inline !== null ? inline : valueNode?.textContent || ''
      values[index] = type === 's' ? (sharedStrings[Number(raw)] ?? '') : raw
    })
    return values
  })
}

