/**
 * Meio-dia e Plantão: escalas diárias organizadas por semana.
 * Regras em docs/regras.md > Meio-dia e > Plantão. Tudo gera aviso, nada bloqueia.
 *
 * Meio-dia: segunda a sexta, VAGAS_MEIO_DIA pessoas por dia, fica até 12:30 e sai 17:30.
 * Plantão:  segunda a sexta 18h–20h (VAGAS_PLANTAO) e sábado 13h–17h (VAGAS_PLANTAO_SABADO). Sem feriados.
 *
 * O cliente monta uma lista de mudanças (escalar X, tirar Y) e salva tudo de uma vez com
 * salvarSemanal(): uma ida ao servidor, uma confirmação de avisos (mesmo padrão de Sabados.gs).
 */

var SEMANAS_POR_BLOCO = 9;

/** Regras de cada tipo semanal. */
var REGRAS_SEMANAL = {};
REGRAS_SEMANAL[TIPO.MEIO_DIA] = {
  nome: 'Meio-dia',
  aplica: function (data, feriado) { return ehDiaUtil_(data) && !feriado; },
  vagas: function (data, c) { return c.vagasMeioDia; },
  turno: function () { return ''; },
  horario: function () { return { inicio: [12, 30], fim: [14, 0], rotulo: 'até 12:30' }; },
  tela: 'meiodia',
  grupo: 'meiodia',
  soSemanaAtual: true, // pendências (vagas abertas) só na semana atual
  tituloEvento: function (pessoa) { return 'Meio-dia – ' + pessoa.nomeExibicao; },
  descricaoEvento: 'Fica até 12:30 e sai às 17:30. Intervalo de referência 12:30–14:00. Lançado pelo Escala Suporte.'
};
REGRAS_SEMANAL[TIPO.PLANTAO] = {
  nome: 'Plantão',
  aplica: function (data, feriado) { return (ehDiaUtil_(data) || ehSabado_(data)) && !feriado; },
  vagas: function (data, c) { return ehSabado_(data) ? c.vagasPlantaoSabado : c.vagasPlantao; },
  turno: function (data) { return ehSabado_(data) ? TURNO.T13_17 : TURNO.T18_20; },
  horario: function (data) {
    return ehSabado_(data)
      ? { inicio: [13, 0], fim: [17, 0], rotulo: '13h–17h' }
      : { inicio: [18, 0], fim: [20, 0], rotulo: 'até 20h' };
  },
  tela: 'plantao',
  grupo: 'plantao',
  tituloEvento: function (pessoa, data) { return 'Plantão ' + (ehSabado_(data) ? '13h–17h' : '18h–20h') + ' – ' + pessoa.nomeExibicao; },
  descricaoEvento: 'Plantão do suporte. Lançado pelo Escala Suporte.'
};

function regrasSemanal_(tipo) {
  var r = REGRAS_SEMANAL[tipo];
  if (!r) throw new Error('Tipo inválido: ' + tipo);
  return r;
}

/**
 * Nove semanas a partir de uma segunda-feira, com quem está em cada dia.
 * @param {string} tipo TIPO.MEIO_DIA | TIPO.PLANTAO
 * @param {string} segundaIso "yyyy-MM-dd" (qualquer dia da semana; vazio = semana atual)
 */
function obterSemanas(tipo, segundaIso) {
  var u = exigirUsuario_();
  var r = regrasSemanal_(tipo);
  var hoje = hoje_();
  var inicio = inicioDaSemana_(paraData_(segundaIso) || hoje);
  var fim = adicionarDias_(inicio, SEMANAS_POR_BLOCO * 7 - 1);

  // contexto cobre uma semana antes, para "copiar semana anterior" do primeiro cartão
  var c = contextoSemanal_(tipo, adicionarDias_(inicio, -7), fim);
  c.trocasPendentes = mapaTrocasPendentes_();

  var semanas = [];
  for (var n = 0; n < SEMANAS_POR_BLOCO; n++) {
    var seg = adicionarDias_(inicio, 7 * n);
    var sab = adicionarDias_(seg, 5);
    var dias = [];
    for (var d = 0; d < 6; d++) {
      var data = adicionarDias_(seg, d);
      var dia = montarDiaSemanal_(data, r, c, u);
      if (dia) dias.push(dia);
    }
    semanas.push({
      inicio: formatarDataIso_(seg),
      titulo: tituloSemana_(seg, sab),
      atual: seg.getTime() === inicioDaSemana_(hoje).getTime(),
      passada: sab.getTime() < hoje.getTime(),
      dias: dias
    });
  }

  return {
    tipo: tipo,
    inicio: formatarDataIso_(inicio),
    anterior: formatarDataIso_(adicionarDias_(inicio, -7 * SEMANAS_POR_BLOCO)),
    proximo: formatarDataIso_(adicionarDias_(inicio, 7 * SEMANAS_POR_BLOCO)),
    semanaAtual: formatarDataIso_(inicioDaSemana_(hoje)),
    semanas: semanas,
    resumoMes: resumoMesSemanal_(tipo, u, c),
    souGestor: u.gestor,
    pessoas: u.gestor ? listarPessoasAtivas_().map(function (p) { return { email: p.email, nome: p.nomeExibicao }; }) : []
  };
}

