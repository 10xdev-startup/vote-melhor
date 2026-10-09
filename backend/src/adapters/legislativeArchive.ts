import { sha256 } from '@/utils/officialData'
import { XMLValidator } from 'fast-xml-parser'
import * as XLSX from 'xlsx'
import type { CollectedData, ImportResource, OfficialCollector, OfficialDataAdapter } from '@/types/officialData'

const CAMARA_CATALOG = 'https://dadosabertos.camara.leg.br/swagger/api.html'
const SENADO_CATALOG = 'https://www12.senado.leg.br/dados-abertos/geracsv'
const SENADO_GROUPS = ['senadores', 'projetos-e-materias', 'comissoes', 'plenario', 'composicao']
const FORMATS = new Set(['json', 'csv', 'xml', 'zip', 'xlsx', 'ods'])
const MAX_RAW_BYTES = 128 * 1024 * 1024
const HISTORICAL_COLLECTION_FROM = 2000

interface FileEntry { categoria: string; nome_arquivo: string; ano_arquivo: string; tipo_arquivo: string; legislatura_arquivo?: string }
interface FileDescription { name: string; url: string; format: string; title: string; period: string | null; catalogUrl: string; selected: boolean; reason: string; alternatives?: string[] }

function httpsUrl(value: string): string {
  return value.replace(/^http:/, 'https:').replace(/&amp;/g, '&').replace(/&#38;/g, '&')
}

/** O índice é JSON publicado na página, nunca código JavaScript executado. */
export function parseCamaraFileIndex(html: string): FileEntry[] {
  const match = /let arquivo\s*=\s*(\{[^\n]+\});/.exec(html)
  if (!match) throw new Error('Índice de arquivos da Câmara não localizado; revisar catálogo')
  const parsed: unknown = JSON.parse(match[1]!)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Índice de arquivos inválido')
  const entries: FileEntry[] = []
  for (const [category, values] of Object.entries(parsed)) {
    if (!Array.isArray(values)) throw new Error('Categoria de arquivos inválida')
    for (const value of values as unknown[]) {
      if (!value || typeof value !== 'object') throw new Error('Entrada de arquivo inválida')
      const row = value as Record<string, unknown>
      if (typeof row['nome_arquivo'] !== 'string' || typeof row['tipo_arquivo'] !== 'string' || typeof row['ano_arquivo'] !== 'string') throw new Error('Entrada de arquivo sem campos obrigatórios')
      const filename = row['nome_arquivo']
      if (!FORMATS.has(row['tipo_arquivo']) || !/^[A-Za-z][A-Za-z0-9_-]*\.(json|csv|xml|zip|xlsx|ods)(\.zip)?$/.test(filename) || !/^[A-Za-z][A-Za-z0-9]*$/.test(category)) continue
      entries.push({ categoria: category, nome_arquivo: filename, ano_arquivo: row['ano_arquivo'], tipo_arquivo: row['tipo_arquivo'], ...(typeof row['legislatura_arquivo'] === 'string' ? { legislatura_arquivo: row['legislatura_arquivo'] } : {}) })
    }
  }
  return entries
}

function camaraDescriptions(entries: FileEntry[], firstYear: number, currentYear: number, legislature: string): FileDescription[] {
  const groups = new Map<string, FileEntry[]>()
  for (const entry of entries) {
    const key = `${entry.categoria}/${entry.ano_arquivo}/${entry.legislatura_arquivo ?? ''}`
    const group = groups.get(key) ?? []; group.push(entry); groups.set(key, group)
  }
  function url(entry: FileEntry): string {
    return entry.categoria === 'Ano' ? `https://www.camara.leg.br/cotas/${entry.nome_arquivo}` : `https://dadosabertos.camara.leg.br/arquivos/${entry.categoria}/${entry.tipo_arquivo}/${entry.nome_arquivo}`
  }
  return [...groups.values()].map((group) => {
    const preferred = [...group].sort((a, b) => {
      const rank = (entry: FileEntry) => entry.categoria === 'Ano' ? entry.nome_arquivo.endsWith('.csv.zip') ? 0 : entry.nome_arquivo.endsWith('.json.zip') ? 1 : 4 : ['proposicoes', 'votacoesVotos', 'frentesDeputados', 'historicoDeputados'].includes(entry.categoria) ? entry.nome_arquivo.endsWith('.csv') ? 0 : entry.nome_arquivo.endsWith('.json') ? 1 : 4 : entry.nome_arquivo.endsWith('.json') ? 0 : entry.nome_arquivo.endsWith('.csv') ? 1 : entry.nome_arquivo.endsWith('.json.zip') ? 2 : entry.nome_arquivo.endsWith('.csv.zip') ? 3 : 4
      return rank(a) - rank(b)
    })[0]!
    const year = Number(preferred.ano_arquivo)
    const inPeriod = preferred.ano_arquivo ? year >= firstYear && year <= currentYear : !preferred.legislatura_arquivo || preferred.legislatura_arquivo === `L${legislature}`
    const historicalVoting = preferred.categoria.startsWith('votacoes') && Boolean(preferred.ano_arquivo) && year >= HISTORICAL_COLLECTION_FROM && year < firstYear
    const selected = (inPeriod || historicalVoting) && !['funcionarios', 'servidores', 'AnoAnterior', 'AnoAtual', 'AnosAnteriores'].includes(preferred.categoria)
    return { name: preferred.nome_arquivo.replace(/\.(json|csv|xml|xlsx|ods)(\.zip)?$/, ''), title: preferred.nome_arquivo, url: url(preferred), format: preferred.nome_arquivo.endsWith('.zip') ? 'ZIP' : preferred.tipo_arquivo.toUpperCase(), period: preferred.ano_arquivo || preferred.legislatura_arquivo || null, catalogUrl: CAMARA_CATALOG, selected, reason: historicalVoting ? 'Histórico de votações aproveitado por ser publicado nos mesmos arquivos anuais' : selected ? 'Legislatura atual ou cadastro compartilhado, incluindo histórico contido no cadastro' : 'Catalogado; fora da primeira coleta da legislatura atual', alternatives: group.map(url) }
  })
}

/** Inspeção linear do CSV sem criar milhões de células em memória. Não calcula indicadores. */
export function inspectArchiveCsv(body: Buffer): { rows: number; columns: string[]; rowWidthMismatches: number } {
  let quoted = false; let fieldStart = true; let nonempty = false; let columns = 1; let records = 0; let headerEnd = -1; let expectedWidth = 0; let mismatches = 0
  const firstLine = body.subarray(0, Math.min(body.length, 8192)).toString('utf8').split(/\r?\n/, 1)[0] ?? ''
  const delimiter = firstLine.includes(';') ? 59 : 44
  function finishRow(end: number): void {
    if (nonempty) {
      if (records === 0) { headerEnd = end; expectedWidth = columns }
      else if (columns !== expectedWidth) mismatches++
      records++
    }
    fieldStart = true; nonempty = false; columns = 1
  }
  for (let index = 0; index < body.length; index++) {
    const byte = body[index]!
    if (byte === 0) throw new Error('CSV contém bytes NUL; codificação pendente de validação')
    if (quoted) { if (byte === 34) { if (body[index + 1] === 34) index++; else quoted = false }; continue }
    if (byte === 34 && fieldStart) { quoted = true; fieldStart = false; nonempty = true; continue }
    if (byte === delimiter) { columns++; fieldStart = true; nonempty = true; continue }
    if (byte === 10 || byte === 13) { finishRow(index); if (byte === 13 && body[index + 1] === 10) index++; continue }
    fieldStart = false; if (byte !== 32 && byte !== 9) nonempty = true
  }
  if (quoted) throw new Error('CSV terminou dentro de um campo entre aspas')
  finishRow(body.length)
  if (headerEnd < 0) throw new Error('CSV sem cabeçalho')
  const header = body.subarray(0, headerEnd).toString('utf8').replace(/^\uFEFF/, '')
  return { rows: Math.max(0, records - 1), columns: header.split(String.fromCharCode(delimiter)).map((name) => name.replace(/^"|"$/g, '').trim()), rowWidthMismatches: mismatches }
}

export function archiveFile(description: FileDescription): ImportResource {
  let evidence: Record<string, unknown> = {}
  return {
    name: description.name, title: description.title, official_id: null, url: description.url, format: description.format, kind: 'document', dependencies: [], optional: true,
    schema: { purpose: 'legislative-original-archive', originalFormat: description.format, referencePeriod: description.period, documentationUrl: description.catalogUrl, selectionReason: description.reason, alternativeFormats: description.alternatives ?? [], request: { method: 'GET', url: description.url, ...(description.format === 'JSON' ? { headers: { Accept: 'application/json' } } : {}) } },
    parserVersion: description.format === 'CSV' ? 'legislative-csv-archive-v2' : 'legislative-archive-v1', maxDownloadBytes: MAX_RAW_BYTES,
    ...(['CSV', 'JSON', 'XML', 'HTML'].includes(description.format) ? { storageEncoding: 'gzip' as const } : {}),
    parse(body) {
      if (!body.length) throw new Error('Origem devolveu um arquivo vazio')
      const beginning = body.toString('utf8', 0, 256)
      if (description.format !== 'HTML' && /^\s*(?:<!doctype\s+html|<html\b)/i.test(beginning)) throw new Error('Origem devolveu HTML em vez do recurso')
      if (description.format === 'JSON') {
        const data: unknown = JSON.parse(body.toString('utf8').replace(/^\uFEFF/, ''))
        if (!data || typeof data !== 'object') throw new Error('JSON sem estrutura de dados')
        const records = Array.isArray(data) ? data : (data as Record<string, unknown>)['dados']
        evidence = { jsonParsed: true, ...(Array.isArray(records) ? { records: records.length, empty: !records.length } : {}), archiveOnly: true, quantitativeInference: 'not-performed' }
      } else if (description.format === 'CSV') {
        const table = inspectArchiveCsv(body)
        evidence = { ...table, empty: !table.rows, archiveOnly: true, quantitativeInference: 'not-performed', semanticValidation: table.rowWidthMismatches ? 'pending' : 'not-performed' }
      } else if (description.format === 'XML') {
        if (XMLValidator.validate(body.toString('utf8')) !== true) throw new Error('XML inválido')
        evidence = { xmlWellFormed: true, archiveOnly: true, semanticValidation: 'pending' }
      } else if (description.format === 'ZIP') {
        if (body.length < 4 || body.readUInt32LE(0) !== 0x04034b50) throw new Error('Assinatura ZIP inválida')
        evidence = { zipSignature: true, archiveOnly: true, memberValidation: 'pending' }
      } else if (description.format === 'HTML') {
        if (!/<html\b/i.test(body.toString('utf8'))) throw new Error('Documento HTML inválido')
        evidence = { documentationPreserved: true, archiveOnly: true }
      } else throw new Error('Formato catalogado sem validador de preservação')
      return []
    },
    validate: () => evidence,
  }
}

function metadataDocument(name: string, url: string, format: string, collected: CollectedData): ImportResource {
  return { ...archiveFile({ name, title: name, url, format, period: null, catalogUrl: url, selected: true, reason: 'Catálogo ou contrato oficial' }), collected }
}

/** Conserva o catálogo geral, mas não confunde links Swagger com endpoints de dados. */
function senateDictionaryResources(body: Buffer): { resources: ImportResource[]; incompleteRows: number } {
  const workbook = XLSX.read(body.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string', raw: true, FS: ';' })
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
  if (!sheet) throw new Error('Catálogo/dicionário do Senado sem planilha')
  const entries = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: true, defval: '' })
  const unique = new Map<string, ImportResource>(); let incompleteRows = 0
  for (const entry of entries) {
    const url = httpsUrl(entry['txt_url'] ?? '')
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || !/\.(senado\.leg\.br|senado\.gov\.br)$/.test(parsed.hostname) || !['Administrativo', 'Legislativo'].includes(entry['nom_categoria'] ?? '') || url.endsWith('&amp')) { incompleteRows++; continue }
      const format = /\.(csv|json|xml|zip|pdf)$/i.exec(parsed.pathname)?.[1]?.toUpperCase() ?? (parsed.pathname.endsWith('.html') ? 'HTML' : 'API')
      const name = `file-${sha256(url).slice(0, 20)}`
      const spec = archiveFile({ name, title: entry['nom_conjunto_dados'] || name, url, format, period: null, catalogUrl: SENADO_CATALOG, selected: false, reason: 'Identificado no catálogo geral; parâmetros e cobertura precisam de verificação antes da coleta' })
      spec.schema = { ...spec.schema as Record<string, unknown>, category: entry['nom_categoria'], subcategory: entry['nom_sub_categoria'], responsibleOrganization: entry['nom_orgao_responsavel'], declaredUpdateFrequency: entry['des_frequencia_atualizacao'], officialDescription: entry['des_conjunto_dados'], documentationOnly: Boolean(parsed.hash) }
      unique.set(url, spec)
    } catch { incompleteRows++ }
  }
  return { resources: [...unique.values()], incompleteRows }
}

