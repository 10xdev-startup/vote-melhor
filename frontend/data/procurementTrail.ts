import type { InvestigationSource, InvestigationStep, InvestigationTrail } from '@/types/investigationTrail'

// Curadoria de documentos oficiais consultados em 09/10/2026. Não há consulta de editais via API.
export const PROCUREMENT_SOURCES: Record<string, InvestigationSource> = {
  'procurement-law': {
    id: 'procurement-law', organization: 'Presidência da República', title: 'Lei 14.133/2021 — Licitações e Contratos',
    officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm', access: ['Legislação', 'Leitura pública'],
    instructions: 'Consultar o texto atualizado e os artigos indicados na orientação. Conferir o regime legal do edital.',
    reviewNote: 'Texto legal consultado. Nenhum edital específico foi analisado.',
  },
  'procurement-pncp': {
    id: 'procurement-pncp', organization: 'Ministério da Gestão e da Inovação em Serviços Públicos', title: 'Portal Nacional de Contratações Públicas — PNCP',
    officialUrl: 'https://www.gov.br/pncp/pt-br', access: ['Portal', 'Consulta manual'],
    instructions: 'Abrir Contratações para pesquisar editais, avisos, atas e contratos. Consultar também os planos anuais e seguir o endereço do sistema de disputa indicado no edital.',
    reviewNote: 'Página institucional consultada. A aplicação de pesquisa depende de JavaScript; não foi executada uma busca autenticada nem validado um edital.',
  },
  'procurement-sicaf': {
    id: 'procurement-sicaf', organization: 'Ministério da Gestão e da Inovação em Serviços Públicos', title: 'SICAF Digital',
    officialUrl: 'https://www.gov.br/compras/pt-br/sicaf-digital', access: ['Cadastro', 'Acesso gov.br'],
    instructions: 'Usar Acessar o SICAF para o credenciamento e atualização cadastral. O cadastro é digital e gratuito; conferir documentação e requisitos de identificação no serviço.',
    reviewNote: 'Orientação pública consultada. Não houve login, cadastro ou validação de documentos de uma empresa.',
  },
  'procurement-supplier-guide': {
    id: 'procurement-supplier-guide', organization: 'Ministério da Gestão e da Inovação em Serviços Públicos', title: 'Guia do fornecedor — como vender para o governo',
    officialUrl: 'https://www.gov.br/compras/pt-br/temporario-compras-gov.br/fornecedor-1/defeso-guia-do-fornecedor-como-vender-para-governo.pdf', access: ['PDF', 'Guia oficial'],
    instructions: 'Ler o fluxo de conta gov.br, credenciamento SICAF e acesso à área do fornecedor no Compras.gov.br. Conferir também as regras da plataforma indicada no edital.',
    reviewNote: 'PDF de uma página consultado a partir do link do portal oficial de fornecedores. A área autenticada não foi testada.',
  },
  'procurement-electronic-rules': {
    id: 'procurement-electronic-rules', organization: 'Secretaria de Gestão e Inovação — MGI', title: 'IN SEGES/ME 73/2022 — licitação eletrônica',
    officialUrl: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-73-de-30-de-setembro-de-2022', access: ['Norma atualizada', 'Leitura pública'],
    instructions: 'Consultar credenciamento, proposta, modos de disputa, julgamento e habilitação. Aplicável ao âmbito definido na norma; não substituir a regulamentação do órgão por uma regra federal genérica.',
    reviewNote: 'Página comentada e atualizada consultada, incluindo alterações exibidas no texto. Nenhuma sessão foi acompanhada.',
  },
  'procurement-tic-rules': {
    id: 'procurement-tic-rules', organization: 'Secretaria de Governo Digital — MGI', title: 'IN SGD/ME 94/2022 — contratação de soluções de TIC',
    officialUrl: 'https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/legislacao/processo-de-contratacao-de-solucoes-de-tic-regido-pela-lei-ndeg-14-133-de-2021', access: ['Norma de TIC', 'Leitura pública'],
    instructions: 'Conferir o âmbito do SISP e as fases de planejamento, seleção e gestão contratual. Ler o termo de referência e seus modelos de execução, gestão e pagamento.',
    reviewNote: 'Norma publicada no Governo Digital consultada. Sua aplicação depende do órgão e do regime da contratação.',
  },
  'procurement-tcu-bidding': {
    id: 'procurement-tcu-bidding', organization: 'Tribunal de Contas da União', title: 'Manual do TCU — regras da licitação',
    officialUrl: 'https://licitacoesecontratos.tcu.gov.br/4-5-3-regras-da-licitacao/', access: ['Manual', 'Leitura pública'],
    instructions: 'Revisar conteúdo da proposta, critérios de aceitabilidade, custos, habilitação e condições de participação. Localizar as exigências correspondentes no edital concreto.',
    reviewNote: 'Capítulo do manual online consultado. É orientação de referência; as condições da contratação precisam ser lidas no edital.',
  },
  'procurement-tcu-qualification': {
    id: 'procurement-tcu-qualification', organization: 'Tribunal de Contas da União', title: 'Manual do TCU — habilitação',
    officialUrl: 'https://licitacoesecontratos.tcu.gov.br/5-5-habilitacao-2/', access: ['Manual', 'Leitura pública'],
    instructions: 'Conferir os grupos de habilitação e a forma e o momento de apresentação dos documentos previstos no edital.',
    reviewNote: 'Capítulo de habilitação consultado. Certidões e situação cadastral de fornecedores não foram verificadas.',
  },
  'procurement-tcu-technical': {
    id: 'procurement-tcu-technical', organization: 'Tribunal de Contas da União', title: 'Manual do TCU — habilitação técnica',
    officialUrl: 'https://licitacoesecontratos.tcu.gov.br/5-5-2-habilitacao-tecnica/', access: ['Manual', 'Leitura pública'],
    instructions: 'Distinguir a experiência do fornecedor da conformidade do produto ofertado. Conferir atestados, profissionais e exigências compatíveis com o objeto.',
    reviewNote: 'Orientação sobre qualificação técnica consultada. Não foi avaliado se uma empresa atende a um edital.',
  },
  'procurement-tcu-requirements': {
    id: 'procurement-tcu-requirements', organization: 'Tribunal de Contas da União', title: 'Manual do TCU — requisitos da contratação',
    officialUrl: 'https://licitacoesecontratos.tcu.gov.br/4-1-3-requisitos-da-contratacao/', access: ['Manual', 'Leitura pública'],
    instructions: 'Consultar a distinção entre requisitos do objeto e habilitação, além de previsão de amostras, exame de conformidade ou prova de conceito.',
    reviewNote: 'Capítulo consultado. A existência e o procedimento de uma prova de conceito dependem do edital.',
  },
}

