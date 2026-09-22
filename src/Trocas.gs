/**
 * Trocas entre colegas: A propõe trocar um lançamento seu (sábado, meio-dia ou plantão) por um de B
 * do mesmo tipo. B aceita ou recusa no app. Regras em docs/regras.md > Trocas.
 *
 * Avisos dos dois lados: A vê ao propor ("Enviar mesmo assim"), B vê ao aceitar ("Aceitar mesmo assim").
 * Ao aceitar, os dois lançamentos originais são cancelados e dois novos criados (cada um na data do outro),
 * a agenda é refeita e o gestor é avisado.
 */

var TROCA_STATUS = { PENDENTE: 'pendente', ACEITA: 'aceita', RECUSADA: 'recusada', CANCELADA: 'cancelada', EXPIRADA: 'expirada' };
var TIPOS_TROCAVEIS = [TIPO.SABADO, TIPO.MEIO_DIA, TIPO.PLANTAO];
var DIAS_CANDIDATOS_TROCA = 90;

function trocaDaLinha_(l) {
  return {
    id: String(l['ID'] || ''),
    proponente: normalizarEmail_(l['Proponente']),
    lancProponente: String(l['Lançamento do proponente'] || ''),
    destinatario: normalizarEmail_(l['Destinatário']),
    lancDestinatario: String(l['Lançamento do destinatário'] || ''),
    status: String(l['Status'] || '').trim().toLowerCase(),
    criadaEm: l['Criada em'] instanceof Date ? l['Criada em'] : null,
    respondidaEm: l['Respondida em'] instanceof Date ? l['Respondida em'] : null,
    _linha: l._linha
  };
}

function listarTrocas_() {
  return lerAba_(ABA_TROCAS).map(trocaDaLinha_).filter(function (t) { return t.id; });
}

/** Mapa id do lançamento -> troca pendente que o envolve (para marcar "⇄" nas telas). */
function mapaTrocasPendentes_() {
  var mapa = {};
  listarTrocas_().forEach(function (t) {
    if (t.status !== TROCA_STATUS.PENDENTE) return;
    mapa[t.lancProponente] = t;
    mapa[t.lancDestinatario] = t;
  });
  return mapa;
}

/** Texto curto de um lançamento: "Sábado 03/10 · 8h–11h", "Plantão sáb 26/09 · 13h–17h". */
function rotuloLancamento_(x) {
  var nomeTipo = { SABADO: 'Sábado', MEIO_DIA: 'Meio-dia', PLANTAO: 'Plantão' }[x.tipo] || x.tipo;
  var dia = x.tipo === TIPO.SABADO ? '' : DIAS_SEMANA_CURTO[x.inicio.getDay()].toLowerCase() + ' ';
  var turno = x.turno ? ' · ' + x.turno.replace('-', '–') : '';
  return nomeTipo + ' ' + dia + formatarDataBr_(x.inicio).substring(0, 5) + turno;
}

function lancamentoPorId_(id, tipos) {
  return listarLancamentos_({ tipos: tipos || TIPOS_TROCAVEIS }).filter(function (x) { return x.id === id; })[0];
}

/**
 * Lançamentos de colegas com os quais o meu pode ser trocado (mesmo tipo, futuros, sem troca pendente).
 * @param {string} idMeu id de um lançamento ativo meu
 */
