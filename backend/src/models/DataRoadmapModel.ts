import { DataCatalogModel } from '@/models/DataCatalogModel'
import type { DataRoadmapItem, DataRoadmapSection, DataRoadmapStatus } from '@/types/dataRoadmap'

const SENADO_CATALOG = 'https://www12.senado.leg.br/dados-abertos'
const SENADO_API = 'https://legis.senado.leg.br/dadosabertos/api-docs/swagger-ui/index.html'
const CAMARA_API = 'https://dadosabertos.camara.leg.br/swagger/api.html'

interface AvailableRoadmapConfig {
  datasetId: string
  nextStep: string
  catalogQuery: string
}

/** Metadados que só pertencem ao roadmap; título, origem, descrição e formatos vêm do catálogo. */
const AVAILABLE_ROADMAP_CONFIG: AvailableRoadmapConfig[] = [
  {
    datasetId: 'senado-dotacao-e-despesas',
    nextStep: 'Manter a leitura diária e evoluir para séries e comparações por exercício.',
    catalogQuery: 'despesas',
  },
  {
    datasetId: 'senado-receitas-proprias',
    nextStep: 'Transformar os totais já calculados em indicadores e evolução temporal.',
    catalogQuery: 'receitas próprias',
  },
  {
    datasetId: 'senado-demonstracoes-contabeis',
    nextStep: 'Extrair indicadores comparáveis sem perder o vínculo com as linhas do demonstrativo.',
    catalogQuery: 'balanço',
  },
  {
    datasetId: 'sp-execucao-investimentos',
    nextStep: 'Consolidar a série por exercício e comparar previsto, empenhado, liquidado e pago sem misturar as fases.',
    catalogQuery: 'investimentos são paulo',
  },
]

function buildAvailableItems(): DataRoadmapItem[] {
  const datasets = new Map(DataCatalogModel.listDatasets().map((dataset) => [dataset.id, dataset]))

  return AVAILABLE_ROADMAP_CONFIG.map((config) => {
    const dataset = datasets.get(config.datasetId)
    if (!dataset) throw new Error(`Roadmap referencia conjunto inexistente: ${config.datasetId}`)

    const access = [...new Set(dataset.editions.flatMap((edition) => edition.files.map((file) => file.format)))]
    return {
      id: dataset.id,
      title: dataset.title,
      description: dataset.description,
      organ: dataset.organ,
      access,
      status: 'available',
      officialUrl: dataset.officialUrl,
      nextStep: config.nextStep,
      catalogQuery: config.catalogQuery,
    }
  })
}

