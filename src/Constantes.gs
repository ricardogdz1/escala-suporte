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

// Abas do sistema, na ordem em que o setup() as cria
var ABAS_DO_SISTEMA = [
  ABA_CONFIG, ABA_LANCAMENTOS, ABA_BLOQUEIOS, ABA_FILA_HO,
  ABA_SALDO_FERIAS, ABA_TROCAS, ABA_AVISOS_IGNORADOS, ABA_LOG_NOTIFICACOES
];

// Cabeçalhos de cada aba criada pelo setup(). A ordem define as colunas.
var CABECALHOS = {};
CABECALHOS[ABA_CONFIG] = ['Chave', 'Valor', 'Descrição'];
CABECALHOS[ABA_LANCAMENTOS] = [
  'ID', 'Tipo', 'E-mail', 'Data início', 'Data fim', 'Turno', 'Status',
  'Criado por', 'Criado em', 'Atualizado em', 'ID evento agenda', 'Observação'
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

// Turnos do sábado
var TURNO = { T8_11: '8-11', T9_12: '9-12' };

// Status de lançamento
var STATUS = {
  ATIVO: 'ativo',
  CANCELADO: 'cancelado',
  // só férias
  RASCUNHO: 'rascunho',
  SOLICITADA: 'solicitada',
  APROVADA: 'aprovada',
  ENCAMINHADA: 'encaminhada'
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
  ['VAGAS_PLANTAO', 1, 'Pessoas por dia no plantão; diferente disso gera aviso'],
  ['VAGAS_HOME_OFFICE', 1, 'Pessoas da equipe em home office por semana'],
  ['ANTECEDENCIA_FERIAS_DIAS', 35, 'Aviso se as férias forem pedidas com menos dias de antecedência que isso'],
  ['FERIAS_AVISO_PRAZO_DIAS', 60, 'Aviso quando o prazo limite para gozo estiver a menos dias que isso']
];