function obterCandidatosTroca(idMeu) {
  var u = exigirUsuario_();
  var meu = lancamentoPorId_(idMeu);
  if (!meu || meu.status !== STATUS.ATIVO) throw new Error('Lançamento não encontrado ou já cancelado.');
  if (meu.email !== u.email) throw new Error('Você só pode propor troca dos seus próprios lançamentos.');
  if (TIPOS_TROCAVEIS.indexOf(meu.tipo) < 0) throw new Error('Esse tipo de lançamento não pode ser trocado.');

  var pendentes = mapaTrocasPendentes_();
  if (pendentes[meu.id]) throw new Error('Esse lançamento já tem uma troca pendente.');

  var hoje = hoje_();
  var pessoas = mapaPessoas_();
  var candidatos = listarLancamentos_({
    tipos: [meu.tipo], status: [STATUS.ATIVO], de: hoje, ate: adicionarDias_(hoje, DIAS_CANDIDATOS_TROCA)
  }).filter(function (x) {
    return x.email !== u.email && !x.treinamento && !pendentes[x.id] && pessoas[x.email] && pessoas[x.email].ativo;
  }).sort(function (a, b) { return a.inicio - b.inicio || nomeDe_(pessoas, a.email).localeCompare(nomeDe_(pessoas, b.email), 'pt-BR'); })
    .map(function (x) {
      return { id: x.id, email: x.email, nome: nomeDe_(pessoas, x.email), data: formatarDataIso_(x.inicio), rotulo: rotuloLancamento_(x) };
    });

  return { meu: { id: meu.id, tipo: meu.tipo, data: formatarDataIso_(meu.inicio), rotulo: rotuloLancamento_(meu) }, candidatos: candidatos };
}

/**
 * Avisos que a troca causaria: cada pessoa entrando na data da outra, com os dois lançamentos originais fora.
 * Reaproveita as validações de Sabados.gs e Semanal.gs.
 */
function avisosDaTroca_(a, b, u) {
  var pessoas = mapaPessoas_();
  var inicio = new Date(Math.min(a.inicio.getTime(), b.inicio.getTime()));
  var fim = new Date(Math.max(a.inicio.getTime(), b.inicio.getTime()));
  var avisos = [];

  if (a.tipo === TIPO.SABADO) {
    var c = contextoSabados_(inicio, fim);
    var sem = c.lancamentos.filter(function (x) { return x.id !== a.id && x.id !== b.id; });
    var eA = { data: b.inicio, turno: b.turno, email: a.email, treinamento: false };
    var eB = { data: a.inicio, turno: a.turno, email: b.email, treinamento: false };
    avisos = avisos.concat(avisosDeEscalar_(eA, sem, c, u, pessoas), avisosDeEscalar_(eB, sem, c, u, pessoas));
    // cobertura de setor em cada sábado, antes e depois da troca
    [[a, b], [b, a]].forEach(function (par) {
      var sai = par[0], entra = par[1];
      var antes = escaladosNoSabado_(c.lancamentos, sai.inicio);
      var depois = escaladosNoSabado_(sem, sai.inicio).concat([{ email: entra.email, treinamento: false }]);
      var descobertos = setoresSemCobertura_(depois, c).filter(function (s) { return setoresSemCobertura_(antes, c).indexOf(s) < 0; });
      if (descobertos.length) {
        avisos.push(aviso_('SABADO_SETOR_DESCOBERTO', 'Sábado ' + formatarDataBr_(sai.inicio).substring(0, 5) + ' fica sem ' + descobertos.join(', '),
          'Com ' + nomeDe_(pessoas, entra.email) + ' no lugar de ' + nomeDe_(pessoas, sai.email) + ', nenhuma pessoa cobre esse setor.'));
      }
    });
  } else {
    var r = regrasSemanal_(a.tipo);
    var cs = contextoSemanal_(a.tipo, inicio, fim);
    var semS = cs.lancamentos.filter(function (x) { return x.id !== a.id && x.id !== b.id; });
    avisos = avisos.concat(
      avisosDeEscalarSemanal_({ data: b.inicio, email: a.email }, semS, r, cs, u, pessoas),
      avisosDeEscalarSemanal_({ data: a.inicio, email: b.email }, semS, r, cs, u, pessoas));
  }
  return avisos;
}

/** Responde assim que a planilha é gravada; agenda e e-mails saem pela fila (Fila.gs). */
function proporTroca(dados, confirmado) {
  try {
    return proporTrocaImpl_(dados, confirmado);
  } finally {
    despacharFila_();
  }
}

/**
 * Propõe uma troca.
 * @param {Object} dados {meu: id do meu lançamento, dele: id do lançamento do colega}
 * @param {boolean} confirmado true quando clicou em "Enviar mesmo assim"
 */
