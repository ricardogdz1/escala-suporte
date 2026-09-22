/**
 * Férias: saldo, solicitação, aprovação e linha do tempo da equipe.
 * Regras em docs/regras.md > Férias. Tudo gera aviso, nada bloqueia.
 *
 * Fluxo: rascunho → solicitada → aprovada (gestor) → encaminhada ao RH (gestor).
 * O gestor pode devolver uma solicitação (status devolvida, motivo na observação); a pessoa ajusta e reenvia.
 * Saldo = Saldo inicial (aba SaldoFerias) − dias dos períodos solicitados/aprovados/encaminhados.
 */

var STATUS_FERIAS_CONTAM = [STATUS.SOLICITADA, STATUS.APROVADA, STATUS.ENCAMINHADA];
var MESES_LINHA_DO_TEMPO = 12; // mês atual + 11; o botão "Ano anterior" volta 12 meses

function diasCorridos_(inicio, fim) {
  return Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1;
}

function contextoFerias_() {
  var pessoas = mapaPessoas_();
  var saldos = {};
  lerAba_(ABA_SALDO_FERIAS).forEach(function (l) {
    var email = normalizarEmail_(l['E-mail']);
    if (!email) return;
    saldos[email] = {
      inicial: Number(l['Saldo inicial']) || 0,
      limite: paraData_(l['Prazo limite para gozo']),
      periodo: String(l['Período aquisitivo'] || '').replace(/\s*·?\s*importado\s*$/i, '').trim()
    };
  });
  return {
    pessoas: pessoas,
    lista: Object.keys(pessoas).map(function (e) { return pessoas[e]; }),
    saldos: saldos,
    ferias: listarLancamentos_({ tipos: [TIPO.FERIAS] }).filter(function (x) { return x.status !== STATUS.CANCELADO; }),
    bloqueios: listarBloqueios_(),
    hoje: hoje_(),
    antecedencia: obterConfigNumero('ANTECEDENCIA_FERIAS_DIAS') || 35,
    avisoPrazoDias: obterConfigNumero('FERIAS_AVISO_PRAZO_DIAS') || 60,
    sobreposicaoMin: obterConfigNumero('FERIAS_SOBREPOSICAO_MIN_DIAS') || 6,
    regrasClt: obterConfigSim('FERIAS_REGRAS_CLT')
  };
}

/** Saldo de uma pessoa: inicial, usados (solicitados/aprovados/encaminhados) e disponível. */
function saldoDe_(email, c) {
  var s = c.saldos[email] || { inicial: 0, limite: null, periodo: '' };
  var usados = c.ferias.filter(function (x) { return x.email === email && STATUS_FERIAS_CONTAM.indexOf(x.status) >= 0; })
    .reduce(function (t, x) { return t + diasCorridos_(x.inicio, x.fim); }, 0);
  var diasAteLimite = s.limite ? Math.round((s.limite.getTime() - c.hoje.getTime()) / 86400000) : null;
  return {
    cadastrado: !!c.saldos[email],
    inicial: s.inicial,
    usados: usados,
    disponivel: s.inicial - usados,
    prazoLimite: s.limite ? formatarDataBr_(s.limite) : '',
    prazoLimiteIso: s.limite ? formatarDataIso_(s.limite) : '',
    diasAteLimite: diasAteLimite,
    periodoAquisitivo: s.periodo
  };
}

function rotuloPeriodo_(x) {
  return formatarDataBr_(x.inicio).substring(0, 5) + ' a ' + formatarDataBr_(x.fim).substring(0, 5);
}

/**
 * Tela de férias: saldo, meus períodos, linha do tempo da equipe e (gestor) pendências.
 * @param {string} mesIso "yyyy-MM" do primeiro mês da linha do tempo (vazio = mês atual)
 */
