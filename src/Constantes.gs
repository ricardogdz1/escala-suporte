/**
 * Constantes do sistema: nomes de abas, cabeçalhos e tipos.
 * Tudo que é "regra" (limites, e-mails, IDs) NÃO fica aqui: fica na aba Config.
 */

// Abas de cadastro (já existem na planilha; o gestor edita direto)
var ABA_PESSOAS = 'Pessoas';
var ABA_SETORES = 'Setores';
var ABA_SETORES_EXTRAS = 'Setores extras';

// Abas criadas pelo setup()
var ABA_CONFIG = 'Config';
var ABA_LANCAMENTOS = 'Lancamentos';
var ABA_BLOQUEIOS = 'Bloqueios';
var ABA_FILA_HO = 'FilaHO';
var ABA_SALDO_FERIAS = 'SaldoFerias';
var ABA_TROCAS = 'Trocas';
var ABA_AVISOS_IGNORADOS = 'AvisosIgnorados';
var ABA_LOG_NOTIFICACOES = 'LogNotificacoes';
var ABA_MAPA_NOMES = 'MapaNomes';
var ABA_RELATORIO_IMPORTACAO = 'RelatorioImportacao';
var ABA_PREFERENCIAS = 'Preferencias';

// Abas do sistema, na ordem em que o setup() as cria
var ABAS_DO_SISTEMA = [
  ABA_CONFIG, ABA_LANCAMENTOS, ABA_BLOQUEIOS, ABA_FILA_HO,
  ABA_SALDO_FERIAS, ABA_TROCAS, ABA_AVISOS_IGNORADOS, ABA_LOG_NOTIFICACOES,
  ABA_MAPA_NOMES, ABA_PREFERENCIAS
];

// Cabeçalhos de cada aba criada pelo setup(). A ordem define as colunas.
var CABECALHOS = {};
CABECALHOS[ABA_CONFIG] = ['Chave', 'Valor', 'Descrição'];
CABECALHOS[ABA_LANCAMENTOS] = [
  'ID', 'Tipo', 'E-mail', 'Data início', 'Data fim', 'Turno', 'Status',
  'Criado por', 'Criado em', 'Atualizado em', 'ID evento agenda', 'Observação', 'Em treinamento'
];
CABECALHOS[ABA_BLOQUEIOS] = ['ID', 'Tipo', 'Data início', 'Data fim', 'Descrição'];
CABECALHOS[ABA_FILA_HO] = ['E-mail', 'Setor', 'Tipo', 'Semana', 'Registrado em'];
CABECALHOS[ABA_SALDO_FERIAS] = ['E-mail', 'Saldo inicial', 'Prazo limite para gozo', 'Período aquisitivo'];
CABECALHOS[ABA_TROCAS] = [
  'ID', 'Proponente', 'Lançamento do proponente', 'Destinatário',
  'Lançamento do destinatário', 'Status', 'Criada em', 'Respondida em'
];
CABECALHOS[ABA_AVISOS_IGNORADOS] = ['Quando', 'E-mail', 'Lançamento', 'Código do aviso', 'Texto do aviso'];
CABECALHOS[ABA_LOG_NOTIFICACOES] = [
  'Quando', 'Tipo', 'Origem', 'Destinatários originais', 'Destinatário real', 'Assunto/título', 'Resultado'
];
// Nome como aparece na planilha antiga -> e-mail (ou "IGNORAR" para pular a pessoa)
CABECALHOS[ABA_MAPA_NOMES] = ['Nome na planilha antiga', 'E-mail', 'Observação'];
CABECALHOS[ABA_RELATORIO_IMPORTACAO] = ['Seção', 'Item', 'Detalhe'];
// Cada pessoa liga/desliga suas notificações no app; sem linha = Sim/Sim
CABECALHOS[ABA_PREFERENCIAS] = ['E-mail', 'Receber e-mails', 'Convites na agenda', 'Atualizado em',
  'Avisos sábados', 'Avisos meio-dia', 'Avisos plantão', 'Avisos home office', 'Avisos férias'];

// Cabeçalhos esperados nas abas de cadastro (só para validar no setup)
CABECALHOS[ABA_PESSOAS] = [
  'E-mail corporativo', 'Nome completo', 'Nome de exibição', 'Setor principal',
  'Perfil', 'Ativo', 'Data de entrada na equipe'
];
CABECALHOS[ABA_SETORES] = ['Setor', 'Ativo'];
CABECALHOS[ABA_SETORES_EXTRAS] = ['E-mail corporativo', 'Nome (automático)', 'Setor extra'];

// Tipos de lançamento
var TIPO = {
  SABADO: 'SABADO',
  MEIO_DIA: 'MEIO_DIA',
  PLANTAO: 'PLANTAO',
  HOME_OFFICE: 'HOME_OFFICE',
  FERIAS: 'FERIAS'
};