function proporTrocaImpl_(dados, confirmado) {
  var u = exigirUsuario_();
  dados = dados || {};
  var meu = lancamentoPorId_(String(dados.meu || ''));
  var dele = lancamentoPorId_(String(dados.dele || ''));
  if (!meu || !dele || meu.status !== STATUS.ATIVO || dele.status !== STATUS.ATIVO) throw new Error('Um dos lançamentos não existe mais.');
  if (meu.email !== u.email) throw new Error('Você só pode propor troca dos seus próprios lançamentos.');
  if (dele.email === u.email) throw new Error('Escolha um lançamento de outra pessoa.');
  if (meu.tipo !== dele.tipo) throw new Error('A troca precisa ser entre lançamentos do mesmo tipo.');
  if (TIPOS_TROCAVEIS.indexOf(meu.tipo) < 0) throw new Error('Esse tipo de lançamento não pode ser trocado.');
  var pendentes = mapaTrocasPendentes_();
  if (pendentes[meu.id] || pendentes[dele.id]) throw new Error('Já existe uma troca pendente envolvendo um desses lançamentos.');

  var avisos = avisosDaTroca_(meu, dele, u);
  if (avisos.length && !confirmado) return respostaComAvisos_(avisos);

  var pessoas = mapaPessoas_();
  var id = gerarId_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    anexarLinha_(ABA_TROCAS, {
      'ID': id, 'Proponente': u.email, 'Lançamento do proponente': meu.id,
      'Destinatário': dele.email, 'Lançamento do destinatário': dele.id,
      'Status': TROCA_STATUS.PENDENTE, 'Criada em': new Date(), 'Respondida em': ''
    });
  } finally {
    lock.releaseLock();
  }
  registrarAvisosIgnorados_(u, meu.id, avisos);

  var destinatario = pessoas[dele.email];
  enfileirarEmail_({
    para: dele.email,
    assunto: u.nomeExibicao + ' propôs uma troca: ' + rotuloLancamento_(dele) + ' ⇄ ' + rotuloLancamento_(meu),
    corpoHtml: '<p>Olá, ' + escaparHtml_(destinatario.nomeExibicao) + '.</p>' +
      '<p><strong>' + escaparHtml_(u.nomeExibicao) + '</strong> propõe trocar:</p>' +
      '<ul><li>o seu <strong>' + escaparHtml_(rotuloLancamento_(dele)) + '</strong></li>' +
      '<li>pelo <strong>' + escaparHtml_(rotuloLancamento_(meu)) + '</strong> de ' + escaparHtml_(u.nomeExibicao) + '</li></ul>' +
      '<p>Você aceita ou recusa no Painel do app. Ao aceitar, a escala e a agenda são atualizadas e o gestor é avisado.</p>' +
      '<p><a href="' + urlDoApp_() + '?tela=painel">Abrir o Painel</a></p>',
    origem: 'proporTroca'
  });
  return { ok: true, id: id, avisosIgnorados: avisos.length };
}

/** Trocas que envolvem a pessoa: recebidas pendentes e enviadas (pendentes ou respondidas nos últimos 30 dias). */
function listarMinhasTrocas_(u) {
  var pessoas = mapaPessoas_();
  var lancs = {};
  listarLancamentos_({ tipos: TIPOS_TROCAVEIS }).forEach(function (x) { lancs[x.id] = x; });
  var limite = adicionarDias_(hoje_(), -30);
  var recebidas = [], enviadas = [];

  listarTrocas_().forEach(function (t) {
    var minhaRecebida = t.destinatario === u.email;
    var minhaEnviada = t.proponente === u.email;
    if (!minhaRecebida && !minhaEnviada) return;
    if (t.status !== TROCA_STATUS.PENDENTE && (!t.respondidaEm || t.respondidaEm.getTime() < limite.getTime())) return;
    if (minhaRecebida && t.status !== TROCA_STATUS.PENDENTE) return;

    var lp = lancs[t.lancProponente], ld = lancs[t.lancDestinatario];
    var item = {
      id: t.id,
      status: t.status,
      proponente: nomeDe_(pessoas, t.proponente),
      destinatario: nomeDe_(pessoas, t.destinatario),
      lancProponente: lp ? rotuloLancamento_(lp) : '(lançamento removido)',
      lancDestinatario: ld ? rotuloLancamento_(ld) : '(lançamento removido)',
      tela: lp ? { SABADO: 'sabados', MEIO_DIA: 'meiodia', PLANTAO: 'plantao' }[lp.tipo] : 'painel',
      criadaEm: t.criadaEm ? formatarDataHoraBr_(t.criadaEm) : '',
      respondidaEm: t.respondidaEm ? formatarDataHoraBr_(t.respondidaEm) : ''
    };
    (minhaRecebida ? recebidas : enviadas).push(item);
  });
  var porData = function (a, b) { return (b.criadaEm || '').localeCompare(a.criadaEm || ''); };
  return { recebidas: recebidas.sort(porData), enviadas: enviadas.sort(porData) };
}

