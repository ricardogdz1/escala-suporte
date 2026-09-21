/**
 * Sábados: dois turnos (8–11 e 9–12), contagem mínima/máxima e cobertura por setor.
 * Regras em docs/regras.md > Sábado. Tudo gera aviso, nada bloqueia.
 */

var HORARIO_TURNO = {};
HORARIO_TURNO[TURNO.T8_11] = { inicio: 8, fim: 11, rotulo: '8h – 11h' };
HORARIO_TURNO[TURNO.T9_12] = { inicio: 9, fim: 12, rotulo: '9h – 12h' };

/**
 * Sábados de um mês, com quem está em cada turno, cobertura e avisos.
 * @param {string} mesIso "yyyy-MM" (vazio = mês atual)
 */
function obterSabados(mesIso) {
  var u = exigirUsuario_();
  var ref = paraData_((mesIso || '').substring(0, 7) + '-01') || inicioDoMes_(hoje_());
  var inicio = inicioDoMes_(ref);
  var fim = fimDoMes_(ref);

  var c = contextoSabados_(inicio, fim);
  var sabados = diasEntre_(inicio, fim).filter(ehSabado_).map(function (d) { return montarSabado_(d, c, u); });

  return {
    titulo: MESES[inicio.getMonth()] + ' de ' + inicio.getFullYear(),
    mes: formatarDataIso_(inicio).substring(0, 7),
    anterior: formatarDataIso_(new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1)).substring(0, 7),
    proximo: formatarDataIso_(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1)).substring(0, 7),
    atual: formatarDataIso_(inicioDoMes_(hoje_())).substring(0, 7),
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

function escaladosNoSabado_(c, data) {
  return c.lancamentos.filter(function (x) { return x.tipo === TIPO.SABADO && mesmoDia_(x.inicio, data); });
}

