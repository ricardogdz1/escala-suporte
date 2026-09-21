/**
 * Preferências de notificação de cada pessoa (aba Preferencias).
 * Quem não tem linha recebe tudo (Sim/Sim). Aplicado dentro de Notificacoes.gs.
 */

/** Mapa e-mail -> {emails: bool, agenda: bool}. */
function mapaPreferencias_() {
  var mapa = {};
  lerAba_(ABA_PREFERENCIAS).forEach(function (l) {
    var email = normalizarEmail_(l['E-mail']);
    if (!email) return;
    mapa[email] = {
      emails: ehSim_(l['Receber e-mails']),
      agenda: ehSim_(l['Convites na agenda']),
      _linha: l._linha
    };
  });
  return mapa;
}

function preferenciasDe_(mapa, email) {
  return mapa[normalizarEmail_(email)] || { emails: true, agenda: true };
}

/** Preferências de quem está logado (chamado pelo cliente). */
function obterMinhasPreferencias() {
  var u = exigirUsuario_();
  var p = preferenciasDe_(mapaPreferencias_(), u.email);
  return { emails: p.emails, agenda: p.agenda };
}

/** Salva as preferências de quem está logado. */
function salvarMinhasPreferencias(prefs) {
  var u = exigirUsuario_();
  var atual = mapaPreferencias_()[u.email];
  var campos = {
    'E-mail': u.email,
    'Receber e-mails': prefs.emails ? SIM : NAO,
    'Convites na agenda': prefs.agenda ? SIM : NAO,
    'Atualizado em': new Date()
  };
  if (atual) atualizarLinha_(ABA_PREFERENCIAS, atual._linha, campos);
  else anexarLinha_(ABA_PREFERENCIAS, campos);
  return { emails: !!prefs.emails, agenda: !!prefs.agenda };
}