export const camaraArchiveAdapter: OfficialDataAdapter = {
  id: 'camara-published-files', allowedHosts: ['dadosabertos.camara.leg.br', 'www.camara.leg.br'],
  async discover(collect) {
    const catalog = await collect(CAMARA_CATALOG)
    const entries = parseCamaraFileIndex(catalog.body.toString('utf8'))
    const legislatureUrl = 'https://dadosabertos.camara.leg.br/arquivos/legislaturas/json/legislaturas.json'
    if (!entries.some((entry) => entry.nome_arquivo === 'legislaturas.json')) throw new Error('Cadastro de legislaturas não anunciado pelo catálogo')
    const legislatures = await collect(legislatureUrl)
    const list = (JSON.parse(legislatures.body.toString('utf8')) as { dados: { idLegislatura: number; dataInicio: string; dataFim: string }[] }).dados
    const today = new Date().toISOString().slice(0, 10)
    const current = list.find((item) => item.dataInicio <= today && item.dataFim >= today)
    if (!current) throw new Error('Legislatura atual da Câmara não localizada')
    const descriptions = camaraDescriptions(entries, Number(current.dataInicio.slice(0, 4)), new Date().getUTCFullYear(), String(current.idLegislatura))
    const resources = descriptions.map(archiveFile)
    const schemaUrl = 'https://dadosabertos.camara.leg.br/api/v2/api-docs'
    const contract = await collect(schemaUrl)
    const contractData = JSON.parse(contract.body.toString('utf8')) as { paths?: unknown }
    if (!contractData.paths) throw new Error('Contrato da API da Câmara inválido')
    return {
      source: { id: this.id, title: 'Câmara: arquivos legislativos e cadastros publicados', organization: 'Câmara dos Deputados', jurisdiction_code: 'BR', official_url: CAMARA_CATALOG, metadata: { archiveOnly: true, currentLegislature: current, publishedRepresentations: entries.length, catalogResources: resources.length, historicalCollectionFrom: HISTORICAL_COLLECTION_FROM, selection: 'Legislatura atual, cadastros compartilhados e histórico de votações desde 2000', annualFileBoundaryNote: 'Arquivos anuais integrais podem incluir janeiro anterior ao início da legislatura; filtrar pelas datas somente na consulta analítica', allHistoricalPeriodsCatalogued: true, currentYearIsPartial: true, alternativeFormatsPreservedInDocumentation: true } },
      catalog: resources,
      resources: [metadataDocument('official-file-catalog', CAMARA_CATALOG, 'HTML', catalog), metadataDocument('api-contract', schemaUrl, 'JSON', contract), ...resources.filter((_resource, index) => descriptions[index]!.selected)],
    }
  },
}