function montarSabado_(data, c, u) {
  var escalados = escaladosNoSabado_(c, data);
  var bloqueios = bloqueiosDoDia_(c.bloqueios, data);
  var bloqueado = bloqueios.some(function (b) { return b.tipo === BLOQUEIO.TREINAMENTO || b.tipo === BLOQUEIO.FERIADO; });

  var porTurno = { t8: [], t9: [], semTurno: [] };
  escalados.forEach(function (x) {
    var item = { id: x.id, email: x.email, nome: nomeDe_(c.pessoas, x.email), minha: x.email === u.email };
    if (x.turno === TURNO.T8_11) porTurno.t8.push(item);
    else if (x.turno === TURNO.T9_12) porTurno.t9.push(item);
    else porTurno.semTurno.push(item);
  });
  ['t8', 't9', 'semTurno'].forEach(function (k) {
    porTurno[k].sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  });

  var semCobertura = setoresSemCobertura_(escalados, c);
  var total = escalados.length;
  var contagemOk = total >= c.min && total <= c.max;
  var contagemTexto;
  if (total < c.min) contagemTexto = total + ' de ' + c.min + ' mín.';
  else if (total > c.max) contagemTexto = total + ' pessoas (máx. ' + c.max + ')';
  else contagemTexto = total + ' pessoa' + (total === 1 ? '' : 's');

  var minha = escalados.filter(function (x) { return x.email === u.email; })[0];

  return {
    data: formatarDataIso_(data),
    rotulo: formatarDataBr_(data),
    dia: data.getDate(),
    passado: data.getTime() < c.hoje.getTime(),
    bloqueado: bloqueado,
    bloqueios: bloqueios.map(function (b) { return b.descricao || b.tipo; }),
    turnos: porTurno,
    total: total,
    contagemOk: contagemOk,
    contagemTexto: contagemTexto,
    setores: c.setoresAtivos.map(function (s) { return { nome: s, coberto: semCobertura.indexOf(s) < 0 }; }),
    problema: !bloqueado && (!contagemOk || (total > 0 && semCobertura.length > 0)),
    minhaEscala: minha ? { id: minha.id, turno: minha.turno } : null
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
 * Escala uma pessoa num sábado.
 * @param {Object} dados {data: "yyyy-MM-dd", turno: "8h-11h"|"9h-12h", email?: string (só gestor)}
 * @param {boolean} confirmado  true quando o usuário clicou em "Salvar mesmo assim"
 */
function escalarSabado(dados, confirmado) {
  var u = exigirUsuario_();
  var data = paraData_(dados.data);
  if (!data || !ehSabado_(data)) throw new Error('Data inválida: precisa ser um sábado.');
  if (!HORARIO_TURNO[dados.turno]) throw new Error('Escolha o turno (8–11 ou 9–12).');

  var email = u.email;
  if (dados.email && normalizarEmail_(dados.email) !== u.email) {
    if (!u.gestor) throw new Error('Só o gestor pode escalar outra pessoa.');
    email = normalizarEmail_(dados.email);
  }
  var pessoa = mapaPessoas_()[email];
  if (!pessoa || !pessoa.ativo) throw new Error('Pessoa não encontrada no cadastro.');
  var nomeAlvo = email === u.email ? 'Você' : pessoa.nomeExibicao;

  var c = contextoSabados_(data, data);
  var escalados = escaladosNoSabado_(c, data);
  var jaEscalado = escalados.filter(function (x) { return x.email === email; });
  if (jaEscalado.some(function (x) { return x.turno === dados.turno; })) {
    throw new Error(nomeAlvo + ' já está neste turno desse sábado.');
  }

  var dataBr = formatarDataBr_(data).substring(0, 5);
  var avisos = [];
  var bloqueios = bloqueiosDoDia_(c.bloqueios, data).filter(function (b) {
    return b.tipo === BLOQUEIO.TREINAMENTO || b.tipo === BLOQUEIO.FERIADO;
  });
  if (bloqueios.length) {
    avisos.push(aviso_('SABADO_BLOQUEADO', 'Sábado ' + dataBr + ' está bloqueado',
      bloqueios.map(function (b) { return b.descricao || b.tipo; }).join('; ') + '. Escalas neste dia geram aviso.'));
  }
  if (data.getTime() < c.hoje.getTime()) {
    avisos.push(aviso_('SABADO_PASSADO', 'Esse sábado já passou', 'O lançamento vale como registro do que aconteceu.'));
  }
  if (jaEscalado.length) {
    avisos.push(aviso_('SABADO_JA_ESCALADO', nomeAlvo + ' já está no outro turno',
      'Ficará nos dois turnos do sábado ' + dataBr + '.'));
  }
  if (estaDeFerias_(c.lancamentos, email, data)) {
    avisos.push(aviso_('SABADO_FERIAS', nomeAlvo + ' está de férias nesse dia', 'Há férias aprovadas cobrindo ' + dataBr + '.'));
  }
  var totalDepois = escalados.length + 1;
  if (totalDepois > c.max) {
    avisos.push(aviso_('SABADO_ACIMA_MAX', 'Sábado já está no máximo',
      dataBr + ' já tem ' + escalados.length + ' pessoas. Com ' + (email === u.email ? 'você' : pessoa.nomeExibicao) + ', ficam ' + totalDepois + '.'));
  }

  if (avisos.length && !confirmado) return respostaComAvisos_(avisos);

  var lanc;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    lanc = criarLancamento_({ tipo: TIPO.SABADO, email: email, inicio: data, turno: dados.turno }, u);
  } finally {
    lock.releaseLock();
  }
  registrarAvisosIgnorados_(u, lanc.id, avisos);

  var idEvento = criarEventoSabado_(lanc, pessoa);
  if (idEvento) atualizarLancamento_(lanc.id, { 'ID evento agenda': idEvento });

  if (email !== u.email) {
    enviarEmail_({
      para: email,
      assunto: 'Você foi escalado(a) para o sábado ' + formatarDataBr_(data),
      corpoHtml: '<p>Olá, ' + escaparHtml_(pessoa.nomeExibicao) + '.</p>' +
        '<p>' + escaparHtml_(u.nomeExibicao) + ' escalou você para o sábado <strong>' + formatarDataBr_(data) +
        '</strong>, turno <strong>' + HORARIO_TURNO[dados.turno].rotulo + '</strong>.</p>' +
        '<p><a href="' + urlDoApp_() + '?tela=sabados">Abrir a escala</a></p>',
      origem: 'escalarSabado'
    });
  }

  return { ok: true, id: lanc.id, avisosIgnorados: avisos.length };
}

/** Cancela a escala de um sábado (a própria ou, se gestor, de qualquer pessoa). */
function cancelarSabado(id, confirmado) {
  var u = exigirUsuario_();
  var lanc = listarLancamentos_({ tipos: [TIPO.SABADO] }).filter(function (x) { return x.id === id; })[0];
  if (!lanc) throw new Error('Escala não encontrada.');
  if (lanc.status !== STATUS.ATIVO) throw new Error('Essa escala já foi cancelada.');
  if (lanc.email !== u.email && !u.gestor) throw new Error('Só o gestor pode cancelar a escala de outra pessoa.');

  var c = contextoSabados_(lanc.inicio, lanc.inicio);
  var restantes = escaladosNoSabado_(c, lanc.inicio).filter(function (x) { return x.id !== id; });
  var quem = lanc.email === u.email ? 'você' : nomeDe_(c.pessoas, lanc.email);

  var dataBr = formatarDataBr_(lanc.inicio).substring(0, 5);
  var avisos = [];
  if (lanc.inicio.getTime() < c.hoje.getTime()) {
    avisos.push(aviso_('SABADO_PASSADO', 'Esse sábado já passou', 'Cancelar altera o registro do que aconteceu.'));
  }
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

  if (avisos.length && !confirmado) return respostaComAvisos_(avisos);

  atualizarLancamento_(id, { 'Status': STATUS.CANCELADO });
  registrarAvisosIgnorados_(u, id, avisos);
  if (lanc.idEvento) removerEvento_(lanc.idEvento, 'cancelarSabado');

  return { ok: true };
}

function criarEventoSabado_(lanc, pessoa) {
  var h = HORARIO_TURNO[lanc.turno];
  if (!h) return '';
  var inicio = new Date(lanc.inicio.getFullYear(), lanc.inicio.getMonth(), lanc.inicio.getDate(), h.inicio, 0, 0);
  var fim = new Date(lanc.inicio.getFullYear(), lanc.inicio.getMonth(), lanc.inicio.getDate(), h.fim, 0, 0);
  try {
    return criarEvento_({
      titulo: 'Sábado ' + h.rotulo + ' – ' + pessoa.nomeExibicao,
      inicio: inicio,
      fim: fim,
      descricao: 'Escala de sábado do suporte. Lançado pelo Escala Suporte.',
      convidados: [pessoa.email],
      origem: 'escalarSabado'
    });
  } catch (e) {
    // a escala vale mesmo se a agenda falhar; fica registrado no log
    registrarNotificacao_('EVENTO', 'escalarSabado', pessoa.email, '', 'Sábado ' + formatarDataBr_(lanc.inicio), 'ERRO: ' + e.message);
    return '';
  }
}
