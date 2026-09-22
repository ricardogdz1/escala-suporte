/**
 * Sábados: dois turnos (8–11 e 9–12), contagem mínima/máxima e cobertura por setor.
 * Regras em docs/regras.md > Sábado. Tudo gera aviso, nada bloqueia.
 *
 * O cliente monta uma lista de mudanças (escalar X, tirar Y) e salva tudo de uma vez
 * com salvarSabados(): uma ida ao servidor, uma confirmação de avisos.
 */

var HORARIO_TURNO = {};
HORARIO_TURNO[TURNO.T8_11] = { inicio: 8, fim: 11, rotulo: '8h – 11h' };
HORARIO_TURNO[TURNO.T9_12] = { inicio: 9, fim: 12, rotulo: '9h – 12h' };

/**
 * Doze meses de sábados a partir de um mês, com quem está em cada turno, cobertura e avisos.
 * @param {string} mesInicio "yyyy-MM" (vazio = mês atual). A tela mostra mês atual + 11 e carrega
 *   blocos anteriores/seguintes sob demanda.
 */
function obterSabados(mesInicio) {
  var u = exigirUsuario_();
  var hoje = hoje_();
  var inicio = /^\d{4}-\d{2}$/.test(String(mesInicio || '')) ? paraData_(mesInicio + '-01') : null;
  if (!inicio) inicio = inicioDoMes_(hoje);
  var fim = fimDoMes_(new Date(inicio.getFullYear(), inicio.getMonth() + 11, 1));

  var c = contextoSabados_(inicio, fim);
  c.trocasPendentes = mapaTrocasPendentes_();
  var sabados = diasEntre_(inicio, fim).filter(ehSabado_).map(function (d) { return montarSabado_(d, c, u); });

  var mesIso = function (d) { return formatarDataIso_(d).substring(0, 7); };
  return {
    inicio: mesIso(inicio),
    fim: mesIso(fim),
    anterior: mesIso(new Date(inicio.getFullYear(), inicio.getMonth() - 12, 1)),
    proximo: mesIso(new Date(inicio.getFullYear(), inicio.getMonth() + 12, 1)),
    mesAtual: mesIso(inicioDoMes_(hoje)),
    sabados: sabados,
    meusNoAno: meusSabadosNoAno_(u.email),
    minimo: c.min,
    maximo: c.max,
    souGestor: u.gestor,
    pessoas: u.gestor ? listarPessoasAtivas_().map(function (p) { return { email: p.email, nome: p.nomeExibicao }; }) : []
  };
}

function contextoSabados_(inicio, fim) {
  return {
    pessoas: mapaPessoas_(),
    setoresAtivos: listarSetoresAtivos_(),
    lancamentos: listarLancamentosValendo_(inicio, fim),
    bloqueios: listarBloqueios_(inicio, fim),
    hoje: hoje_(),
    min: obterConfigNumero('SABADO_MIN'),
    max: obterConfigNumero('SABADO_MAX')
  };
}

function escaladosNoSabado_(lancamentos, data) {
  return lancamentos.filter(function (x) { return x.tipo === TIPO.SABADO && mesmoDia_(x.inicio, data); });
}

function sabadoBloqueado_(c, data) {
  return bloqueiosDoDia_(c.bloqueios, data).filter(function (b) {
    return b.tipo === BLOQUEIO.TREINAMENTO || ehTipoFeriado_(b);
  });
}

