/**
 * Espelho da planilha oficial da equipe.
 *
 * A cada rodada o sistema relê a planilha oficial (ver Sincronizacao.gs) e deixa os
 * lançamentos vindos dela iguais ao que está lá: o que apareceu entra, o que sumiu sai.
 * Três limites, que são o coração deste arquivo:
 *
 *  1. Só mexe em linha marcada "importado". O que a pessoa lançou dentro do app fica
 *     onde está, aconteça o que acontecer na planilha.
 *  2. Só mexe dentro da faixa de datas que cada grade cobre (ctx.faixas, montado na
 *     leitura). A aba HomeOffice começa em 03/08/2026; sem esse limite, o espelho
 *     apagaria os home offices de janeiro a julho, que existem aqui e não existem mais lá.
 *  3. Nada é notificado: a gravação é direta na planilha-banco, sem e-mail e sem agenda.
 *
 * E nunca, em nenhum caminho, escreve na planilha oficial.
 */

/** Linha que veio da planilha oficial (e portanto o espelho pode mexer). */
function ehDoEspelho_(x) {
  return String(x.observacao || '').indexOf(MARCA_IMPORTADO) >= 0;
}

/** O lançamento está no pedaço do calendário em que a planilha oficial manda? */
function noEspelho_(ctx, x) {
  if (x.tipo === TIPO.FERIAS) return !!ctx.pessoasFerias[x.email];
  var f = ctx.faixas[x.tipo];
  if (!f) return false;
  var t = x.inicio.getTime();
  return t >= f.de.getTime() && t <= f.ate.getTime();
}

/** União das faixas: usada para os bloqueios, que vêm de várias abas. */
function faixaTotal_(ctx) {
  var de = null, ate = null;
  Object.keys(ctx.faixas).forEach(function (k) {
    var f = ctx.faixas[k];
    if (!de || f.de.getTime() < de.getTime()) de = f.de;
    if (!ate || f.ate.getTime() > ate.getTime()) ate = f.ate;
  });
  return de ? { de: de, ate: ate } : null;
}

/**
 * Resumo do que foi lido, para decidir se vale gravar: rodada em que a impressão
 * não muda não escreve nada — que é o caso de quase toda rodada.
 */
function impressaoDigital_(ctx) {
  var l = ctx.lancamentos.map(function (x) {
    return chaveLancamento_(x.tipo, x.email, x.inicio, x.fim || x.inicio, x.turno) +
      '|' + (x.status || '') + '|' + (x.treinamento ? 1 : 0);
  }).sort();
  var s = ctx.saldos.map(function (x) {
    return x.email + ':' + x.saldoInicial + ':' + formatarDataIso_(x.limite);
  }).sort();
  var texto = l.join(';') + '#' + Object.keys(ctx.bloqueios).sort().join(';') + '#' + s.join(';');
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, texto));
}

/** Log técnico do espelho, mantendo as últimas 300 linhas. */
function registrarEspelho_(eventos) {
  if (!eventos || !eventos.length) return;
  var aba = aba_(ABA_LOG_ESPELHO);
  var agora = new Date();
  aba.getRange(aba.getLastRow() + 1, 1, eventos.length, 3)
    .setValues(eventos.map(function (e) { return [agora, e[0], e[1]]; }));
  var excesso = aba.getLastRow() - 301;
  if (excesso > 0) aba.deleteRows(2, excesso);
}

/** Saldos de férias que vieram da planilha e mudaram de valor lá. */
function atualizarSaldosDoEspelho_(ctx) {
  var atuais = {};
  lerAba_(ABA_SALDO_FERIAS).forEach(function (l) { atuais[normalizarEmail_(l['E-mail'])] = l; });
  var n = 0;
  ctx.saldos.forEach(function (s) {
    var atual = atuais[s.email];
    if (!atual || String(atual['Período aquisitivo'] || '').indexOf(MARCA_IMPORTADO) < 0) return;
    var mudouSaldo = Number(atual['Saldo inicial']) !== Number(s.saldoInicial);
    var mudouLimite = formatarDataIso_(paraData_(atual['Prazo limite para gozo'])) !== formatarDataIso_(s.limite);
    if (!mudouSaldo && !mudouLimite) return;
    atualizarLinha_(ABA_SALDO_FERIAS, atual._linha, {
      'Saldo inicial': s.saldoInicial,
      'Prazo limite para gozo': s.limite || ''
    });
    n++;
  });
  return n;
}