/** URLs são extraídas de páginas oficiais, com allowlist e sem executar HTML/JS. */
export function senateFileUrls(html: string): string[] {
  return [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((match) => httpsUrl(match[1]!)).filter((url) => {
    try { const parsed = new URL(url); return parsed.protocol === 'https:' && ['legis.senado.leg.br', 'legis.senado.gov.br', 'www12.senado.leg.br'].includes(parsed.hostname) && /\.(csv|json|xml|zip)$/i.test(parsed.pathname) && !parsed.hash }
    catch { return false }
  }))]
}

export const senadoArchiveAdapter: OfficialDataAdapter = {
  id: 'senado-published-files', allowedHosts: ['www12.senado.leg.br', 'legis.senado.leg.br', 'legis.senado.gov.br'],
  async discover(collect: OfficialCollector) {
    const dictionary = await collect(SENADO_CATALOG)
    const inventory = senateDictionaryResources(dictionary.body)
    const documents = [metadataDocument('official-catalog-dictionary', SENADO_CATALOG, 'CSV', dictionary)]
    const urls = new Set<string>()
    for (const group of SENADO_GROUPS) {
      const url = `https://www12.senado.leg.br/dados-abertos/conjuntos?portal=Legislativo&grupo=${group}`
      const page = await collect(url)
      documents.push(metadataDocument(`catalog-${group}`, url, 'HTML', page))
      for (const file of senateFileUrls(page.body.toString('utf8'))) urls.add(file)
    }
    const files = [...urls].map((url) => archiveFile({ name: `file-${sha256(url).slice(0, 20)}`, title: decodeURIComponent(new URL(url).pathname.split('/').pop()!), url, format: new URL(url).pathname.split('.').pop()!.toUpperCase(), period: null, catalogUrl: SENADO_CATALOG, selected: true, reason: 'Arquivo legislativo anunciado pelo catálogo oficial; cobertura específica a confirmar no documento' }))
    const today = new Date().toISOString().slice(0, 10)
    const legislatureUrl = [...urls].find((url) => url.endsWith('/ListaLegislatura.json'))
    if (!legislatureUrl) throw new Error('Cadastro de legislaturas do Senado não localizado')
    const legislature = await collect(legislatureUrl)
    const definitions = (JSON.parse(legislature.body.toString('utf8')) as { ListaLegislatura: { Legislaturas: { Legislatura: { NumeroLegislatura: string; DataInicio: string; DataFim: string }[] } } }).ListaLegislatura.Legislaturas.Legislatura
    const current = definitions.find((entry) => entry.DataInicio <= today && entry.DataFim >= today)
    if (!current) throw new Error('Legislatura atual do Senado não localizada')
    const yearly: ImportResource[] = []
    for (let year = HISTORICAL_COLLECTION_FROM; year <= new Date().getUTCFullYear(); year++) {
      const url = `https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=${year}-01-01&dataFim=${year}-12-31`
      yearly.push(archiveFile({ name: `votacoes-${year}`, title: `Votações e votos do Senado: ${year}`, url, format: 'JSON', period: String(year), catalogUrl: 'https://www12.senado.leg.br/dados-abertos/conjuntos?portal=Legislativo&grupo=plenario', selected: true, reason: 'Mesma API usada pelo backend, consulta anual desde o corte de 2000; cobertura observada deve ser conferida na resposta' }))
    }
    const currentUrl = 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual'
    const currentList = archiveFile({ name: 'senadores-em-exercicio-api', title: 'Senadores em exercício: resposta da API usada pelo backend', url: currentUrl, format: 'JSON', period: null, catalogUrl: SENADO_CATALOG, selected: true, reason: 'Cadastro necessário para as telas atuais' })
    const catalogue = new Map([...inventory.resources, ...files, ...yearly, currentList].map((resource) => [resource.name, resource]))
    return { source: { id: this.id, title: 'Senado: arquivos legislativos, dicionários e votações', organization: 'Senado Federal', jurisdiction_code: 'BR', official_url: 'https://www12.senado.leg.br/dados-abertos', metadata: { archiveOnly: true, currentLegislature: current, historicalCollectionFrom: HISTORICAL_COLLECTION_FROM, declaredFiles: files.length, generalCatalogueResources: inventory.resources.length, incompleteDictionaryRows: inventory.incompleteRows, catalogScope: 'Catálogo/dicionários gerais oficiais; coleta dos cinco grupos legislativos', periods: yearly.map((resource) => resource.name), csvVotingCoverage: 'CSV pode conter somente últimos 12 meses; histórico usa consultas anuais separadas, com respostas vazias identificadas explicitamente', currentYearIsPartial: true, apiDocumentationIssue: 'Swagger UI consultado apontava para Petstore; não usar como contrato confirmado do Senado' } }, catalog: [...catalogue.values()], resources: [...documents, ...files.filter((resource) => resource.format !== 'ZIP'), currentList, ...yearly] }
  },
}