function montarSabado_(data, c, u) {
  var escalados = escaladosNoSabado_(c.lancamentos, data);
  var bloqueios = bloqueiosDoDia_(c.bloqueios, data);
  var bloqueado = sabadoBloqueado_(c, data).length > 0;

  var porTurno = { t8: [], t9: [], semTurno: [] };
  escalados.forEach(function (x) {
    var item = {
      id: x.id, email: x.email, nome: nomeDe_(c.pessoas, x.email), minha: x.email === u.email,
      treinamento: x.treinamento, observacao: x.observacao.replace(/\s*·?\s*importado\s*$/i, '').trim(),
      trocaPendente: !!(c.trocasPendentes && c.trocasPendentes[x.id])
    };
    if (x.turno === TURNO.T8_11) porTurno.t8.push(item);
    else if (x.turno === TURNO.T9_12) porTurno.t9.push(item);
    else porTurno.semTurno.push(item);
  });
  ['t8', 't9', 'semTurno'].forEach(function (k) {
    porTurno[k].sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  });

  // quem está em treinamento aparece no cartão, mas não atende: não conta nem cobre setor
  var atendendo = escalados.filter(function (x) { return !x.treinamento; });
  var semCobertura = setoresSemCobertura_(atendendo, c);
  var total = atendendo.length;
  var contagemOk = total >= c.min && total <= c.max;
  var contagemTexto;
  if (total < c.min) contagemTexto = total + ' de ' + c.min + ' mín.';
  else if (total > c.max) contagemTexto = total + ' pessoas (máx. ' + c.max + ')';
  else contagemTexto = total + ' pessoa' + (total === 1 ? '' : 's');

  // o gestor liga/desliga o treinamento da equipe pelo cartão; um treinamento de vários dias
  // (vindo da importação) só pode ser ajustado na planilha
  var treinoEquipe = bloqueios.filter(function (b) { return b.tipo === BLOQUEIO.TREINAMENTO; })[0];

  return {
    data: formatarDataIso_(data),
    rotulo: formatarDataBr_(data),
    dia: data.getDate(),
    mes: data.getMonth(),
    ano: data.getFullYear(),
    passado: data.getTime() < c.hoje.getTime(),
    bloqueado: bloqueado,
    bloqueios: bloqueios.map(tituloBloqueio_),
    turnos: porTurno,
    total: total,
    contagemOk: contagemOk,
    contagemTexto: contagemTexto,
    setores: c.setoresAtivos.map(function (s) { return { nome: s, coberto: semCobertura.indexOf(s) < 0 }; }),
    problema: !bloqueado && (!contagemOk || (total > 0 && semCobertura.length > 0)),
    minha: escalados.some(function (x) { return x.email === u.email; }),
    treinamentoEquipe: treinoEquipe ? {
      descricao: tituloBloqueio_(treinoEquipe),
      variosDias: !mesmoDia_(treinoEquipe.inicio, treinoEquipe.fim)
    } : null,
    feriado: bloqueios.filter(ehTipoFeriado_).map(tituloBloqueio_)[0] || ''
  };
}

function meusSabadosNoAno_(email) {
  var hoje = hoje_();
  var ano = hoje.getFullYear();
  var datas = listarLancamentos_({
    tipos: [TIPO.SABADO], status: [STATUS.ATIVO], email: email,
    de: new Date(ano, 0, 1), ate: new Date(ano, 11, 31)
  }).map(function (x) { return x.inicio; }).sort(function (a, b) { return a - b; });
  var passados = datas.filter(function (d) { return d.getTime() < hoje.getTime(); });
  var futuros = datas.filter(function (d) { return d.getTime() >= hoje.getTime(); });
  return {
    ano: ano,
    total: datas.length,
    ultimo: passados.length ? formatarDataBr_(passados[passados.length - 1]).substring(0, 5) : '',
    proximo: futuros.length ? formatarDataBr_(futuros[0]).substring(0, 5) : '',
    agendados: futuros.length
  };
}

/**
 * Salva um lote de mudanças na escala de sábados.
 * @param {Object} dados {escalar: [{data: "yyyy-MM-dd", turno: "8h-11h"|"9h-12h", email?: string, treinamento?: boolean, observacao?: string}], cancelar: [id]}
 *   email só para gestor (escalar outra pessoa). Cancelar a escala de outra pessoa também exige gestor.
 * @param {boolean} confirmado true quando o usuário clicou em "Salvar mesmo assim"
 *
 * Avisos de ESCALAR pedem confirmação (regra 1). Avisos de TIRAR não pedem (decisão do usuário,
 * 21/09/2026), mas continuam registrados em AvisosIgnorados.
 */