function obterFerias(mesIso) {
  var u = exigirUsuario_();
  var c = contextoFerias_();
  var inicioLinha = /^\d{4}-\d{2}$/.test(String(mesIso || '')) ? paraData_(mesIso + '-01') : inicioDoMes_(c.hoje);

  var meus = c.ferias.filter(function (x) { return x.email === u.email; })
    .sort(function (a, b) { return a.inicio - b.inicio; })
    .map(function (x) { return periodoParaTela_(x, c, u); });

  var resposta = {
    saldo: saldoDe_(u.email, c),
    meus: meus,
    equipe: linhaDoTempo_(inicioLinha, c, u),
    antecedencia: c.antecedencia,
    souGestor: u.gestor,
    pessoas: u.gestor ? listarPessoasAtivas_().map(function (p) { return { email: p.email, nome: p.nomeExibicao }; }) : []
  };
  if (u.gestor) {
    resposta.pendencias = c.ferias.filter(function (x) { return x.status === STATUS.SOLICITADA || x.status === STATUS.APROVADA; })
      .sort(function (a, b) { return a.inicio - b.inicio; })
      .map(function (x) { return periodoParaTela_(x, c, u); });
  }
  return resposta;
}

function periodoParaTela_(x, c, u) {
  var minha = x.email === u.email;
  var editavel = [STATUS.RASCUNHO, STATUS.SOLICITADA, STATUS.DEVOLVIDA].indexOf(x.status) >= 0;
  return {
    id: x.id,
    email: x.email,
    nome: nomeDe_(c.pessoas, x.email),
    minha: minha,
    inicio: formatarDataIso_(x.inicio),
    fim: formatarDataIso_(x.fim),
    rotulo: rotuloPeriodo_(x),
    dias: diasCorridos_(x.inicio, x.fim),
    status: x.status,
    observacao: x.observacao.replace(/\s*·?\s*importado\s*$/i, '').trim(),
    importada: /importado/i.test(x.observacao),
    passada: x.fim.getTime() < c.hoje.getTime(),
    podeEditar: (minha && editavel) || (u.gestor && x.status !== STATUS.ENCAMINHADA),
    podeCancelar: (minha && editavel) || u.gestor,
    podeEnviar: minha && (x.status === STATUS.RASCUNHO || x.status === STATUS.DEVOLVIDA)
  };
}

