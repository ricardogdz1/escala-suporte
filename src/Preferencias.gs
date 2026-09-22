/**
 * Configurações de cada pessoa (aba Preferencias):
 *  - notificações: receber e-mails e eventos na agenda (padrão: desligados);
 *  - avisos no Painel por módulo: sábados, meio-dia, plantão, home office, férias
 *    (padrão: ligados, menos plantão — épocas de plantão são ocasionais).
 * Quem não tem linha na aba usa os padrões. Aplicado em Notificacoes.gs (e-mail/agenda) e Painel.gs (avisos).
 */

var GRUPOS_AVISO = ['sabados', 'meiodia', 'plantao', 'homeoffice', 'ferias'];
var COLUNA_AVISO = { sabados: 'Avisos sábados', meiodia: 'Avisos meio-dia', plantao: 'Avisos plantão', homeoffice: 'Avisos home office', ferias: 'Avisos férias' };
var PREFERENCIAS_PADRAO = {
  emails: false,
  agenda: false,
  avisos: { sabados: true, meiodia: true, plantao: false, homeoffice: true, ferias: true }
};

function simOuPadrao_(valor, padrao) {
  var v = String(valor === undefined || valor === null ? '' : valor).trim();
  return v ? ehSim_(v) : padrao;
}

/** Mapa e-mail -> {emails, agenda, avisos: {grupo: bool}, _linha}. */
function mapaPreferencias_() {
  var mapa = {};
  lerAba_(ABA_PREFERENCIAS).forEach(function (l) {
    var email = normalizarEmail_(l['E-mail']);
    if (!email) return;
    var avisos = {};
    GRUPOS_AVISO.forEach(function (g) { avisos[g] = simOuPadrao_(l[COLUNA_AVISO[g]], PREFERENCIAS_PADRAO.avisos[g]); });
    mapa[email] = {
      emails: simOuPadrao_(l['Receber e-mails'], PREFERENCIAS_PADRAO.emails),
      agenda: simOuPadrao_(l['Convites na agenda'], PREFERENCIAS_PADRAO.agenda),
      avisos: avisos,
      _linha: l._linha
    };
  });
  return mapa;
}

function preferenciasDe_(mapa, email) {
  var p = mapa[normalizarEmail_(email)];
  if (p) return p;
  var avisos = {};
  GRUPOS_AVISO.forEach(function (g) { avisos[g] = PREFERENCIAS_PADRAO.avisos[g]; });
  return { emails: PREFERENCIAS_PADRAO.emails, agenda: PREFERENCIAS_PADRAO.agenda, avisos: avisos };
}

/** Configurações de quem está logado (chamado pelo cliente). */
function obterMinhasPreferencias() {
  var u = exigirUsuario_();
  var p = preferenciasDe_(mapaPreferencias_(), u.email);
  return { emails: p.emails, agenda: p.agenda, avisos: p.avisos, souGestor: u.gestor };
}

function camposPreferencias_(email, p) {
  var campos = {
    'E-mail': email,
    'Receber e-mails': p.emails ? SIM : NAO,
    'Convites na agenda': p.agenda ? SIM : NAO,
    'Atualizado em': new Date()
  };
  GRUPOS_AVISO.forEach(function (g) { campos[COLUNA_AVISO[g]] = p.avisos[g] ? SIM : NAO; });
  return campos;
}

function gravarPreferencias_(email, p, mapa) {
  var atual = mapa[email];
  var campos = camposPreferencias_(email, p);
  if (atual) atualizarLinha_(ABA_PREFERENCIAS, atual._linha, campos);
  else anexarLinha_(ABA_PREFERENCIAS, campos);
}

/** Salva as configurações de quem está logado. @param prefs {emails, agenda, avisos: {grupo: bool}} */
function salvarMinhasPreferencias(prefs) {
  var u = exigirUsuario_();
  prefs = prefs || {};
  var avisos = {};
  GRUPOS_AVISO.forEach(function (g) { avisos[g] = !!(prefs.avisos && prefs.avisos[g]); });
  var p = { emails: !!prefs.emails, agenda: !!prefs.agenda, avisos: avisos };
  gravarPreferencias_(u.email, p, mapaPreferencias_());
  return p;
}

/**
 * Gestor: liga ou desliga o aviso de plantão para todas as pessoas ativas de uma vez.
 * Cada pessoa continua podendo mudar o seu depois, nas próprias configurações.
 */
function definirAvisoPlantaoParaTodos(ligado) {
  exigirGestor_();
  var mapa = mapaPreferencias_();
  var pessoas = listarPessoasAtivas_();
  var agora = new Date();
  var novas = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    pessoas.forEach(function (pessoa) {
      var atual = mapa[pessoa.email];
      if (atual) {
        var campos = { 'Atualizado em': agora };
        campos[COLUNA_AVISO.plantao] = ligado ? SIM : NAO;
        atualizarLinha_(ABA_PREFERENCIAS, atual._linha, campos);
      } else {
        var p = preferenciasDe_(mapa, pessoa.email);
        p.avisos.plantao = !!ligado;
        novas.push(camposPreferencias_(pessoa.email, p));
      }
    });
    if (novas.length) {
      var aba = aba_(ABA_PREFERENCIAS);
      var cabecalho = cabecalhoDaAba_(aba);
      var linhas = novas.map(function (obj) { return cabecalho.map(function (c) { return obj[c] !== undefined ? obj[c] : ''; }); });
      aba.getRange(aba.getLastRow() + 1, 1, linhas.length, cabecalho.length).setValues(linhas);
      esquecerAba_(ABA_PREFERENCIAS);
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, pessoas: pessoas.length, ligado: !!ligado };
}