function salvarSabados(dados, confirmado) {
  var u = exigirUsuario_();
  dados = dados || {};
  var escalar = (dados.escalar || []).map(function (e) {
    var data = paraData_(e.data);
    if (!data || !ehSabado_(data)) throw new Error('Data inválida: ' + e.data + ' não é um sábado.');
    if (!HORARIO_TURNO[e.turno]) throw new Error('Escolha o turno (8–11 ou 9–12) do sábado ' + formatarDataBr_(data) + '.');
    var email = e.email ? normalizarEmail_(e.email) : u.email;
    if (email !== u.email && !u.gestor) throw new Error('Só o gestor pode escalar outra pessoa.');
    return {
      data: data, turno: e.turno, email: email, treinamento: !!e.treinamento,
      observacao: e.treinamento ? String(e.observacao || '').trim().substring(0, 200) : ''
    };
  });
  var idsCancelar = (dados.cancelar || []).map(String);
  if (!escalar.length && !idsCancelar.length) throw new Error('Nada para salvar.');

  var pessoas = mapaPessoas_();
  escalar.forEach(function (e) {
    var p = pessoas[e.email];
    if (!p || !p.ativo) throw new Error('Pessoa não encontrada no cadastro: ' + e.email);
  });

  // Cancelamentos: só lançamentos de sábado ativos; de outra pessoa só se gestor
  var cancelar = [];
  if (idsCancelar.length) {
    var todos = listarLancamentos_({ tipos: [TIPO.SABADO] });
    idsCancelar.forEach(function (id) {
      var lanc = todos.filter(function (x) { return x.id === id; })[0];
      if (!lanc) throw new Error('Escala não encontrada (' + id + ').');
      if (lanc.status !== STATUS.ATIVO) return; // já cancelada por outra pessoa: ignora
      if (lanc.email !== u.email && !u.gestor) throw new Error('Só o gestor pode tirar outra pessoa da escala.');
      cancelar.push(lanc);
    });
  }

  // Contexto cobrindo todas as datas envolvidas
  var datas = escalar.map(function (e) { return e.data; }).concat(cancelar.map(function (l) { return l.inicio; }));
  var inicio = new Date(Math.min.apply(null, datas.map(function (d) { return d.getTime(); })));
  var fim = new Date(Math.max.apply(null, datas.map(function (d) { return d.getTime(); })));
  var c = contextoSabados_(inicio, fim);

  // Simulação: como fica cada sábado depois de todas as mudanças (para os avisos fazerem sentido em lote)
  var idsSaindo = {};
  cancelar.forEach(function (l) { idsSaindo[l.id] = true; });
  var simulados = c.lancamentos.filter(function (x) { return !idsSaindo[x.id]; });

  var avisosEscalar = [];
  var avisosCancelar = [];

  cancelar.forEach(function (l) {
    avisosCancelar.push.apply(avisosCancelar, avisosDeTirar_(l, simulados, c, u));
  });

  escalar.forEach(function (e) {
    var jaNoTurno = escaladosNoSabado_(simulados, e.data).some(function (x) { return x.email === e.email && x.turno === e.turno; });
    if (jaNoTurno) {
      throw new Error((e.email === u.email ? 'Você' : pessoas[e.email].nomeExibicao) + ' já está no turno ' +
        HORARIO_TURNO[e.turno].rotulo + ' do sábado ' + formatarDataBr_(e.data) + '.');
    }
    avisosEscalar.push.apply(avisosEscalar, avisosDeEscalar_(e, simulados, c, u, pessoas));
    simulados.push({ id: '', tipo: TIPO.SABADO, email: e.email, inicio: e.data, fim: e.data, turno: e.turno, status: STATUS.ATIVO, treinamento: e.treinamento });
  });

  if (avisosEscalar.length && !confirmado) return respostaComAvisos_(avisosEscalar);

  // Gravação (cancela primeiro, para troca de turno no mesmo sábado funcionar)
  var criados = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    cancelar.forEach(function (l) {
      atualizarLancamento_(l.id, { 'Status': STATUS.CANCELADO });
    });
    escalar.forEach(function (e) {
      criados.push(criarLancamento_({ tipo: TIPO.SABADO, email: e.email, inicio: e.data, turno: e.turno, treinamento: e.treinamento, observacao: e.observacao }, u));
    });
  } finally {
    lock.releaseLock();
  }

  registrarAvisosIgnorados_(u, criados.length ? criados[0].id : '', avisosEscalar);
  registrarAvisosIgnorados_(u, cancelar.length ? cancelar[0].id : '', avisosCancelar);

  // Agenda
  cancelar.forEach(function (l) { if (l.idEvento) removerEvento_(l.idEvento, 'salvarSabados'); });
  criados.forEach(function (lanc) {
    var idEvento = criarEventoSabado_(lanc, pessoas[lanc.email]);
    if (idEvento) atualizarLancamento_(lanc.id, { 'ID evento agenda': idEvento });
  });

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
      return '<li><strong>' + formatarDataBr_(lanc.inicio) + '</strong>, ' + HORARIO_TURNO[lanc.turno].rotulo + (lanc.treinamento ? ' (em treinamento)' : '') + '</li>';
    }).join('');
    enviarEmail_({
      para: email,
      assunto: lancs.length > 1 ? 'Você foi escalado(a) para ' + lancs.length + ' sábados' : 'Você foi escalado(a) para o sábado ' + formatarDataBr_(lancs[0].inicio),
      corpoHtml: '<p>Olá, ' + escaparHtml_(p.nomeExibicao) + '.</p>' +
        '<p>' + escaparHtml_(u.nomeExibicao) + ' escalou você para:</p><ul>' + itens + '</ul>' +
        '<p><a href="' + urlDoApp_() + '?tela=sabados">Abrir a escala</a></p>',
      origem: 'salvarSabados'
    });
  });

  return {
    ok: true,
    escalados: criados.length,
    cancelados: cancelar.length,
    avisosIgnorados: avisosEscalar.length + avisosCancelar.length
  };
}