/** Responde assim que a planilha é gravada; agenda e e-mails saem pela fila (Fila.gs). */
function responderTroca(dados, confirmado) {
  try {
    return responderTrocaImpl_(dados, confirmado);
  } finally {
    despacharFila_();
  }
}

/**
 * Responde a uma troca recebida.
 * @param {Object} dados {id, aceitar: boolean}
 * @param {boolean} confirmado true quando clicou em "Aceitar mesmo assim"
 */
function responderTrocaImpl_(dados, confirmado) {
  var u = exigirUsuario_();
  dados = dados || {};
  var t = listarTrocas_().filter(function (x) { return x.id === String(dados.id || ''); })[0];
  if (!t) throw new Error('Troca não encontrada.');
  if (t.destinatario !== u.email) throw new Error('Só quem recebeu a proposta pode responder.');
  if (t.status !== TROCA_STATUS.PENDENTE) throw new Error('Essa troca já foi ' + t.status + '.');

  var pessoas = mapaPessoas_();
  var proponente = pessoas[t.proponente];
  var agora = new Date();

  if (!dados.aceitar) {
    atualizarLinha_(ABA_TROCAS, t._linha, { 'Status': TROCA_STATUS.RECUSADA, 'Respondida em': agora });
    enfileirarEmail_({
      para: t.proponente,
      assunto: u.nomeExibicao + ' recusou a troca',
      corpoHtml: '<p>Olá, ' + escaparHtml_(proponente.nomeExibicao) + '.</p><p>' + escaparHtml_(u.nomeExibicao) + ' recusou a troca proposta. Sua escala continua como estava.</p>' +
        '<p><a href="' + urlDoApp_() + '?tela=painel">Abrir o Painel</a></p>',
      origem: 'responderTroca'
    });
    return { ok: true, status: TROCA_STATUS.RECUSADA };
  }

  var lp = lancamentoPorId_(t.lancProponente), ld = lancamentoPorId_(t.lancDestinatario);
  if (!lp || !ld || lp.status !== STATUS.ATIVO || ld.status !== STATUS.ATIVO || lp.email !== t.proponente || ld.email !== u.email) {
    atualizarLinha_(ABA_TROCAS, t._linha, { 'Status': TROCA_STATUS.EXPIRADA, 'Respondida em': agora });
    throw new Error('Um dos lançamentos mudou desde a proposta; a troca expirou.');
  }

  var avisos = avisosDaTroca_(lp, ld, u);
  if (avisos.length && !confirmado) return respostaComAvisos_(avisos);

  var novos = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    atualizarLancamento_(lp.id, { 'Status': STATUS.CANCELADO, 'Observação': (lp.observacao ? lp.observacao + ' · ' : '') + 'trocado com ' + u.nomeExibicao });
    atualizarLancamento_(ld.id, { 'Status': STATUS.CANCELADO, 'Observação': (ld.observacao ? ld.observacao + ' · ' : '') + 'trocado com ' + proponente.nomeExibicao });
    // cada um assume a data (e o turno) do outro
    novos.push(criarLancamento_({ tipo: lp.tipo, email: lp.email, inicio: ld.inicio, turno: ld.turno, observacao: 'troca com ' + u.nomeExibicao + ' (' + formatarDataBr_(lp.inicio).substring(0, 5) + ')' }, u));
    novos.push(criarLancamento_({ tipo: ld.tipo, email: ld.email, inicio: lp.inicio, turno: lp.turno, observacao: 'troca com ' + proponente.nomeExibicao + ' (' + formatarDataBr_(ld.inicio).substring(0, 5) + ')' }, u));
    atualizarLinha_(ABA_TROCAS, t._linha, { 'Status': TROCA_STATUS.ACEITA, 'Respondida em': agora });
  } finally {
    lock.releaseLock();
  }
  registrarAvisosIgnorados_(u, novos[1].id, avisos);

  // agenda: remove os eventos antigos e cria os novos
  [lp, ld].forEach(function (x) { enfileirarRemocaoDeEvento_(x.idEvento, 'responderTroca'); });
  novos.forEach(function (lanc) {
    var idEvento = lanc.tipo === TIPO.SABADO
      ? criarEventoSabado_(lanc, pessoas[lanc.email])
      : criarEventoSemanal_(lanc, pessoas[lanc.email], regrasSemanal_(lanc.tipo));
    if (idEvento) atualizarLancamento_(lanc.id, { 'ID evento agenda': idEvento });
  });

  var resumo = '<ul><li><strong>' + escaparHtml_(proponente.nomeExibicao) + '</strong> passa a ter ' + escaparHtml_(rotuloLancamento_(novos[0])) + '</li>' +
    '<li><strong>' + escaparHtml_(u.nomeExibicao) + '</strong> passa a ter ' + escaparHtml_(rotuloLancamento_(novos[1])) + '</li></ul>';
  enfileirarEmail_({
    para: t.proponente,
    assunto: u.nomeExibicao + ' aceitou a troca',
    corpoHtml: '<p>Olá, ' + escaparHtml_(proponente.nomeExibicao) + '.</p><p>' + escaparHtml_(u.nomeExibicao) + ' aceitou a troca. Escala e agenda já foram atualizadas:</p>' + resumo +
      '<p><a href="' + urlDoApp_() + '?tela=painel">Abrir o Painel</a></p>',
    origem: 'responderTroca'
  });
  var gestores = emailsGestores_().filter(function (e) { return e !== t.proponente && e !== u.email; });
  if (gestores.length) {
    enfileirarEmail_({
      para: gestores,
      assunto: 'Troca aceita: ' + proponente.nomeExibicao + ' ⇄ ' + u.nomeExibicao,
      corpoHtml: '<p>Uma troca foi aceita no Escala Suporte:</p>' + resumo +
        (avisos.length ? '<p>Avisos aceitos ao confirmar: ' + escaparHtml_(avisos.map(function (a) { return a.titulo; }).join('; ')) + '.</p>' : '') +
        '<p><a href="' + urlDoApp_() + '?tela=painel">Abrir o Painel</a></p>',
      origem: 'responderTroca'
    });
  }
  return { ok: true, status: TROCA_STATUS.ACEITA, avisosIgnorados: avisos.length };
}