function tituloSemana_(seg, sab) {
  if (seg.getMonth() === sab.getMonth()) {
    return 'Semana de ' + seg.getDate() + ' a ' + sab.getDate() + ' de ' + MESES[sab.getMonth()].toLowerCase();
  }
  return 'Semana de ' + seg.getDate() + '/' + MESES[seg.getMonth()].toLowerCase().substring(0, 3) +
    ' a ' + sab.getDate() + '/' + MESES[sab.getMonth()].toLowerCase().substring(0, 3);
}

function contextoSemanal_(tipo, inicio, fim) {
  return {
    tipo: tipo,
    pessoas: mapaPessoas_(),
    lancamentos: listarLancamentosValendo_(inicio, fim),
    bloqueios: listarBloqueios_(inicio, fim),
    hoje: hoje_(),
    vagasMeioDia: obterConfigNumero('VAGAS_MEIO_DIA'),
    vagasPlantao: obterConfigNumero('VAGAS_PLANTAO'),
    vagasPlantaoSabado: obterConfigNumero('VAGAS_PLANTAO_SABADO')
  };
}

function escaladosNoDia_(lancamentos, tipo, data) {
  return lancamentos.filter(function (x) { return x.tipo === tipo && mesmoDia_(x.inicio, data); });
}

/** Um dia da semana (null se o tipo não se aplica nesse dia da semana, ex.: sábado no meio-dia). */
function montarDiaSemanal_(data, r, c, u) {
  var bloqueios = bloqueiosDoDia_(c.bloqueios, data);
  var feriado = bloqueios.some(ehTipoFeriado_);
  var seAplicaNoDiaDaSemana = r.aplica(data, false);
  if (!seAplicaNoDiaDaSemana) return null;

  var aplica = r.aplica(data, feriado);
  var escalados = escaladosNoDia_(c.lancamentos, c.tipo, data);
  var pessoas = escalados.map(function (x) {
    return { id: x.id, email: x.email, nome: nomeDe_(c.pessoas, x.email), minha: x.email === u.email, trocaPendente: !!(c.trocasPendentes && c.trocasPendentes[x.id]) };
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

  var semanaPassada = escaladosNoDia_(c.lancamentos, c.tipo, adicionarDias_(data, -7)).map(function (x) {
    return { email: x.email, nome: nomeDe_(c.pessoas, x.email) };
  });

  var vagas = r.vagas(data, c);
  // meio-dia é organizado na segunda de cada semana: só a semana atual vira pendência
  var contaProblema = aplica && (!r.soSemanaAtual || inicioDaSemana_(data).getTime() === inicioDaSemana_(c.hoje).getTime());
  var p = contaProblema ? problemaDeVagas_(pessoas.length, vagas) : null;
  var h = r.horario(data);
  return {
    data: formatarDataIso_(data),
    rotulo: DIAS_SEMANA_CURTO[data.getDay()] + ' ' + ('0' + data.getDate()).slice(-2) + '/' + ('0' + (data.getMonth() + 1)).slice(-2),
    diaSemana: data.getDay(),
    hoje: mesmoDia_(data, c.hoje),
    passado: data.getTime() < c.hoje.getTime(),
    feriado: feriado,
    bloqueios: bloqueios.map(tituloBloqueio_),
    // para o gestor editar o feriado no próprio dia (vazio = não é feriado)
    feriadoTipo: (bloqueios.filter(ehTipoFeriado_)[0] || {}).tipo || '',
    feriadoDescricao: (function () {
      var f = bloqueios.filter(ehTipoFeriado_)[0];
      return f ? String(f.descricao || '').replace(/\s*\(importado\)\s*$/i, '').trim() : '';
    })(),
    feriadoVariosDias: bloqueios.filter(ehTipoFeriado_).some(function (b) { return !mesmoDia_(b.inicio, b.fim); }),
    aplica: aplica,
    horario: h.rotulo,
    vagas: vagas,
    pessoas: pessoas,
    semanaPassada: semanaPassada,
    problema: p ? p.curto : '',
    minha: pessoas.some(function (x) { return x.minha; })
  };
}

/** Totais do mês atual: os meus e por pessoa (relatório "Plantões em setembro"). */
function resumoMesSemanal_(tipo, u, c) {
  var hoje = c.hoje;
  var inicio = inicioDoMes_(hoje), fim = fimDoMes_(hoje);
  var doMes = listarLancamentos_({ tipos: [tipo], status: [STATUS.ATIVO], de: inicio, ate: fim });
  var porPessoa = {};
  doMes.forEach(function (x) { porPessoa[x.email] = (porPessoa[x.email] || 0) + 1; });
  var lista = Object.keys(porPessoa).map(function (email) {
    return { email: email, nome: nomeDe_(c.pessoas, email), total: porPessoa[email], minha: email === u.email };
  }).sort(function (a, b) { return b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'); });
  var r = regrasSemanal_(tipo);
  var diasPossiveis = diasEntre_(inicio, fim).filter(function (d) { return r.aplica(d, false); }).length;
  return {
    mes: MESES[hoje.getMonth()].toLowerCase(),
    meus: porPessoa[u.email] || 0,
    diasPossiveis: diasPossiveis, // dias do mês em que o tipo acontece (meio-dia: seg–sex; plantão: seg–sáb)
    porPessoa: lista
  };
}

/** Responde assim que a planilha é gravada; agenda e e-mails saem pela fila (Fila.gs). */
function salvarSemanal(tipo, dados, confirmado) {
  try {
    return salvarSemanalImpl_(tipo, dados, confirmado);
  } finally {
    despacharFila_();
  }
}

/**
 * Salva um lote de mudanças no meio-dia ou no plantão.
 * @param {string} tipo TIPO.MEIO_DIA | TIPO.PLANTAO
 * @param {Object} dados {escalar: [{data: "yyyy-MM-dd", email?: string}], cancelar: [id]}
 *   email só para gestor (escalar outra pessoa). Cancelar a escala de outra pessoa também exige gestor.
 * @param {boolean} confirmado true quando o usuário clicou em "Salvar mesmo assim"
 *
 * Avisos de ESCALAR pedem confirmação (regra 1). Avisos de TIRAR não pedem (mesma decisão dos sábados),
 * mas continuam registrados em AvisosIgnorados.
 */
function salvarSemanalImpl_(tipo, dados, confirmado) {
  var u = exigirUsuario_();
  var r = regrasSemanal_(tipo);
  dados = dados || {};

  var escalar = (dados.escalar || []).map(function (e) {
    var data = paraData_(e.data);
    if (!data) throw new Error('Data inválida: ' + e.data);
    if (!r.aplica(data, false)) throw new Error(r.nome + ' não acontece em ' + DIAS_SEMANA[data.getDay()].toLowerCase() + ' (' + formatarDataBr_(data) + ').');
    var email = e.email ? normalizarEmail_(e.email) : u.email;
    if (email !== u.email && !u.gestor) throw new Error('Só o gestor pode escalar outra pessoa.');
    return { data: data, email: email };
  });
  var idsCancelar = (dados.cancelar || []).map(String);
  if (!escalar.length && !idsCancelar.length) throw new Error('Nada para salvar.');

  var pessoas = mapaPessoas_();
  escalar.forEach(function (e) {
    var p = pessoas[e.email];
    if (!p || !p.ativo) throw new Error('Pessoa não encontrada no cadastro: ' + e.email);
  });

  var cancelar = [];
  if (idsCancelar.length) {
    var todos = listarLancamentos_({ tipos: [tipo] });
    idsCancelar.forEach(function (id) {
      var lanc = todos.filter(function (x) { return x.id === id; })[0];
      if (!lanc) throw new Error('Escala não encontrada (' + id + ').');
      if (lanc.status !== STATUS.ATIVO) return; // já cancelada por outra pessoa: ignora
      if (lanc.email !== u.email && !u.gestor) throw new Error('Só o gestor pode tirar outra pessoa da escala.');
      cancelar.push(lanc);
    });
  }

  var datas = escalar.map(function (e) { return e.data; }).concat(cancelar.map(function (l) { return l.inicio; }));
  var inicio = new Date(Math.min.apply(null, datas.map(function (d) { return d.getTime(); })));
  var fim = new Date(Math.max.apply(null, datas.map(function (d) { return d.getTime(); })));
  var c = contextoSemanal_(tipo, inicio, fim);

  var idsSaindo = {};
  cancelar.forEach(function (l) { idsSaindo[l.id] = true; });
  var simulados = c.lancamentos.filter(function (x) { return !idsSaindo[x.id]; });

  var avisosEscalar = [], avisosCancelar = [];
  cancelar.forEach(function (l) { avisosCancelar.push.apply(avisosCancelar, avisosDeTirarSemanal_(l, simulados, r, c, u)); });
  escalar.forEach(function (e) {
    if (escaladosNoDia_(simulados, tipo, e.data).some(function (x) { return x.email === e.email; })) {
      throw new Error((e.email === u.email ? 'Você' : pessoas[e.email].nomeExibicao) + ' já está no ' + r.nome.toLowerCase() + ' de ' + formatarDataBr_(e.data) + '.');
    }
    avisosEscalar.push.apply(avisosEscalar, avisosDeEscalarSemanal_(e, simulados, r, c, u, pessoas));
    simulados.push({ id: '', tipo: tipo, email: e.email, inicio: e.data, fim: e.data, turno: r.turno(e.data), status: STATUS.ATIVO });
  });

  if (avisosEscalar.length && !confirmado) return respostaComAvisos_(avisosEscalar);

  var criados = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    cancelar.forEach(function (l) { atualizarLancamento_(l.id, { 'Status': STATUS.CANCELADO }); });
    escalar.forEach(function (e) {
      criados.push(criarLancamento_({ tipo: tipo, email: e.email, inicio: e.data, turno: r.turno(e.data) }, u));
    });
  } finally {
    lock.releaseLock();
  }

  registrarAvisosIgnorados_(u, criados.length ? criados[0].id : '', avisosEscalar);
  registrarAvisosIgnorados_(u, cancelar.length ? cancelar[0].id : '', avisosCancelar);

  // agenda e e-mails pela fila (Fila.gs)
  cancelar.forEach(function (l) { enfileirarRemocaoDeEvento_(l.idEvento, 'salvarSemanal'); });
  criados.forEach(function (lanc) { enfileirarEventoSemanal_(lanc, pessoas[lanc.email], r); });

  // E-mail para quem o gestor escalou (um por pessoa, com todas as datas)
  var porPessoa = {};
  criados.forEach(function (lanc) {
    if (lanc.email === u.email) return;
    (porPessoa[lanc.email] = porPessoa[lanc.email] || []).push(lanc);
  });
  Object.keys(porPessoa).forEach(function (email) {
    var p = pessoas[email];
    var lancs = porPessoa[email];
    var itens = lancs.map(function (lanc) {
      return '<li><strong>' + formatarDataBr_(lanc.inicio) + '</strong> (' + DIAS_SEMANA[lanc.inicio.getDay()].toLowerCase() + '), ' + r.horario(lanc.inicio).rotulo + '</li>';
    }).join('');
    enfileirarEmail_({
      para: email,
      assunto: 'Você foi escalado(a) para o ' + r.nome.toLowerCase() + (lancs.length > 1 ? ' (' + lancs.length + ' dias)' : ' de ' + formatarDataBr_(lancs[0].inicio)),
      corpoHtml: '<p>Olá, ' + escaparHtml_(p.nomeExibicao) + '.</p>' +
        '<p>' + escaparHtml_(u.nomeExibicao) + ' escalou você para o ' + r.nome.toLowerCase() + ':</p><ul>' + itens + '</ul>' +
        '<p><a href="' + urlDoApp_() + '?tela=' + r.tela + '">Abrir a escala</a></p>',
      origem: 'salvarSemanal'
    });
  });
  return comDadosAtualizados_(
    { ok: true, escalados: criados.length, cancelados: cancelar.length, avisosIgnorados: avisosEscalar.length + avisosCancelar.length },
    dados.janelas, function (j) { return obterSemanas(tipo, j); });
}

function avisosDeEscalarSemanal_(e, simulados, r, c, u, pessoas) {
  var avisos = [];
  var dataBr = formatarDataBr_(e.data).substring(0, 5);
  var nomeAlvo = e.email === u.email ? 'Você' : pessoas[e.email].nomeExibicao;
  var bloqueios = bloqueiosDoDia_(c.bloqueios, e.data);
  var feriado = bloqueios.some(ehTipoFeriado_);
  var treinamento = bloqueios.filter(function (b) { return b.tipo === BLOQUEIO.TREINAMENTO; });

  if (feriado) {
    avisos.push(aviso_(c.tipo + '_FERIADO', dataBr + ' é feriado', 'Normalmente não há ' + r.nome.toLowerCase() + ' em feriado.'));
  }
  if (treinamento.length) {
    avisos.push(aviso_(c.tipo + '_TREINAMENTO', dataBr + ' tem treinamento da equipe', treinamento.map(tituloBloqueio_).join('; ') + '. Escalas neste dia geram aviso.'));
  }
  if (e.data.getTime() < c.hoje.getTime()) {
    avisos.push(aviso_(c.tipo + '_PASSADO', dataBr + ' já passou', 'O lançamento vale como registro do que aconteceu.'));
  }
  if (estaDeFerias_(c.lancamentos, e.email, e.data)) {
    avisos.push(aviso_(c.tipo + '_FERIAS', nomeAlvo + ' está de férias em ' + dataBr, 'Há férias aprovadas cobrindo esse dia.'));
  }
  var vagas = r.vagas(e.data, c);
  var depois = escaladosNoDia_(simulados, c.tipo, e.data).length + 1;
  if (depois > vagas) {
    avisos.push(aviso_(c.tipo + '_ACIMA_VAGAS', r.nome + ' de ' + dataBr + ' passa das vagas',
      'São ' + vagas + ' vaga' + (vagas === 1 ? '' : 's') + '. Com ' + (e.email === u.email ? 'você' : nomeAlvo) + ', ficam ' + depois + ' pessoas.'));
  }
  return avisos;
}

function avisosDeTirarSemanal_(lanc, simulados, r, c, u) {
  var avisos = [];
  var dataBr = formatarDataBr_(lanc.inicio).substring(0, 5);
  var quem = lanc.email === u.email ? 'você' : nomeDe_(c.pessoas, lanc.email);
  if (lanc.inicio.getTime() < c.hoje.getTime()) {
    avisos.push(aviso_(c.tipo + '_PASSADO', dataBr + ' já passou', 'Cancelar altera o registro do que aconteceu.'));
  }
  var restantes = escaladosNoDia_(simulados, c.tipo, lanc.inicio).length;
  var vagas = r.vagas(lanc.inicio, c);
  if (r.aplica(lanc.inicio, bloqueiosDoDia_(c.bloqueios, lanc.inicio).some(ehTipoFeriado_)) && restantes < vagas) {
    avisos.push(aviso_(c.tipo + '_ABAIXO_VAGAS', r.nome + ' de ' + dataBr + ' fica com vaga aberta',
      'Sem ' + quem + ' ficam ' + restantes + ' de ' + vagas + ' vaga' + (vagas === 1 ? '' : 's') + '.'));
  }
  return avisos;
}

function enfileirarEventoSemanal_(lanc, pessoa, r) {
  if (!pessoa) return;
  var h = r.horario(lanc.inicio);
  var d = lanc.inicio;
  var inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h.inicio[0], h.inicio[1], 0);
  var fim = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h.fim[0], h.fim[1], 0);
  enfileirarEvento_({
    titulo: r.tituloEvento(pessoa, d),
    inicio: inicio,
    fim: fim,
    descricao: r.descricaoEvento,
    convidados: [pessoa.email],
    origem: 'salvarSemanal'
  }, lanc.id);
}

// Atalhos para o cliente (chamarComConfirmacao chama funcao(dados, confirmado))
function obterMeioDia(segundaIso) { return obterSemanas(TIPO.MEIO_DIA, segundaIso); }
function obterPlantao(segundaIso) { return obterSemanas(TIPO.PLANTAO, segundaIso); }
function salvarMeioDia(dados, confirmado) { return salvarSemanal(TIPO.MEIO_DIA, dados, confirmado); }
function salvarPlantao(dados, confirmado) { return salvarSemanal(TIPO.PLANTAO, dados, confirmado); }