const steps: InvestigationStep[] = [
  {
    id: 'procurement-scope', title: 'Definir o que sua empresa pode fornecer', question: 'Que solução de TI queremos vender e quais regras se aplicam?',
    purpose: 'Começar pelo objeto e pelo órgão comprador: software, equipamentos, nuvem, suporte ou desenvolvimento têm exigências próprias.',
    sourceIds: ['procurement-tic-rules', 'procurement-law'], status: 'documented', coverage: [], fields: ['Objeto', 'Órgão', 'Regime legal', 'Modalidade e critério'],
    connection: 'A Lei 14.133 é o recorte desta trilha. Empresas estatais, em regra, seguem a Lei 13.303/2016; verificar o regime antes de aplicar estas orientações.',
    guidance: { actions: ['Descreva a solução e confira se consegue entregar o escopo do edital.', 'Verifique a modalidade e o critério de julgamento. Nem toda contratação de TI é um pregão.', 'No âmbito do SISP, confira a IN SGD/ME 94/2022: soluções comuns usam pregão; bens e serviços especiais podem envolver técnica e preço conforme a norma.'], outcome: 'Recorte do serviço, do comprador e das regras aplicáveis.', references: ['Lei 14.133/2021, art. 1º, § 1º', 'IN SGD/ME 94/2022, arts. 1º, 23 e 25'] },
  },
  {
    id: 'procurement-opportunities', title: 'Encontrar editais e oportunidades', question: 'Onde procurar compras públicas de TI?',
    purpose: 'Usar o PNCP como ponto de descoberta e conferir as publicações do órgão.', sourceIds: ['procurement-pncp'], status: 'documented', coverage: [], fields: ['Órgão', 'Objeto', 'Número da contratação', 'Prazo', 'Sistema da disputa'],
    connection: 'O PNCP reúne publicações. A proposta é enviada no sistema indicado no edital, que pode ser o Compras.gov.br ou outra plataforma.',
    guidance: { actions: ['Procure termos do seu serviço, como desenvolvimento de software, suporte, licenciamento ou infraestrutura.', 'Abra o edital e os anexos; confira situação, datas, órgão e endereço da disputa.', 'Guarde o identificador da contratação e acompanhe retificações. Planos anuais ajudam a conhecer demandas futuras, mas não são editais abertos.'], outcome: 'Lista de oportunidades com edital, prazo e plataforma identificados.', references: ['PNCP — Contratações e Planos de Contratações Anuais'] },
  },
  {
    id: 'procurement-registration', title: 'Preparar os cadastros de fornecedor', question: 'Quais acessos preciso antes de enviar uma proposta?',
    purpose: 'Para operar no Compras.gov.br, organizar acesso gov.br, credenciamento no SICAF e cadastro na plataforma.', sourceIds: ['procurement-sicaf', 'procurement-supplier-guide'], status: 'documented', coverage: [], fields: ['Representante', 'CNPJ', 'Credenciamento', 'Plataforma'],
    connection: 'SICAF não substitui toda a habilitação. Estados e municípios podem usar cadastros e plataformas diferentes: verificar o edital.',
    guidance: { actions: ['Confira quem representará a empresa e os requisitos de identificação do serviço.', 'Faça o credenciamento gratuito no SICAF e mantenha os dados atualizados.', 'Organize o acesso à área do fornecedor e os cadastros exigidos na plataforma da disputa antes do prazo.'], outcome: 'Representante e acessos preparados para a plataforma escolhida.', references: ['SICAF Digital', 'Guia oficial do fornecedor — gov.br, SICAF e Compras.gov.br'] },
  },
  {
    id: 'procurement-notice', title: 'Ler o edital e o termo de referência', question: 'O que exatamente precisa ser entregue e como será avaliado?',
    purpose: 'Transformar edital, anexos e retificações em uma lista de requisitos.', sourceIds: ['procurement-tcu-bidding', 'procurement-tic-rules'], status: 'documented', coverage: [], fields: ['Itens e lotes', 'Requisitos técnicos', 'Prazos', 'Critério de julgamento', 'Aceite e pagamento'],
    connection: 'A proposta deve atender ao objeto e às regras de julgamento. A habilitação verifica a empresa; são avaliações distintas.',
    guidance: { actions: ['Confira itens, lotes, especificações, local de execução e prazo de entrega.', 'Leia suporte, níveis de serviço, segurança, licenças e transferência de conhecimento quando previstos.', 'Marque documentos, declarações, critérios de aceite e condições de pagamento. Confira regras de participação e eventuais benefícios para ME/EPP.'], outcome: 'Lista de exigências com indicação do item do edital que sustenta cada uma.', references: ['TCU, seção 4.5.3', 'IN SGD/ME 94/2022 — termo de referência'] },
  },
  {
    id: 'procurement-documents', title: 'Organizar a documentação de habilitação', question: 'Como comprovar que a empresa pode executar o contrato?',
    purpose: 'Preparar a documentação jurídica, técnica, fiscal, social, trabalhista e econômico-financeira exigida.', sourceIds: ['procurement-tcu-qualification', 'procurement-tcu-technical'], status: 'documented', coverage: [], fields: ['Documentos societários', 'Regularidade', 'Atestados', 'Qualificação econômico-financeira'],
    connection: 'Atestados demonstram experiência compatível; não são a mesma coisa que testar a solução ofertada. Não presumir que toda licitação de TI exige a mesma certificação.',
    guidance: { actions: ['Separe os documentos e confira validade e requisitos na data relevante do edital.', 'Compare seus atestados com o escopo e os quantitativos exigidos, inclusive requisitos dos profissionais quando cabíveis.', 'Confira o que o SICAF cobre e quais documentos adicionais precisam ser enviados. Prepare-os antes da sessão, mesmo quando a entrega ocorrer depois.'], outcome: 'Pasta de habilitação organizada e lacunas identificadas antes da disputa.', references: ['TCU, seções 5.5 e 5.5.2', 'Lei 14.133/2021, arts. 62 a 69'] },
  },
  {
    id: 'procurement-proposal', title: 'Montar o preço e cadastrar a proposta', question: 'Qual preço permite entregar tudo o que foi exigido?',
    purpose: 'Preparar uma proposta compatível com o objeto, os custos e o formulário da plataforma.', sourceIds: ['procurement-tcu-bidding', 'procurement-electronic-rules'], status: 'documented', coverage: [], fields: ['Preço unitário e total', 'Quantidade', 'Validade', 'Descrição', 'Custos'],
    connection: 'O menor preço precisa continuar atendendo às especificações e aos critérios de aceitabilidade. Cadastrar proposta é diferente de apresentar lances.',
    guidance: { actions: ['Calcule equipe, tributos, licenças, infraestrutura, suporte e demais custos do escopo.', 'Confira unidade de medida, quantidades, preço por item ou lote e prazo de validade; defina seu limite econômico para a disputa.', 'Envie a proposta e as declarações exigidas pelo sistema antes da abertura. Confira o comprovante e as possibilidades de ajuste até o prazo.'], outcome: 'Proposta enviada e limite econômico calculado para os lances.', references: ['TCU, seção 4.5.3 — conteúdo e aceitabilidade das propostas', 'IN SEGES/ME 73/2022 — apresentação da proposta'] },
  },
  {
    id: 'procurement-clarification', title: 'Pedir esclarecimentos ou impugnar o edital', question: 'Como agir se um requisito estiver ambíguo ou irregular?',
    purpose: 'Resolver dúvidas pelo canal oficial antes da abertura.', sourceIds: ['procurement-law'], status: 'documented', coverage: [], fields: ['Requisito questionado', 'Canal oficial', 'Prazo', 'Resposta'],
    connection: 'Na Lei 14.133, o pedido deve ser protocolado até 3 dias úteis antes da abertura. A resposta sai em até 3 dias úteis, limitada ao último dia útil anterior à abertura.',
    guidance: { actions: ['Indique o item do edital e formule a dúvida ou irregularidade de modo objetivo.', 'Use o canal e a contagem de dias úteis aplicáveis ao certame; guarde o protocolo.', 'Leia a resposta e eventuais retificações antes de fechar a proposta.'], outcome: 'Dúvida esclarecida ou questionamento formalizado com evidência.', references: ['Lei 14.133/2021, art. 164'] },
  },
  {
    id: 'procurement-session', title: 'Acompanhar a sessão e os lances', question: 'O que fazer durante a disputa eletrônica?',
    purpose: 'Monitorar a sessão, os avisos e as convocações na plataforma.', sourceIds: ['procurement-electronic-rules'], status: 'documented', coverage: [], fields: ['Data e hora', 'Modo de disputa', 'Intervalo entre lances', 'Mensagens', 'Convocações'],
    connection: 'Modos de disputa e intervalos mudam a operação. Estas orientações federais precisam ser confrontadas com o edital e o sistema usado.',
    guidance: { actions: ['Entre com antecedência e confira os itens em que sua proposta foi registrada.', 'Acompanhe o modo de disputa, os intervalos e as mensagens; ofereça lances dentro do seu limite calculado.', 'Responda às convocações de negociação ou envio de documentos no prazo informado e guarde os registros.'], outcome: 'Participação registrada e convocações atendidas durante a sessão.', references: ['IN SEGES/ME 73/2022 — sessão pública, modos de disputa e negociação'] },
  },
  {
    id: 'procurement-evaluation', title: 'Atender ao julgamento e à habilitação', question: 'O melhor lance já significa que ganhei?',
    purpose: 'Conferir a aceitação da proposta e a comprovação dos requisitos da empresa.', sourceIds: ['procurement-tcu-requirements', 'procurement-tcu-qualification'], status: 'documented', coverage: [], fields: ['Proposta ajustada', 'Conformidade', 'Prova de conceito', 'Documentação', 'Diligências'],
    connection: 'Prova de conceito, quando prevista, avalia a aderência da solução. Habilitação avalia o fornecedor; a ordem pode variar com inversão de fases prevista no edital.',
    guidance: { actions: ['Apresente a proposta ajustada e os documentos quando convocado.', 'Se o edital prever prova de conceito ou amostra, prepare a demonstração conforme critérios e procedimento publicados.', 'Acompanhe julgamento, habilitação e diligências. Um lance melhor classificado ainda depende dessas avaliações.'], outcome: 'Proposta e habilitação avaliadas com registro das decisões.', references: ['TCU, seções 4.1.3 e 5.5', 'Lei 14.133/2021, art. 17, §§ 1º e 3º'] },
  },
  {
    id: 'procurement-appeal', title: 'Acompanhar decisões e recursos', question: 'Como questionar julgamento ou inabilitação?',
    purpose: 'Distinguir a intenção de recorrer da apresentação das razões do recurso.', sourceIds: ['procurement-law'], status: 'documented', coverage: [], fields: ['Decisão', 'Intenção de recurso', 'Razões', 'Contrarrazões', 'Ata'],
    connection: 'No julgamento e na habilitação, a intenção de recorrer deve ser imediata. O prazo das razões é de 3 dias úteis, contado do marco legal aplicável; não são 3 dias para manifestar a intenção.',
    guidance: { actions: ['Acompanhe a janela para manifestar intenção de recurso no sistema.', 'Registre os fundamentos e apresente as razões no prazo, com base no edital e nas decisões.', 'Leia recursos, contrarrazões e o resultado antes de tratar a contratação como concluída.'], outcome: 'Direito de recurso acompanhado e decisões registradas.', references: ['Lei 14.133/2021, art. 165, I e § 1º'] },
  },
  {
    id: 'procurement-contract', title: 'Formalizar e executar o contrato', question: 'O que vem depois do resultado da licitação?',
    purpose: 'Acompanhar homologação, convocação e obrigações de execução da solução.', sourceIds: ['procurement-tic-rules', 'procurement-law'], status: 'documented', coverage: [], fields: ['Contrato', 'Garantia quando exigida', 'Ordens de serviço', 'Aceite', 'Medição', 'Pagamento'],
    connection: 'Vencer a disputa não é autorização para iniciar qualquer serviço. Se houver registro de preços, a ata não obriga a Administração a contratar.',
    guidance: { actions: ['Confira a convocação, o instrumento contratual e o prazo de assinatura; providencie a garantia se exigida.', 'Planeje entregas, suporte, responsáveis e registros de execução conforme contrato e ordens emitidas.', 'Documente medição e aceite, acompanhe faturamento e pagamento e mantenha as condições de habilitação exigidas.'], outcome: 'Contrato formalizado e execução acompanhada com evidências.', references: ['IN SGD/ME 94/2022 — gestão do contrato', 'Lei 14.133/2021, arts. 83, 90 e 92'] },
  },
]

export const PROCUREMENT_TRAIL: InvestigationTrail = {
  id: 'licitacao-ti', title: 'Como participar de uma licitação de TI?', question: 'Como uma empresa pode vender soluções de tecnologia para o governo?',
  description: 'Do edital à execução: um roteiro para empresas, com documentos oficiais e ações práticas para participar de contratações de tecnologia.',
  territory: 'Brasil', searchTerms: ['licitação', 'licitacao', 'licitações', 'licitacoes', 'participar', 'uma', 'ti', 'tic', 'tecnologia', 'informática', 'informatica', 'compras', 'fornecedor', 'sicaf', 'pncp', 'pregão', 'pregao', 'software', 'vender', 'governo'], steps,
  research: { reviewedAt: '2026-10-09', scope: 'Roteiro para licitações regidas pela Lei 14.133/2021, com operação federal no Compras.gov.br como referência. A IN SGD/ME 94/2022 tem âmbito próprio no SISP. Para estados, municípios e outros regimes, conferir regras, cadastro e plataforma do edital.' },
}