/** Avisos de colocar uma pessoa num sábado (considerando o estado simulado do lote). */
function avisosDeEscalar_(e, simulados, c, u, pessoas) {
  var avisos = [];
  var dataBr = formatarDataBr_(e.data).substring(0, 5);
  var nomeAlvo = e.email === u.email ? 'Você' : pessoas[e.email].nomeExibicao;
  var escalados = escaladosNoSabado_(simulados, e.data);

  var bloqueios = sabadoBloqueado_(c, e.data);
  if (bloqueios.length) {
    avisos.push(aviso_('SABADO_BLOQUEADO', 'Sábado ' + dataBr + ' está bloqueado',
      bloqueios.map(tituloBloqueio_).join('; ') + '. Escalas neste dia geram aviso.'));
  }
  if (e.data.getTime() < c.hoje.getTime()) {
    avisos.push(aviso_('SABADO_PASSADO', 'Sábado ' + dataBr + ' já passou', 'O lançamento vale como registro do que aconteceu.'));
  }
  if (escalados.some(function (x) { return x.email === e.email; })) {
    avisos.push(aviso_('SABADO_JA_ESCALADO', nomeAlvo + ' já está no outro turno de ' + dataBr,
      'Ficará nos dois turnos desse sábado.'));
  }
  if (estaDeFerias_(c.lancamentos, e.email, e.data)) {
    avisos.push(aviso_('SABADO_FERIAS', nomeAlvo + ' está de férias em ' + dataBr, 'Há férias aprovadas cobrindo esse dia.'));
  }
  if (!e.treinamento) {
    var atendendo = escalados.filter(function (x) { return !x.treinamento; }).length;
    var totalDepois = atendendo + 1;
    if (totalDepois > c.max) {
      avisos.push(aviso_('SABADO_ACIMA_MAX', 'Sábado ' + dataBr + ' passa do máximo',
        'Já tem ' + atendendo + ' pessoas atendendo. Com ' + (e.email === u.email ? 'você' : nomeAlvo) + ', ficam ' + totalDepois + ' (máx. ' + c.max + ').'));
    }
  }
  return avisos;
}

/** Avisos de tirar uma pessoa de um sábado (considerando o estado simulado do lote). */
function avisosDeTirar_(lanc, simulados, c, u) {
  var avisos = [];
  var dataBr = formatarDataBr_(lanc.inicio).substring(0, 5);
  var quem = lanc.email === u.email ? 'você' : nomeDe_(c.pessoas, lanc.email);
  var restantes = escaladosNoSabado_(simulados, lanc.inicio).filter(function (x) { return !x.treinamento; });

  if (lanc.inicio.getTime() < c.hoje.getTime()) {
    avisos.push(aviso_('SABADO_PASSADO', 'Sábado ' + dataBr + ' já passou', 'Cancelar altera o registro do que aconteceu.'));
  }
  if (lanc.treinamento) return avisos; // quem estava em treinamento não contava: sair não muda a cobertura
  if (restantes.length < c.min) {
    avisos.push(aviso_('SABADO_ABAIXO_MIN', 'Sábado ' + dataBr + ' fica com ' + restantes.length + ' pessoa' + (restantes.length === 1 ? '' : 's'),
      'Sem ' + quem + ' o sábado fica abaixo do mínimo de ' + c.min + '.'));
  }
  var semCobertura = setoresSemCobertura_(restantes, c);
  var antes = setoresSemCobertura_(restantes.concat([lanc]), c);
  var novosDescobertos = semCobertura.filter(function (s) { return antes.indexOf(s) < 0; });
  if (novosDescobertos.length) {
    avisos.push(aviso_('SABADO_SETOR_DESCOBERTO', 'Sábado ' + dataBr + ' sem ' + novosDescobertos.join(', '),
      'Sem ' + quem + ' nenhuma pessoa cobre esse setor.'));
  }
  return avisos;
}

function criarEventoSabado_(lanc, pessoa) {
  var h = HORARIO_TURNO[lanc.turno];
  if (!h) return '';
  var inicio = new Date(lanc.inicio.getFullYear(), lanc.inicio.getMonth(), lanc.inicio.getDate(), h.inicio, 0, 0);
  var fim = new Date(lanc.inicio.getFullYear(), lanc.inicio.getMonth(), lanc.inicio.getDate(), h.fim, 0, 0);
  try {
    return criarEvento_({
      titulo: 'Sábado ' + h.rotulo + (lanc.treinamento ? ' (treinamento)' : '') + ' – ' + pessoa.nomeExibicao,
      inicio: inicio,
      fim: fim,
      descricao: 'Escala de sábado do suporte. Lançado pelo Escala Suporte.',
      convidados: [pessoa.email],
      origem: 'salvarSabados'
    });
  } catch (e) {
    // a escala vale mesmo se a agenda falhar; fica registrado no log
    registrarNotificacao_('EVENTO', 'salvarSabados', pessoa.email, '', 'Sábado ' + formatarDataBr_(lanc.inicio), 'ERRO: ' + e.message);
    return '';
  }
}
