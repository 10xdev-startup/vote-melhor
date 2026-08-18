import type { DataRoadmapSection } from '@/types/dataRoadmap'

export const ROADMAP_FIXTURE: DataRoadmapSection[] = [
  {
    id: 'senate-next',
    title: 'Senado Federal — próximo núcleo',
    description: 'Fontes oficiais já identificadas.',
    items: [
      {
        id: 'senate-members',
        title: 'Senadores, mandatos e filiações',
        description: 'Parlamentares e seus vínculos históricos.',
        organ: 'Senado Federal',
        access: ['API'],
        status: 'mapped',
        officialUrl: 'https://legis.senado.leg.br/dadosabertos',
        nextStep: 'Criar as entidades do domínio.',
      },
    ],
  },
  {
    id: 'chamber-and-control',
    title: 'Câmara e controle federal',
    description: 'Fontes legislativas e de controle.',
    items: [
      {
        id: 'chamber-members',
        title: 'Deputados, mandatos e órgãos',
        description: 'Cadastro e situação de deputados.',
        organ: 'Câmara dos Deputados',
        access: ['API'],
        status: 'mapped',
        officialUrl: 'https://dadosabertos.camara.leg.br/',
        nextStep: 'Adaptar o modelo comum de parlamentar.',
      },
    ],
  },
  {
    id: 'future',
    title: 'Próximas frentes',
    description: 'Fontes que ainda precisam de descoberta.',
    items: [
      {
        id: 'higher-courts',
        title: 'Tribunais superiores',
        description: 'Processos e decisões judiciais.',
        organ: 'STF e STJ',
        access: ['A definir'],
        status: 'discovery',
        officialUrl: 'https://portal.stf.jus.br/',
        officialSources: [
          { label: 'API DataJud', url: 'https://datajud-wiki.cnj.jus.br/api-publica/' },
          { label: 'Estatísticas STF', url: 'https://portal.stf.jus.br/estatistica/' },
        ],
        nextStep: 'Mapear fontes oficiais estáveis.',
      },
    ],
  },
  {
    id: 'available',
    title: 'Já disponível',
    description: 'Conjuntos com metadados, download e visualização funcionando na plataforma.',
    items: [
      {
        id: 'despesas',
        title: 'Dotação e despesas executadas',
        description: 'Dotação e execução do orçamento.',
        organ: 'Senado Federal',
        access: ['CSV', 'JSON'],
        status: 'available',
        officialUrl: 'https://www12.senado.leg.br/dados-abertos',
        nextStep: 'Evoluir para séries por exercício.',
        catalogQuery: 'despesas',
      },
      {
        id: 'receitas-proprias',
        title: 'Receitas próprias',
        description: 'Previsão e arrecadação das receitas próprias.',
        organ: 'Senado Federal',
        access: ['CSV', 'JSON'],
        status: 'available',
        officialUrl: 'https://www12.senado.leg.br/dados-abertos',
        nextStep: 'Evoluir para indicadores temporais.',
        catalogQuery: 'receitas próprias',
      },
      {
        id: 'demonstracoes',
        title: 'Demonstrações contábeis',
        description: 'Balanços e demonstrações anuais.',
        organ: 'Senado Federal',
        access: ['CSV'],
        status: 'available',
        officialUrl: 'https://www12.senado.leg.br/dados-abertos',
        nextStep: 'Extrair indicadores comparáveis.',
        catalogQuery: 'balanço',
      },
    ],
  },
]