const FUTURE_SECTIONS: DataRoadmapSection[] = [
  {
    id: 'senate-next',
    title: 'Senado Federal — próximo núcleo',
    description: 'Fontes oficiais já identificadas; ainda faltam contrato, normalização e visualização na 10xGov.',
    items: [
      {
        id: 'senate-members',
        title: 'Senadores, mandatos e filiações',
        description: 'Parlamentares em exercício e históricos de mandato, partido, afastamentos, cargos e lideranças.',
        organ: 'Senado Federal',
        access: ['API'],
        status: 'mapped',
        officialUrl: SENADO_API,
        nextStep: 'Criar as entidades Parlamentar, Mandato e Filiação e resolver mudanças ao longo do tempo.',
      },
      {
        id: 'senate-bills',
        title: 'Projetos, matérias e tramitação',
        description: 'Projetos de lei, PECs, medidas provisórias, vetos, autorias, relatorias e movimentações.',
        organ: 'Senado Federal',
        access: ['API', 'XML'],
        status: 'mapped',
        officialUrl: `${SENADO_CATALOG}/conjuntos?portal=Legislativo&grupo=projetos-e-materias`,
        nextStep: 'Normalizar identificadores de matéria e montar uma linha do tempo de tramitação.',
      },
      {
        id: 'senate-votes',
        title: 'Votações nominais e orientações',
        description: 'Votos de parlamentares, resultados e orientações de bancada no plenário e nas comissões.',
        organ: 'Senado Federal',
        access: ['API'],
        status: 'mapped',
        officialUrl: SENADO_API,
        nextStep: 'Relacionar Voto, Parlamentar, Matéria e Sessão sem depender dos endpoints descontinuados.',
      },
      {
        id: 'senate-plenary',
        title: 'Plenário, sessões e discursos',
        description: 'Agendas, pautas, sessões, resultados, comparecimento e pronunciamentos de senadores.',
        organ: 'Senado Federal',
        access: ['API', 'iCal'],
        status: 'mapped',
        officialUrl: `${SENADO_CATALOG}/conjuntos?portal=Legislativo&grupo=plenario`,
        nextStep: 'Modelar Sessão e Evento e criar agenda, pauta e linha do tempo navegáveis.',
      },
      {
        id: 'senate-committees',
        title: 'Comissões, reuniões e membros',
        description: 'Comissões permanentes e temporárias, composição, reuniões, pautas e matérias em análise.',
        organ: 'Senado Federal',
        access: ['API'],
        status: 'mapped',
        officialUrl: `${SENADO_CATALOG}/conjuntos?portal=Legislativo&grupo=comissoes`,
        nextStep: 'Ligar membros e reuniões às matérias, votações e relatorias correspondentes.',
      },
      {
        id: 'senate-composition',
        title: 'Blocos, lideranças e Mesa Diretora',
        description: 'Composição política do Senado e do Congresso, incluindo blocos e cargos de liderança.',
        organ: 'Senado Federal',
        access: ['API'],
        status: 'mapped',
        officialUrl: `${SENADO_CATALOG}/conjuntos?portal=Legislativo&grupo=composicao`,
        nextStep: 'Representar vínculos com vigência para explicar a composição em qualquer data.',
      },
      {
        id: 'senate-member-expenses',
        title: 'Cotas, benefícios e viagens de senadores',
        description: 'Gastos ligados ao exercício do mandato, benefícios e deslocamentos parlamentares.',
        organ: 'Senado Federal',
        access: ['CSV', 'JSON'],
        status: 'mapped',
        officialUrl: `${SENADO_CATALOG}/conjuntos?portal=Administrativo&grupo=senadores`,
        nextStep: 'Separar despesa, documento, fornecedor e beneficiário e criar totais auditáveis.',
      },
      {
        id: 'senate-people',
        title: 'Gestão de pessoas e remuneração',
        description: 'Servidores efetivos, comissionados, aposentados, lotação, cargos e remuneração.',
        organ: 'Senado Federal',
        access: ['CSV'],
        status: 'mapped',
        officialUrl: `${SENADO_CATALOG}/conjuntos?portal=Administrativo&grupo=gestao-de-pessoas`,
        nextStep: 'Definir o tratamento de dados pessoais e normalizar cargo, vínculo, lotação e competência.',
      },
      {
        id: 'senate-procurement',
        title: 'Contratos e licitações do Senado',
        description: 'Contratos, aditivos, itens contratados e dados dos processos licitatórios da Casa.',
        organ: 'Senado Federal',
        access: ['CSV', 'JSON'],
        status: 'mapped',
        officialUrl: `${SENADO_CATALOG}/conjuntos?portal=Administrativo&grupo=contratacoes`,
        nextStep: 'Unificar fornecedor, licitação, contrato, aditivo e item em uma cadeia rastreável.',
      },
    ],
  },
  {
    id: 'chamber-and-control',
    title: 'Câmara e controle federal',
    description: 'A segunda Casa legislativa e as fontes que explicam a execução financeira e as compras públicas.',
    items: [
      {
        id: 'chamber-members',
        title: 'Deputados, mandatos e órgãos',
        description: 'Cadastro e situação de deputados, legislaturas, frentes, blocos, lideranças e órgãos.',
        organ: 'Câmara dos Deputados',
        access: ['API', 'CSV'],
        status: 'mapped',
        officialUrl: CAMARA_API,
        nextStep: 'Adaptar o modelo comum de Parlamentar sem apagar diferenças entre Câmara e Senado.',
      },
      {
        id: 'chamber-bills',
        title: 'Proposições e tramitação',
        description: 'Proposições, temas, autores, órgãos, relatorias e histórico de movimentações na Câmara.',
        organ: 'Câmara dos Deputados',
        access: ['API', 'CSV', 'XLSX'],
        status: 'mapped',
        officialUrl: CAMARA_API,
        nextStep: 'Criar identificadores canônicos para acompanhar matérias que transitam entre as Casas.',
      },
      {
        id: 'chamber-votes-events',
        title: 'Votações, eventos e discursos',
        description: 'Eventos legislativos, pautas, votações, votos individuais e discursos na Câmara.',
        organ: 'Câmara dos Deputados',
        access: ['API', 'CSV'],
        status: 'mapped',
        officialUrl: 'https://dadosabertos.camara.leg.br/howtouse/2020-02-07-dados-votacoes.html',
        nextStep: 'Validar a semântica das votações e encaixá-las no mesmo contrato de voto do Senado.',
      },
      {
        id: 'federal-budget-execution',
        title: 'Emendas e execução do orçamento federal',
        description: 'Emendas parlamentares e documentos de empenho, liquidação e pagamento da União.',
        organ: 'CGU · Portal da Transparência',
        access: ['API', 'CSV'],
        status: 'mapped',
        officialUrl: 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares',
        nextStep: 'Ligar autoria da emenda, favorecido, localidade e documentos de execução orçamentária.',
      },
      {
        id: 'federal-transparency',
        title: 'Contratos, convênios, servidores e viagens',
        description: 'Consultas transversais do Poder Executivo Federal publicadas pelo Portal da Transparência.',
        organ: 'CGU · Portal da Transparência',
        access: ['API', 'CSV'],
        status: 'mapped',
        officialUrl: 'https://portaldatransparencia.gov.br/api-de-dados',
        nextStep: 'Escolher um domínio inicial e documentar limites, paginação e chave obrigatória da API.',
      },
      {
        id: 'national-procurement',
        title: 'Contratações públicas nacionais',
        description: 'Planos, editais, atas, contratos e resultados publicados no PNCP por órgãos de todo o país.',
        organ: 'PNCP',
        access: ['API'],
        status: 'mapped',
        officialUrl: 'https://pncp.gov.br/api/consulta/swagger-ui/index.html',
        nextStep: 'Criar ingestão incremental por data e deduplicar órgãos, fornecedores e contratações.',
      },
      {
        id: 'subnational-accounts',
        title: 'Contas de estados e municípios',
        description: 'DCA, RREO, RGF, FINBRA e matrizes de saldos contábeis de entes subnacionais.',
        organ: 'Tesouro Nacional · Siconfi',
        access: ['API', 'CSV', 'XBRL'],
        status: 'mapped',
        officialUrl: 'https://siconfi.tesouro.gov.br/',
        nextStep: 'Começar por uma declaração e preservar ente, período, anexo e versão da taxonomia.',
      },
    ],
  },
  {
    id: 'future-fronts',
    title: 'Próximas frentes',
    description: 'Fontes previstas na visão do produto; entram depois do núcleo parlamentar e financeiro.',
    items: [
      {
        id: 'elections',
        title: 'Eleições, candidaturas e prestação de contas',
        description: 'Candidaturas, resultados, eleitorado, partidos e receitas e despesas eleitorais.',
        organ: 'Tribunal Superior Eleitoral',
        access: ['CSV'],
        status: 'mapped',
        officialUrl: 'https://dadosabertos.tse.jus.br/dataset/',
        nextStep: 'Definir recorte eleitoral e normalizar eleições, turnos, candidaturas e unidades geográficas.',
      },
      {
        id: 'official-gazette',
        title: 'Diário Oficial da União',
        description: 'Atos normativos, nomeações, contratos, avisos e demais publicações oficiais da União.',
        organ: 'Imprensa Nacional',
        access: ['XML'],
        status: 'mapped',
        officialUrl: 'https://www.gov.br/imprensanacional/pt-br/servicos/inlabs',
        nextStep: 'Definir acesso ao INLABS, versionar documentos e extrair entidades com citação do texto original.',
      },
      {
        id: 'official-statistics',
        title: 'Território, população e indicadores',
        description: 'Localidades, censos, pesquisas e séries oficiais para dar contexto aos dados governamentais.',
        organ: 'IBGE',
        access: ['API'],
        status: 'mapped',
        officialUrl: 'https://servicodados.ibge.gov.br/api/docs',
        nextStep: 'Adotar códigos IBGE como chave geográfica comum e selecionar os primeiros indicadores.',
      },
      {
        id: 'economic-indicators',
        title: 'Indicadores econômicos e sociais',
        description: 'Séries macroeconômicas, regionais e sociais com metadados, temas, valores e recorte territorial.',
        organ: 'Ipea · Ipeadata',
        access: ['API', 'JSON', 'OData'],
        status: 'mapped',
        officialUrl: 'https://www.ipeadata.gov.br/api/',
        officialSources: [{ label: 'API Ipeadata', url: 'https://www.ipeadata.gov.br/api/' }],
        nextStep: 'Criar o catálogo pelo SERCODIGO, selecionar a cesta inicial e ingerir valores preservando fonte, unidade, periodicidade e território.',
      },
      {
        id: 'higher-courts',
        title: 'Processos e decisões dos tribunais superiores',
        description: 'Capas, movimentações, acervo, pautas, decisões, acórdãos e estatísticas publicados por STF e STJ.',
        organ: 'STF e STJ',
        access: ['API', 'CSV', 'JSON', 'XLSX'],
        status: 'mapped',
        officialUrl: 'https://dadosabertos.web.stj.jus.br/dataset/',
        officialSources: [
          { label: 'Dados abertos STJ', url: 'https://dadosabertos.web.stj.jus.br/dataset/' },
          { label: 'API DataJud', url: 'https://datajud-wiki.cnj.jus.br/api-publica/' },
          { label: 'Estatísticas STF', url: 'https://portal.stf.jus.br/textos/verTexto.asp?pagina=atualizacoesEstatisticasProcessuais&servico=CartaServicosJurisdicionais' },
        ],
        nextStep: 'Criar conectores separados para STJ e STF e normalizar Processo, Movimento, Decisão e Acórdão pela numeração processual.',
      },
      {
        id: 'external-control',
        title: 'Fiscalização e decisões de controle externo',
        description: 'Acórdãos, normativos, pautas, sanções, responsáveis, solicitações do Congresso, licitações e contratos.',
        organ: 'Tribunal de Contas da União',
        access: ['API', 'JSON', 'CSV', 'XML'],
        status: 'mapped',
        officialUrl: 'https://sites.tcu.gov.br/dados-abertos/webservices-tcu/',
        officialSources: [
          { label: 'Webservices TCU', url: 'https://sites.tcu.gov.br/dados-abertos/webservices-tcu/' },
          { label: 'Bases abertas TCU', url: 'https://sites.tcu.gov.br/dados-abertos/' },
        ],
        nextStep: 'Começar por Acórdão, Processo e Responsável, validar a ingestão incremental e preservar as chaves e os documentos originais do TCU.',
      },
    ],
  },
]

function listSections(): DataRoadmapSection[] {
  return [
    ...FUTURE_SECTIONS,
    {
      id: 'available',
      title: 'Já disponível',
      description: 'Conjuntos com metadados, download e visualização funcionando na plataforma.',
      items: buildAvailableItems(),
    },
  ]
}

export const DataRoadmapModel = {
  listSections,

  countItems(status: DataRoadmapStatus): number {
    return listSections().reduce(
      (total, section) => total + section.items.filter((item) => item.status === status).length,
      0,
    )
  },
}