/** Tira o que sumiu da planilha. Devolve quanto foi apagado. */
function removerDoEspelho_(ctx, forcar) {
  var desejados = {};
  ctx.lancamentos.forEach(function (l) {
    desejados[chaveLancamento_(l.tipo, l.email, l.inicio, l.fim || l.inicio, l.turno)] = true;
  });

  var lancamentos = [];
  lerAba_(ABA_LANCAMENTOS).map(lancamentoDaLinha_).forEach(function (x) {
    if (!x.inicio || !ehDoEspelho_(x)) return;
    if (desejados[chaveLancamento_(x.tipo, x.email, x.inicio, x.fim, x.turno)]) return;
    if (!noEspelho_(ctx, x)) return;
    lancamentos.push(x);
  });

  var bloqueios = [];
  var faixa = faixaTotal_(ctx);
  if (faixa) {
    listarBloqueios_().forEach(function (b) {
      if (String(b.descricao || '').indexOf(MARCA_IMPORTADO) < 0) return;
      if (b.inicio.getTime() < faixa.de.getTime() || b.inicio.getTime() > faixa.ate.getTime()) return;
      var chave = b.tipo + '|' + formatarDataIso_(b.inicio) + '|' + formatarDataIso_(b.fim);
      if (!ctx.bloqueios[chave]) bloqueios.push(b);
    });
  }

  var total = lancamentos.length + bloqueios.length;
  var limite = obterConfigNumero('ESPELHO_MAX_REMOCOES') || 60;
  if (!forcar && total > limite) {
    // Uma leitura estranha (aba renomeada, coluna movida) apagaria meio sistema em silêncio.
    return { bloqueado: true, total: total, limite: limite, lancamentos: 0, bloqueios: 0 };
  }

  // De baixo para cima: apagar uma linha muda o número das que estão abaixo dela.
  lancamentos.sort(function (a, b) { return b._linha - a._linha; })
    .forEach(function (x) { apagarLinha_(ABA_LANCAMENTOS, x._linha); });
  bloqueios.sort(function (a, b) { return b._linha - a._linha; })
    .forEach(function (b) { apagarLinha_(ABA_BLOQUEIOS, b._linha); });

  return { bloqueado: false, lancamentos: lancamentos.length, bloqueios: bloqueios.length };
}

/**
 * Uma rodada do espelho.
 * @param {boolean} forcar  ignora a impressão digital e a trava de remoções.
 */
function espelhar_(forcar) {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(30000)) return ['Outra rodada do espelho está em andamento.'];
  try {
    var ctx = montarImportacao_();

    var naoMapeados = ctx.resolvedor.naoMapeados();
    if (naoMapeados.length) {
      var nomes = naoMapeados.map(function (n) { return n.nome; }).join(', ');
      registrarEspelho_([['Nome não reconhecido', nomes + ' - preencha MapaNomes (e-mail ou IGNORAR)']]);
      return ['Nome(s) fora do MapaNomes: ' + nomes, 'Nada foi gravado.'];
    }

    var impressao = impressaoDigital_(ctx);
    if (!forcar && impressao === String(obterConfig('ESPELHO_IMPRESSAO'))) {
      return ['Planilha oficial sem mudanças desde a última rodada.'];
    }

    var fora = removerDoEspelho_(ctx, forcar);
    if (fora.bloqueado) {
      var aviso = 'Rodada parada: apagaria ' + fora.total + ' registro(s), acima do limite de ' +
        fora.limite + '. Confira a planilha oficial e, se estiver certo, rode sincronizarForcado().';
      registrarEspelho_([['Trava de segurança', aviso]]);
      return [aviso];
    }

    var dentro = gravarImportacao_(ctx);
    var saldos = atualizarSaldosDoEspelho_(ctx);

    gravarConfig_('ESPELHO_IMPRESSAO', impressao);
    gravarConfig_('ESPELHO_ULTIMA_RODADA', formatarDataHoraBr_(new Date()));

    var resumo = [
      'Entraram: ' + dentro.lancamentos + ' lançamento(s), ' + dentro.bloqueios + ' bloqueio(s), ' +
        dentro.saldos + ' saldo(s) novo(s)',
      'Saíram: ' + fora.lancamentos + ' lançamento(s), ' + fora.bloqueios + ' bloqueio(s)',
      'Saldos atualizados: ' + saldos
    ];
    if (dentro.lancamentos + dentro.bloqueios + dentro.saldos + fora.lancamentos + fora.bloqueios + saldos) {
      registrarEspelho_([['Rodada', resumo.join(' · ')]]);
    }
    return resumo;
  } finally {
    trava.releaseLock();
  }
}