/** Responde assim que a planilha é gravada; agenda e e-mails saem pela fila (Fila.gs). */
function cancelarTroca(id) {
  try {
    return cancelarTrocaImpl_(id);
  } finally {
    despacharFila_();
  }
}

/** Quem propôs cancela a proposta enquanto ela está pendente. */
function cancelarTrocaImpl_(id) {
  var u = exigirUsuario_();
  var t = listarTrocas_().filter(function (x) { return x.id === String(id || ''); })[0];
  if (!t) throw new Error('Troca não encontrada.');
  if (t.proponente !== u.email) throw new Error('Só quem propôs pode cancelar.');
  if (t.status !== TROCA_STATUS.PENDENTE) throw new Error('Essa troca já foi ' + t.status + '.');
  atualizarLinha_(ABA_TROCAS, t._linha, { 'Status': TROCA_STATUS.CANCELADA, 'Respondida em': new Date() });
  var pessoas = mapaPessoas_();
  enfileirarEmail_({
    para: t.destinatario,
    assunto: u.nomeExibicao + ' cancelou a proposta de troca',
    corpoHtml: '<p>Olá, ' + escaparHtml_(nomeDe_(pessoas, t.destinatario)) + '.</p><p>' + escaparHtml_(u.nomeExibicao) + ' cancelou a proposta de troca. Nada muda na sua escala.</p>',
    origem: 'cancelarTroca'
  });
  return { ok: true };
}