/** Linha do tempo: 3 meses a partir de inicio, só com quem tem férias no período; coletivas e sobreposições. */
function linhaDoTempo_(inicio, c, u) {
  var fim = fimDoMes_(new Date(inicio.getFullYear(), inicio.getMonth() + MESES_LINHA_DO_TEMPO - 1, 1));
  var totalDias = diasCorridos_(inicio, fim);
  var noPeriodo = c.ferias.filter(function (x) {
    return STATUS_FERIAS_CONTAM.indexOf(x.status) >= 0 && x.inicio.getTime() <= fim.getTime() && x.fim.getTime() >= inicio.getTime();
  });
  var porPessoa = {};
  noPeriodo.forEach(function (x) { (porPessoa[x.email] = porPessoa[x.email] || []).push(x); });

  var pessoas = Object.keys(porPessoa).map(function (email) {
    return {
      email: email, nome: nomeDe_(c.pessoas, email), minha: email === u.email,
      periodos: porPessoa[email].map(function (x) {
        return { id: x.id, inicio: formatarDataIso_(x.inicio), fim: formatarDataIso_(x.fim), rotulo: rotuloPeriodo_(x), status: x.status, dias: diasCorridos_(x.inicio, x.fim) };
      })
    };
  }).sort(function (a, b) { return (b.minha ? 1 : 0) - (a.minha ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR'); });

  var coletivas = c.bloqueios.filter(function (b) {
    return b.tipo === BLOQUEIO.FERIAS_COLETIVAS && b.inicio.getTime() <= fim.getTime() && b.fim.getTime() >= inicio.getTime();
  }).map(function (b) { return { inicio: formatarDataIso_(b.inicio), fim: formatarDataIso_(b.fim), descricao: b.descricao || 'Férias coletivas' }; });

  var meses = [];
  for (var m = 0; m < MESES_LINHA_DO_TEMPO; m++) {
    var d = new Date(inicio.getFullYear(), inicio.getMonth() + m, 1);
    meses.push({ chave: formatarDataIso_(d).substring(0, 7), titulo: MESES[d.getMonth()] + ' de ' + d.getFullYear(), dias: fimDoMes_(d).getDate() });
  }

  // grade mensal: para cada mês, pessoas com férias nele e, por pessoa, os dias (1..31) marcados
  var sobre = sobreposicoes_(noPeriodo, c);
  var diasSobre = {};
  sobre.forEach(function (s) { diasEntre_(paraData_(s.inicio), paraData_(s.fim)).forEach(function (d) { diasSobre[formatarDataIso_(d)] = true; }); });
  meses.forEach(function (m) {
    var mIni = paraData_(m.chave + '-01'), mFim = fimDoMes_(mIni);
    m.coletivas = [];
    diasEntre_(mIni, mFim).forEach(function (d) {
      if (c.bloqueios.some(function (b) { return b.tipo === BLOQUEIO.FERIAS_COLETIVAS && dentroDe_(d, b.inicio, b.fim); })) m.coletivas.push(d.getDate());
    });
    m.feriados = diasEntre_(mIni, mFim).filter(function (d) { return ehFeriado_(c.bloqueios, d); }).map(function (d) { return d.getDate(); });
    m.pessoas = pessoas.map(function (p) {
      var dias = {};
      var periodosNoMes = [];
      p.periodos.forEach(function (per) {
        var ini = paraData_(per.inicio), fi = paraData_(per.fim);
        if (ini.getTime() > mFim.getTime() || fi.getTime() < mIni.getTime()) return;
        periodosNoMes.push(per);
        diasEntre_(new Date(Math.max(ini.getTime(), mIni.getTime())), new Date(Math.min(fi.getTime(), mFim.getTime()))).forEach(function (d) {
          dias[d.getDate()] = diasSobre[formatarDataIso_(d)] ? 'sobre' : (per.status === STATUS.SOLICITADA ? 'solicitada' : 'ok');
        });
      });
      return { email: p.email, nome: p.nome, minha: p.minha, dias: dias, periodos: periodosNoMes };
    }).filter(function (p) { return p.periodos.length; });
    m.primeiroDiaSemana = mIni.getDay();
  });

  return {
    inicio: formatarDataIso_(inicio),
    fim: formatarDataIso_(fim),
    totalDias: totalDias,
    hoje: formatarDataIso_(c.hoje),
    titulo: MESES[inicio.getMonth()].toLowerCase() + '/' + inicio.getFullYear() + ' a ' + MESES[fim.getMonth()].toLowerCase() + '/' + fim.getFullYear(),
    anterior: formatarDataIso_(new Date(inicio.getFullYear(), inicio.getMonth() - MESES_LINHA_DO_TEMPO, 1)).substring(0, 7),
    proximo: formatarDataIso_(new Date(inicio.getFullYear(), inicio.getMonth() + MESES_LINHA_DO_TEMPO, 1)).substring(0, 7),
    atual: formatarDataIso_(inicioDoMes_(c.hoje)).substring(0, 7),
    meses: meses,
    pessoas: pessoas,
    coletivas: coletivas,
    sobreposicoes: sobre
  };
}

/** Trechos em que 2+ pessoas estão de férias ao mesmo tempo por pelo menos FERIAS_SOBREPOSICAO_MIN_DIAS: [{inicio, fim, nomes}] */
function sobreposicoes_(periodos, c) {
  if (periodos.length < 2) return [];
  var datas = {};
  periodos.forEach(function (x) {
    diasEntre_(x.inicio, x.fim).forEach(function (d) {
      var k = formatarDataIso_(d);
      (datas[k] = datas[k] || {})[x.email] = true;
    });
  });
  var chaves = Object.keys(datas).sort();
  var trechos = [];
  var atual = null;
  chaves.forEach(function (k) {
    var emails = Object.keys(datas[k]).sort();
    if (emails.length < 2) { atual = null; return; }
    var assinatura = emails.join('|');
    var ontem = atual ? formatarDataIso_(adicionarDias_(paraData_(atual.fim), 1)) : '';
    if (atual && atual.assinatura === assinatura && ontem === k) { atual.fim = k; return; }
    atual = { assinatura: assinatura, inicio: k, fim: k, emails: emails };
    trechos.push(atual);
  });
  trechos = trechos.filter(function (t) { return diasCorridos_(paraData_(t.inicio), paraData_(t.fim)) >= c.sobreposicaoMin; });
  return trechos.map(function (t) {
    var nomes = t.emails.map(function (e) { return nomeDe_(c.pessoas, e); });
    return {
      inicio: t.inicio, fim: t.fim, quantidade: nomes.length, nomes: nomes,
      texto: nomes.join(', ').replace(/, ([^,]*)$/, ' e $1') + ': ' + nomes.length + ' ao mesmo tempo de ' +
        formatarDataBr_(paraData_(t.inicio)).substring(0, 5) + ' a ' + formatarDataBr_(paraData_(t.fim)).substring(0, 5)
    };
  });
}

/** Avisos de um período de férias de uma pessoa (ignorando o próprio lançamento, se for edição). */
function avisosFerias_(email, inicio, fim, idIgnorar, c, u) {
  var avisos = [];
  var nome = email === u.email ? 'Você' : nomeDe_(c.pessoas, email);
  var rotulo = formatarDataBr_(inicio).substring(0, 5) + ' a ' + formatarDataBr_(fim).substring(0, 5);
  var dias = diasCorridos_(inicio, fim);

  // sobreposição com qualquer pessoa da equipe (só conta a partir de FERIAS_SOBREPOSICAO_MIN_DIAS em comum)
  var outros = c.ferias.filter(function (x) {
    if (x.id === idIgnorar || x.email === email || STATUS_FERIAS_CONTAM.indexOf(x.status) < 0) return false;
    var ini = Math.max(x.inicio.getTime(), inicio.getTime()), fi = Math.min(x.fim.getTime(), fim.getTime());
    return fi >= ini && diasCorridos_(new Date(ini), new Date(fi)) >= c.sobreposicaoMin;
  });
  if (outros.length) {
    avisos.push(aviso_('FERIAS_SOBREPOSICAO', 'Sobreposição na equipe',
      outros.map(function (x) { return nomeDe_(c.pessoas, x.email) + ' (' + rotuloPeriodo_(x) + ', ' + x.status + ')'; }).join('; ') + ' — ' + c.sobreposicaoMin + ' dias ou mais em comum.'));
  }
  // antecedência
  var diasAntes = Math.round((inicio.getTime() - c.hoje.getTime()) / 86400000);
  if (diasAntes < c.antecedencia) {
    avisos.push(aviso_('FERIAS_ANTECEDENCIA', 'Pouca antecedência',
      diasAntes < 0 ? 'O período começa no passado.' : 'Faltam ' + diasAntes + ' dias para o início; o combinado é pelo menos ' + c.antecedencia + '.'));
  }
  // saldo
  var saldo = saldoDe_(email, c);
  if (idIgnorar) {
    var anterior = c.ferias.filter(function (x) { return x.id === idIgnorar && STATUS_FERIAS_CONTAM.indexOf(x.status) >= 0; })[0];
    if (anterior) saldo.disponivel += diasCorridos_(anterior.inicio, anterior.fim);
  }
  if (!saldo.cadastrado) {
    avisos.push(aviso_('FERIAS_SEM_SALDO', 'Saldo não cadastrado', nome + ' não tem saldo na aba SaldoFerias; o gestor precisa preencher.'));
  } else if (dias > saldo.disponivel) {
    avisos.push(aviso_('FERIAS_SALDO', 'Saldo insuficiente', 'São ' + dias + ' dias e o saldo disponível é ' + saldo.disponivel + '.'));
  }
  // prazo limite
  if (saldo.prazoLimiteIso && formatarDataIso_(fim) > saldo.prazoLimiteIso) {
    avisos.push(aviso_('FERIAS_PRAZO', 'Passa do prazo limite para gozo', 'O período termina depois de ' + saldo.prazoLimite + '.'));
  }
  // coletivas
  var coletivas = c.bloqueios.filter(function (b) {
    return b.tipo === BLOQUEIO.FERIAS_COLETIVAS && b.inicio.getTime() <= fim.getTime() && b.fim.getTime() >= inicio.getTime();
  });
  if (coletivas.length) {
    avisos.push(aviso_('FERIAS_COLETIVAS', 'Coincide com férias coletivas',
      coletivas.map(function (b) { return formatarDataBr_(b.inicio).substring(0, 5) + ' a ' + formatarDataBr_(b.fim).substring(0, 5); }).join('; ') + '.'));
  }
  // CLT (só quando ligado na Config)
  if (c.regrasClt) {
    var meusOutros = c.ferias.filter(function (x) { return x.email === email && x.id !== idIgnorar && STATUS_FERIAS_CONTAM.indexOf(x.status) >= 0; });
    var todos = meusOutros.map(function (x) { return diasCorridos_(x.inicio, x.fim); }).concat([dias]);
    if (todos.length > 3) avisos.push(aviso_('FERIAS_CLT_PERIODOS', 'Mais de 3 períodos', 'A CLT permite fracionar em até 3 períodos.'));
    if (!todos.some(function (d) { return d >= 14; })) avisos.push(aviso_('FERIAS_CLT_14', 'Nenhum período com 14 dias', 'Um dos períodos precisa ter pelo menos 14 dias corridos.'));
    if (dias < 5) avisos.push(aviso_('FERIAS_CLT_5', 'Período com menos de 5 dias', 'Os períodos precisam ter pelo menos 5 dias corridos.'));
    var doisDepois = adicionarDias_(inicio, 2);
    var feriadoPerto = c.bloqueios.some(function (b) { return ehTipoFeriado_(b) && b.inicio.getTime() <= doisDepois.getTime() && b.fim.getTime() >= inicio.getTime(); });
    if (feriadoPerto || inicio.getDay() === 5 || inicio.getDay() === 6 || inicio.getDay() === 0) {
      avisos.push(aviso_('FERIAS_CLT_INICIO', 'Início perto de folga ou feriado', 'As férias não podem começar nos 2 dias que antecedem feriado ou folga (' + rotulo + ').'));
    }
  }
  return avisos;
}

/** Prévia para o painel "Solicitar férias": dias e avisos, sem gravar. */
function previaFerias(dados) {
  var u = exigirUsuario_();
  dados = dados || {};
  var inicio = paraData_(dados.inicio), fim = paraData_(dados.fim);
  if (!inicio || !fim) return { dias: 0, avisos: [] };
  if (fim.getTime() < inicio.getTime()) return { dias: 0, avisos: [aviso_('FERIAS_DATAS', 'Datas invertidas', 'O fim vem antes do início.')] };
  var email = dados.email && u.gestor ? normalizarEmail_(dados.email) : u.email;
  var c = contextoFerias_();
  return { dias: diasCorridos_(inicio, fim), avisos: avisosFerias_(email, inicio, fim, String(dados.id || ''), c, u) };
}

/**
 * Cria ou atualiza um período de férias.
 * @param {Object} dados {id?, inicio, fim, acao: 'rascunho'|'solicitar', email? (gestor), observacao?}
 * @param {boolean} confirmado true quando clicou em "Enviar mesmo assim"
 * Rascunho não pede confirmação de avisos (não conta no saldo nem para os colegas). Solicitar pede.
 */
function salvarFerias(dados, confirmado) {
  var u = exigirUsuario_();
  dados = dados || {};
  var inicio = paraData_(dados.inicio), fim = paraData_(dados.fim);
  if (!inicio || !fim) throw new Error('Informe início e fim.');
  if (fim.getTime() < inicio.getTime()) throw new Error('O fim vem antes do início.');
  var solicitar = dados.acao === 'solicitar';
  var email = dados.email && u.gestor ? normalizarEmail_(dados.email) : u.email;
  var c = contextoFerias_();
  var pessoa = c.pessoas[email];
  if (!pessoa || !pessoa.ativo) throw new Error('Pessoa não encontrada no cadastro.');

  var existente = null;
  if (dados.id) {
    existente = c.ferias.filter(function (x) { return x.id === String(dados.id); })[0];
    if (!existente) throw new Error('Período não encontrado.');
    if (existente.email !== email) throw new Error('Esse período é de outra pessoa.');
    if (!u.gestor && [STATUS.RASCUNHO, STATUS.SOLICITADA, STATUS.DEVOLVIDA].indexOf(existente.status) < 0) throw new Error('Esse período já foi ' + existente.status + ' e não pode ser alterado.');
    if (existente.status === STATUS.ENCAMINHADA) throw new Error('Período já encaminhado ao RH.');
  }

  var avisos = solicitar ? avisosFerias_(email, inicio, fim, existente ? existente.id : '', c, u) : [];
  if (avisos.length && !confirmado) return respostaComAvisos_(avisos);

  // gestor editando um período já aprovado: mantém aprovado
  var status = solicitar ? (existente && existente.status === STATUS.APROVADA && u.gestor ? STATUS.APROVADA : STATUS.SOLICITADA) : STATUS.RASCUNHO;
  var observacao = String(dados.observacao || '').trim().substring(0, 200);
  var lanc;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (existente) {
      atualizarLancamento_(existente.id, { 'Data início': inicio, 'Data fim': fim, 'Status': status, 'Observação': observacao });
      lanc = existente;
    } else {
      lanc = criarLancamento_({ tipo: TIPO.FERIAS, email: email, inicio: inicio, fim: fim, status: status, observacao: observacao }, u);
    }
  } finally {
    lock.releaseLock();
  }
  registrarAvisosIgnorados_(u, lanc.id, avisos);

  if (solicitar) {
    var rotulo = formatarDataBr_(inicio) + ' a ' + formatarDataBr_(fim) + ' (' + diasCorridos_(inicio, fim) + ' dias)';
    var gestores = emailsGestores_().filter(function (e) { return e !== u.email; });
    if (gestores.length) {
      enviarEmail_({
        para: gestores,
        assunto: 'Solicitação de férias: ' + pessoa.nomeExibicao + ' · ' + rotulo,
        corpoHtml: '<p><strong>' + escaparHtml_(pessoa.nomeExibicao) + '</strong> solicitou férias de <strong>' + escaparHtml_(rotulo) + '</strong>.</p>' +
          (observacao ? '<p>Observação: ' + escaparHtml_(observacao) + '</p>' : '') +
          (avisos.length ? '<p>Avisos aceitos ao enviar: ' + escaparHtml_(avisos.map(function (a) { return a.titulo; }).join('; ')) + '.</p>' : '') +
          '<p><a href="' + urlDoApp_() + '?tela=ferias">Abrir Férias</a></p>',
        origem: 'salvarFerias'
      });
    }
  }
  return { ok: true, id: lanc.id, status: status, avisosIgnorados: avisos.length };
}

/** Cancela um período (a própria pessoa: rascunho/solicitada/devolvida; gestor: qualquer, exceto encaminhada). */
function cancelarFerias(id) {
  var u = exigirUsuario_();
  var x = listarLancamentos_({ tipos: [TIPO.FERIAS] }).filter(function (f) { return f.id === String(id || ''); })[0];
  if (!x) throw new Error('Período não encontrado.');
  if (x.status === STATUS.CANCELADO) return { ok: true };
  if (x.email !== u.email && !u.gestor) throw new Error('Só o gestor pode cancelar as férias de outra pessoa.');
  if (!u.gestor && [STATUS.RASCUNHO, STATUS.SOLICITADA, STATUS.DEVOLVIDA].indexOf(x.status) < 0) throw new Error('Esse período já foi ' + x.status + '; fale com o gestor.');
  if (x.status === STATUS.ENCAMINHADA) throw new Error('Período já encaminhado ao RH; ajuste com o RH antes de cancelar aqui.');
  atualizarLancamento_(x.id, { 'Status': STATUS.CANCELADO });
  if (x.idEvento) removerEvento_(x.idEvento, 'cancelarFerias');
  if (x.email !== u.email) {
    enviarEmail_({
      para: x.email,
      assunto: 'Suas férias de ' + rotuloPeriodo_(x) + ' foram canceladas',
      corpoHtml: '<p>' + escaparHtml_(u.nomeExibicao) + ' cancelou o período de férias <strong>' + escaparHtml_(rotuloPeriodo_(x)) + '</strong>.</p>',
      origem: 'cancelarFerias'
    });
  }
  return { ok: true };
}

/**
 * Decisão do gestor sobre uma solicitação.
 * @param {Object} dados {id, acao: 'aprovar'|'devolver'|'encaminhar', motivo?}
 * @param {boolean} confirmado true quando clicou em "Aprovar mesmo assim"
 */
function decidirFerias(dados, confirmado) {
  var u = exigirGestor_();
  dados = dados || {};
  var c = contextoFerias_();
  var x = c.ferias.filter(function (f) { return f.id === String(dados.id || ''); })[0];
  if (!x) throw new Error('Período não encontrado.');
  var pessoa = c.pessoas[x.email];
  var rotulo = formatarDataBr_(x.inicio) + ' a ' + formatarDataBr_(x.fim) + ' (' + diasCorridos_(x.inicio, x.fim) + ' dias)';
  var link = '<p><a href="' + urlDoApp_() + '?tela=ferias">Abrir Férias</a></p>';

  if (dados.acao === 'devolver') {
    if (x.status !== STATUS.SOLICITADA && x.status !== STATUS.APROVADA) throw new Error('Só solicitações ou aprovadas podem ser devolvidas.');
    var motivo = String(dados.motivo || '').trim().substring(0, 200);
    atualizarLancamento_(x.id, { 'Status': STATUS.DEVOLVIDA, 'Observação': motivo ? 'Devolvida: ' + motivo : 'Devolvida pelo gestor' });
    if (x.idEvento) removerEvento_(x.idEvento, 'decidirFerias');
    enviarEmail_({
      para: x.email,
      assunto: 'Férias de ' + rotuloPeriodo_(x) + ': devolvida para ajuste',
      corpoHtml: '<p>Olá, ' + escaparHtml_(pessoa.nomeExibicao) + '.</p><p>' + escaparHtml_(u.nomeExibicao) + ' devolveu sua solicitação de férias de <strong>' + escaparHtml_(rotulo) + '</strong>' +
        (motivo ? ' com o motivo: <em>' + escaparHtml_(motivo) + '</em>' : '') + '.</p><p>Ajuste as datas no app e envie de novo.</p>' + link,
      origem: 'decidirFerias'
    });
    return { ok: true, status: STATUS.DEVOLVIDA };
  }

  if (dados.acao === 'aprovar') {
    if (x.status !== STATUS.SOLICITADA) throw new Error('Só solicitações podem ser aprovadas (esta está ' + x.status + ').');
    var avisos = avisosFerias_(x.email, x.inicio, x.fim, x.id, c, u);
    if (avisos.length && !confirmado) return respostaComAvisos_(avisos);
    atualizarLancamento_(x.id, { 'Status': STATUS.APROVADA });
    registrarAvisosIgnorados_(u, x.id, avisos);
    var idEvento = criarEventoFerias_(x, pessoa);
    if (idEvento) atualizarLancamento_(x.id, { 'ID evento agenda': idEvento });
    enviarEmail_({
      para: x.email,
      assunto: 'Férias aprovadas: ' + rotuloPeriodo_(x),
      corpoHtml: '<p>Olá, ' + escaparHtml_(pessoa.nomeExibicao) + '.</p><p>' + escaparHtml_(u.nomeExibicao) + ' aprovou suas férias de <strong>' + escaparHtml_(rotulo) + '</strong>. O próximo passo é o encaminhamento ao RH.</p>' + link,
      origem: 'decidirFerias'
    });
    return { ok: true, status: STATUS.APROVADA, avisosIgnorados: avisos.length };
  }

  if (dados.acao === 'encaminhar') {
    if (x.status !== STATUS.APROVADA) throw new Error('Só férias aprovadas podem ser encaminhadas ao RH.');
    atualizarLancamento_(x.id, { 'Status': STATUS.ENCAMINHADA });
    enviarEmail_({
      para: x.email,
      assunto: 'Férias encaminhadas ao RH: ' + rotuloPeriodo_(x),
      corpoHtml: '<p>Olá, ' + escaparHtml_(pessoa.nomeExibicao) + '.</p><p>Suas férias de <strong>' + escaparHtml_(rotulo) + '</strong> foram encaminhadas ao RH.</p>' + link,
      origem: 'decidirFerias'
    });
    return { ok: true, status: STATUS.ENCAMINHADA };
  }
  throw new Error('Ação inválida.');
}

function criarEventoFerias_(x, pessoa) {
  try {
    return criarEvento_({
      titulo: 'Férias – ' + pessoa.nomeExibicao,
      inicio: x.inicio,
      fim: x.fim,
      diaInteiro: true,
      descricao: 'Férias aprovadas. Lançado pelo Escala Suporte.',
      convidados: [pessoa.email],
      origem: 'decidirFerias'
    });
  } catch (e) {
    registrarNotificacao_('EVENTO', 'decidirFerias', pessoa.email, '', 'Férias ' + formatarDataBr_(x.inicio), 'ERRO: ' + e.message);
    return '';
  }
}

/** Avisos de férias para o Painel: solicitações aguardando (gestor), sobreposições e prazo limite próximo (o meu). */
function avisosFeriasPainel_(u) {
  var c = contextoFerias_();
  var lista = [];
  var fimJanela = fimDoMes_(new Date(c.hoje.getFullYear(), c.hoje.getMonth() + 1, 1));

  if (u.gestor) {
    c.ferias.filter(function (x) { return x.status === STATUS.SOLICITADA; }).forEach(function (x) {
      lista.push({ data: formatarDataIso_(x.inicio), grupo: 'ferias', tela: 'ferias',
        titulo: 'Férias de ' + nomeDe_(c.pessoas, x.email) + ' aguardando aprovação',
        texto: rotuloPeriodo_(x) + ' · ' + diasCorridos_(x.inicio, x.fim) + ' dias.' });
    });
  }

  var noPeriodo = c.ferias.filter(function (x) {
    return STATUS_FERIAS_CONTAM.indexOf(x.status) >= 0 && x.inicio.getTime() <= fimJanela.getTime() && x.fim.getTime() >= c.hoje.getTime();
  });
  sobreposicoes_(noPeriodo, c).forEach(function (s) {
    lista.push({ data: s.inicio, grupo: 'ferias', tela: 'ferias', titulo: 'Sobreposição de férias', texto: s.texto + '.' });
  });

  var saldo = saldoDe_(u.email, c);
  if (saldo.cadastrado && saldo.disponivel > 0 && saldo.diasAteLimite !== null && saldo.diasAteLimite <= c.avisoPrazoDias) {
    lista.push({ data: formatarDataIso_(c.hoje), grupo: 'ferias', tela: 'ferias',
      titulo: 'Seu prazo para tirar férias está chegando',
      texto: 'Você ainda tem ' + saldo.disponivel + ' dias e o prazo limite é ' + saldo.prazoLimite + (saldo.diasAteLimite < 0 ? ' (já passou).' : ' (' + saldo.diasAteLimite + ' dias).') });
  }
  return lista;
}