/** Alvo do gatilho: só roda com Config > ESPELHO_ATIVO = Sim e nunca derruba a execução. */
function sincronizarEspelho() {
  if (!ehSim_(obterConfig('ESPELHO_ATIVO'))) return;
  try {
    espelhar_(false);
  } catch (e) {
    registrarEspelho_([['Erro', String((e && e.message) || e)]]);
  }
}

/** Rodada manual, independente de ESPELHO_ATIVO. */
function sincronizarAgora() {
  Logger.log(espelhar_(false).join(String.fromCharCode(10)));
}

/** Rodada manual ignorando a impressão digital e a trava de remoções. */
function sincronizarForcado() {
  Logger.log(espelhar_(true).join(String.fromCharCode(10)));
}

function instalarEspelho() {
  removerEspelho();
  ScriptApp.newTrigger('sincronizarEspelho').timeBased().everyMinutes(15).create();
  gravarConfig_('ESPELHO_ATIVO', SIM);
  Logger.log('Espelho instalado: a planilha oficial será relida a cada 15 minutos. ' +
    'Para desligar sem remover o gatilho, ponha Config > ESPELHO_ATIVO = Não.');
}

function removerEspelho() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarEspelho') { ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log('Gatilhos do espelho removidos: ' + n);
}

/**
 * Prova que o espelho age: adultera um lançamento importado aqui na planilha-banco
 * (troca o turno de um sábado) e manda o espelho rodar. Ele deve apagar o adulterado
 * e trazer de volta o que está na planilha oficial. A planilha oficial não é tocada.
 */
function testarEspelho() {
  var linhas = [];
  var chaveDia = function (x) { return x.email + '|' + formatarDataIso_(x.inicio); };

  var importados = lerAba_(ABA_LANCAMENTOS).map(lancamentoDaLinha_).filter(function (x) {
    return x.tipo === TIPO.SABADO && ehDoEspelho_(x) && x.turno && x.inicio &&
      x.inicio.getTime() >= hoje_().getTime();
  });
  var vezes = {};
  importados.forEach(function (x) { vezes[chaveDia(x)] = (vezes[chaveDia(x)] || 0) + 1; });
  // Uma pessoa escalada nos dois turnos do mesmo sábado não serve: trocar o turno dela
  // cairia em cima do outro lançamento e o teste não provaria nada.
  var alvo = importados.filter(function (x) { return vezes[chaveDia(x)] === 1; })[0];
  if (!alvo) {
    Logger.log('Nenhum sábado importado com turno único daqui para a frente: não dá para testar assim.');
    return;
  }

  var trocado = alvo.turno === TURNO.T8_11 ? TURNO.T9_12 : TURNO.T8_11;
  linhas.push('Alvo: ' + alvo.email + ' no sábado ' + formatarDataBr_(alvo.inicio));
  linhas.push('Turno na planilha oficial: ' + alvo.turno + ' — vou gravar ' + trocado + ' aqui.');
  atualizarLinha_(ABA_LANCAMENTOS, alvo._linha, { 'Turno': trocado });

  // forçado: a planilha oficial não mudou, então a impressão digital é a mesma de antes.
  linhas.push('Espelho: ' + espelhar_(true).join(' | '));

  var depois = lerAba_(ABA_LANCAMENTOS).map(lancamentoDaLinha_).filter(function (x) {
    return x.tipo === TIPO.SABADO && chaveDia(x) === chaveDia(alvo);
  });
  linhas.push('Depois: ' + (depois.length ? depois.map(function (x) {
    return x.turno + ' (' + (ehDoEspelho_(x) ? 'importado' : 'do app') + ')';
  }).join(', ') : 'nenhum lançamento'));
  linhas.push(depois.length === 1 && depois[0].turno === alvo.turno
    ? 'OK: o espelho apagou o adulterado e trouxe de volta o da planilha.'
    : 'ATENÇÃO: não voltou ao esperado — me mande este log.');
  Logger.log(linhas.join(String.fromCharCode(10)));
}
