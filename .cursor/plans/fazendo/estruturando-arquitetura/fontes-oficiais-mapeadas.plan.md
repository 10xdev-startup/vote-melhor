# Fontes oficiais mapeadas

Conferido em 10/08/2026. Este documento preserva os contratos e as decisões úteis da pesquisa que fundamentou o roadmap da 10xGov. Os resultados brutos das ferramentas de busca ficam fora do Git: são volumosos, incluem páginas irrelevantes e envelhecem mais rápido que este inventário curado.

## Critério de status

- **Disponível:** download, leitura e visualização já funcionam na plataforma.
- **Mapeado:** a fonte oficial, o formato e um próximo contrato de integração foram identificados; ainda não significa que o dado esteja disponível na 10xGov.
- **A mapear:** ainda faltam fonte ou contrato suficientemente estáveis.

O backend em `backend/src/models/DataRoadmapModel.ts` é a fonte de verdade executável do roadmap. Este arquivo registra os detalhes que ajudam a implementar os próximos conectores.

## Ipea · Ipeadata

### Fontes

- Documentação: https://www.ipeadata.gov.br/api/
- Base OData documentada: http://www.ipeadata.gov.br/api/odata4/
- Metadados do serviço: http://www.ipeadata.gov.br/api/odata4/$metadata

### Contrato identificado

- REST com protocolo OData v4 e respostas JSON.
- Entidades: `Metadados`, `Valores`, `ValoresStr`, `Temas`, `Paises` e `Territorios`.
- Série identificada por `SERCODIGO`.
- Observação numérica contém `SERCODIGO`, `VALDATA`, `VALVALOR`, `NIVNOME` e `TERCODIGO`.
- Metadados incluem fonte, unidade, periodicidade, atualização, tema, base e situação ativa/inativa.
- Séries macroeconômicas usam país; séries regionais e sociais podem usar território e códigos do IBGE.

### Cuidados e próxima entrega

- A documentação é acessível por HTTPS, mas ainda publica as URLs operacionais OData em HTTP; testar o acesso real no ambiente de deploy antes de fechar o conector.
- Não misturar séries só porque compartilham nome: `SERCODIGO`, unidade, periodicidade, fonte e território compõem o contexto da observação.
- Construir primeiro o catálogo de séries; depois selecionar uma cesta pequena e ingerir valores incrementalmente.
- Preservar séries inativas para permitir análises históricas.

## STF, STJ e DataJud

### Fontes

- Catálogo de dados abertos do STJ: https://dadosabertos.web.stj.jus.br/dataset/
- API Pública DataJud: https://datajud-wiki.cnj.jus.br/api-publica/
- Endpoints DataJud: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
- Estatísticas processuais do STF: https://portal.stf.jus.br/textos/verTexto.asp?pagina=atualizacoesEstatisticasProcessuais&servico=CartaServicosJurisdicionais
- Corte Aberta STF: https://portal.stf.jus.br/hotsites/corteaberta/

### Contrato identificado — STJ

- O catálogo do STJ publica CSV, JSON e arquivos compactados, com dicionários de dados.
- Há conjuntos de acervo em tramitação, atas de distribuição, pautas futuras, precedentes, decisões terminativas e acórdãos.
- Alguns conjuntos são snapshots diários; os espelhos de acórdãos combinam uma carga histórica com atualizações posteriores.
- O DataJud expõe capas e movimentações processuais via API de busca. O endpoint do STJ usa o alias `api_publica_stj`.
- Processos sigilosos e dados protegidos não integram o contrato público.

### Contrato identificado — STF

- O STF oferece painéis, relatórios dinâmicos e planilhas para estatísticas processuais, decisões, acervo e pautas.
- Não foi confirmado um endpoint público estável equivalente ao DataJud do STJ para toda a cobertura pretendida.
- O conector do STF deve começar pelas planilhas/exportações oficiais e não depender da implementação interna dos painéis.

### Cuidados e próxima entrega

- Implementar conectores separados para STF e STJ; a mesma tela de produto não implica uma única origem técnica.
- Usar a numeração processual como referência externa, sem assumir que ela basta para identificar decisão, movimento ou documento.
- Modelar separadamente `Processo`, `Movimento`, `Decisao`, `Acordao`, `Sessao` e `Documento`.
- Armazenar data do snapshot e origem para reconciliar correções e republicações.
- Verificar termos de uso, paginação, limites e política de atualização do DataJud antes da ingestão contínua.

## Tribunal de Contas da União

### Fontes

- Portal de dados abertos: https://sites.tcu.gov.br/dados-abertos/
- Webservices documentados: https://sites.tcu.gov.br/dados-abertos/webservices-tcu/

### Contrato identificado

- Webservices REST com respostas principalmente JSON; alguns recursos e downloads também usam CSV, XML, DOC e PDF.
- Acórdãos: paginação por índice e quantidade, com número, ano, colegiado, sessão, relator, situação, sumário e links para o documento.
- Atos normativos: tipo, número, datas, situação, ementa, relações de alteração/revogação e texto.
- Cadastros públicos: responsáveis inabilitados, licitantes inidôneos e contas julgadas irregulares.
- Solicitações do Congresso: dados do pedido, autoria, processo no TCU e links para a proposição; a resposta informa a próxima página.
- Também há pautas de sessões, licitações, compras diretas e termos contratuais.

### Cuidados e próxima entrega

- A documentação alerta que alguns serviços podem ficar indisponíveis entre 20h e 21h; o coletor precisa de retry e observabilidade.
- Nem todos os recursos usam o mesmo host, protocolo, paginação ou método HTTP.
- Começar por `Acordao`, `Processo` e `Responsavel`, preservando a chave publicada pelo TCU e os links dos documentos originais.
- Validar uma estratégia incremental antes de automatizar; paginação por índice isoladamente não garante captura confiável de alterações.
- Relacionar sanções, solicitações do Congresso, contratos e fiscalizações apenas quando houver identificadores verificáveis.

## Evidência e manutenção

- Toda integração deve registrar URL oficial, instante de coleta, hash do artefato e versão do normalizador.
- Mudanças de contrato devem atualizar primeiro o teste de fixture e depois este inventário quando alterarem uma decisão arquitetural.
- Novos links entram no `DataRoadmapModel`; detalhes operacionais e limitações ficam neste documento.
- Resultados brutos de pesquisa podem ser guardados localmente ou em armazenamento de artefatos, mas não devem substituir fontes oficiais nem entrar no histórico principal do Git.
