/** CSV original: strings exatas, aspas escapadas e campos com quebras de linha. */
function* rows(text: string, delimiter: string): Generator<string[]> {
  let start = 0; let quoted = false; let closed = false; let pieces: string[] = []; let value = ''; let row: string[] = []
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (quoted) {
      if (char !== '"') continue
      pieces.push(text.slice(start, index))
      if (text[index + 1] === '"') { pieces.push('"'); index++; start = index + 1 }
      else { quoted = false; closed = true; value = pieces.join(''); pieces = [] }
      continue
    }
    if (char === delimiter || char === '\n' || char === '\r') {
      row.push(closed ? value : text.slice(start, index))
      if (char !== delimiter) {
        if (row.length > 1 || row[0] !== '') yield row
        row = []
        if (char === '\r' && text[index + 1] === '\n') index++
      }
      start = index + 1; closed = false; value = ''
    } else if (closed) throw new Error('CSV contém caracteres após o fechamento de aspas')
    else if (char === '"') {
      if (index !== start) throw new Error('CSV contém aspas dentro de campo sem delimitador')
      quoted = true; start = index + 1
    }
  }
  if (quoted) throw new Error('CSV terminou dentro de um campo entre aspas')
  if (closed || start < text.length || row.length) {
    row.push(closed ? value : text.slice(start))
    if (row.length > 1 || row[0] !== '') yield row
  }
}

export function* parseArchiveCsv(body: Buffer): Generator<Record<string, string>> {
  const text = body.toString('utf8').replace(/^\uFEFF/, '')
  if (text.includes('\u0000')) throw new Error('CSV contém bytes NUL')
  let delimiter = ','; let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"') { if (quoted && text[index + 1] === '"') index++; else quoted = !quoted }
    if (!quoted && (char === ';' || char === ',')) { delimiter = char; break }
    if (!quoted && (char === '\r' || char === '\n')) break
  }
  const iterator = rows(text, delimiter)
  const header = iterator.next().value as string[] | undefined
  if (!header?.length || header.some((name) => !name) || new Set(header).size !== header.length) throw new Error('Cabeçalho CSV inválido')
  for (const cells of iterator) {
    if (cells.length !== header.length) throw new Error('Linha CSV difere do número de colunas do cabeçalho')
    yield Object.fromEntries(header.map((name, index) => [name, cells[index]!]))
  }
}