// Turnos. Com "h" para o Planilhas não converter em data ("8-11" viraria 11/ago).
// Sábado (escala): 8–11 e 9–12. Plantão: 18–20 em dia útil, 13–17 no sábado.
var TURNO = { T8_11: '8h-11h', T9_12: '9h-12h', T18_20: '18h-20h', T13_17: '13h-17h' };

// Status de lançamento
var STATUS = {
  ATIVO: 'ativo',
  CANCELADO: 'cancelado',
  // só férias
  RASCUNHO: 'rascunho',
  SOLICITADA: 'solicitada',
  APROVADA: 'aprovada',
  ENCAMINHADA: 'encaminhada',
  DEVOLVIDA: 'devolvida' // gestor devolveu para ajuste (motivo na observação)
};

// Tipos de bloqueio
var BLOQUEIO = {
  FERIADO: 'FERIADO',
  TREINAMENTO: 'TREINAMENTO',
  SEMANA_PRESENCIAL: 'SEMANA_PRESENCIAL',
  FERIAS_COLETIVAS: 'FERIAS_COLETIVAS'
};

// Perfis de usuário (coluna Perfil da aba Pessoas)
var PERFIL = { COLABORADOR: 'Colaborador', GESTOR: 'Gestor' };

// Valores booleanos na planilha
var SIM = 'Sim';
var NAO = 'Não';

// Chaves da aba Config, com valor padrão e descrição.
// setup() cria as que faltam sem sobrescrever as existentes.
var CONFIG_PADRAO = [
  ['MODO_TESTE', SIM, 'Sim = todo e-mail/convite vai só para o E-mail de teste e eventos vão para o calendário de teste'],
  ['EMAIL_TESTE', '', 'Para onde vão os e-mails enquanto Modo teste = Sim (preenchido pelo setup com o e-mail de quem rodou)'],
  ['ID_CALENDARIO_TESTE', '', 'ID do calendário usado no modo teste (vazio = agenda da conta que roda o sistema)'],
  ['ID_CALENDARIO_PRODUCAO', '', 'ID do calendário "Escala Suporte" (preencher na produção)'],
  ['DOMINIO', 'agro1.inf.br', 'Domínio dos e-mails corporativos'],
  ['SABADO_MIN', 6, 'Aviso se o sábado tiver menos pessoas que isso (somando os dois turnos)'],
  ['SABADO_MAX', 8, 'Aviso se o sábado tiver mais pessoas que isso'],
  ['VAGAS_MEIO_DIA', 2, 'Pessoas por dia no meio-dia; diferente disso gera aviso'],
  ['VAGAS_PLANTAO', 1, 'Pessoas por dia no plantão de segunda a sexta (18h–20h); diferente disso gera aviso'],
  ['VAGAS_PLANTAO_SABADO', 1, 'Pessoas no plantão de sábado (13h–17h); diferente disso gera aviso'],
  ['VAGAS_HOME_OFFICE', 1, 'Pessoas da equipe em home office por semana'],
  ['HO_FORA_DA_FILA', '', 'E-mails (separados por vírgula) de quem não entra na fila de home office, ex.: quem já trabalha em home office'],
  ['ANTECEDENCIA_FERIAS_DIAS', 35, 'Aviso se as férias forem pedidas com menos dias de antecedência que isso'],
  ['FERIAS_AVISO_PRAZO_DIAS', 60, 'Aviso quando o prazo limite para gozo estiver a menos dias que isso'],
  ['FERIAS_SOBREPOSICAO_MIN_DIAS', 6, 'Sobreposição de férias só vira aviso/pendência quando duas pessoas coincidem por pelo menos esta quantidade de dias'],
  ['FERIAS_REGRAS_CLT', NAO, 'Sim = avisa sobre fracionamento da CLT (um período de 14+ dias, demais de 5+, não começar 2 dias antes de feriado/folga). Ligar depois de confirmar com o RH'],
  // Importação da planilha antiga (só usada uma vez)
  ['ID_PLANILHA_ANTIGA', '', 'ID da planilha antiga convertida para Planilha Google (o trecho entre /d/ e /edit na URL)'],
  ['DATA_INICIO_IMPORTACAO', '2026-01-01', 'Só importa lançamentos a partir desta data'],
  ['SEMANA_MEIO_DIA_IMPORTACAO', '', 'Segunda-feira da semana em que a grade "Plantão Meio dia" vale (vazio = semana atual)'],
  ['TREINAMENTO_EQUIPE_MIN', 5, 'Importação: sábado com pelo menos esta quantidade de pessoas em treinamento é treinamento da equipe (fica bloqueado); com menos, são treinamentos individuais']
];
