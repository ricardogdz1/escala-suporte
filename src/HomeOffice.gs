/**
 * Home office: reserva de uma semana inteira (segunda a sexta), uma pessoa da equipe por semana,
 * com uma fila única da equipe (todos os colaboradores ativos, sem o gestor e sem quem já trabalha em home office).
 * Regras em docs/regras.md > Home office. Tudo gera aviso, nada bloqueia.
 *
 * Fila sem ordem fixa: cada pessoa está em "reservado", "já usou nesta rodada" ou "ainda não usou"
 * (ver situacaoFilaHO_). Reservar de novo enquanto outros ainda não usaram gera aviso.
 */

var SEMANAS_HO_POR_BLOCO = 13;

/**
 * Semanas de home office a partir de uma segunda-feira (13 semanas), com a fila da equipe.
 * @param {string} segundaIso "yyyy-MM-dd" (qualquer dia da semana; vazio = semana atual)
 */
function obterHomeOffice(segundaIso) {
  var u = exigirUsuario_();
  var hoje = hoje_();
  var inicio = inicioDaSemana_(paraData_(segundaIso) || hoje);
  var fim = adicionarDias_(inicio, SEMANAS_HO_POR_BLOCO * 7 - 1);
  var c = contextoHomeOffice_();

  var semanas = [];
  for (var n = 0; n < SEMANAS_HO_POR_BLOCO; n++) {
    semanas.push(montarSemanaHO_(adicionarDias_(inicio, 7 * n), c, u));
  }
  var semanaAtual = montarSemanaHO_(inicioDaSemana_(hoje), c, u);

  return {
    inicio: formatarDataIso_(inicio),
    anterior: formatarDataIso_(adicionarDias_(inicio, -7 * SEMANAS_HO_POR_BLOCO)),
    proximo: formatarDataIso_(adicionarDias_(inicio, 7 * SEMANAS_HO_POR_BLOCO)),
    semanaAtual: semanaAtual.inicio,
    estaSemana: semanaAtual.reservas.map(function (r) { return r.nome; }),
    semanas: semanas,
    meus: meusHomeOffices_(c, u),
    souGestor: u.gestor,
    pessoas: u.gestor ? listarPessoasAtivas_().map(function (p) { return { email: p.email, nome: p.nomeExibicao, setor: p.setor }; }) : []
  };
}

/** Semanas de home office da pessoa: de 6 meses atrás até o futuro, por mês (cartão "Seus home offices"). */
function meusHomeOffices_(c, u) {
  var limite = new Date(c.hoje.getFullYear(), c.hoje.getMonth() - 6, 1);
  var semanaAtual = inicioDaSemana_(c.hoje);
  var minhas = c.reservas.filter(function (x) { return x.email === u.email && x.inicio.getTime() >= limite.getTime(); })
    .sort(function (a, b) { return a.inicio - b.inicio; });
  var meses = [];
  minhas.forEach(function (x) {
    var chave = formatarDataIso_(x.inicio).substring(0, 7);
    var mes = meses[meses.length - 1];
    if (!mes || mes.chave !== chave) {
      mes = { chave: chave, titulo: MESES[x.inicio.getMonth()] + ' de ' + x.inicio.getFullYear(), semanas: [] };
      meses.push(mes);
    }
    mes.semanas.push({
      id: x.id,
      titulo: tituloSemanaHO_(x.inicio, x.fim),
      situacao: x.inicio.getTime() < semanaAtual.getTime() ? 'passada' : (x.inicio.getTime() === semanaAtual.getTime() ? 'atual' : 'reservada')
    });
  });
  return {
    desde: MESES[limite.getMonth()].toLowerCase() + ' de ' + limite.getFullYear(),
    passadas: minhas.filter(function (x) { return x.inicio.getTime() < semanaAtual.getTime(); }).length,
    futuras: minhas.filter(function (x) { return x.inicio.getTime() >= semanaAtual.getTime(); }).length,
    meses: meses
  };
}

function contextoHomeOffice_() {
  var pessoas = mapaPessoas_();
  return {
    pessoas: pessoas,
    lista: Object.keys(pessoas).map(function (e) { return pessoas[e]; }),
    // todas as reservas (passado e futuro): a fila depende do histórico inteiro
    reservas: listarLancamentos_({ tipos: [TIPO.HOME_OFFICE], status: [STATUS.ATIVO] }),
    ferias: listarLancamentos_({ tipos: [TIPO.FERIAS], status: [STATUS.APROVADA, STATUS.ENCAMINHADA] }),
    bloqueios: listarBloqueios_(),
    pulos: lerAba_(ABA_FILA_HO).map(function (l) {
      return { email: normalizarEmail_(l['E-mail']), tipo: String(l['Tipo'] || '').trim(), semana: paraData_(l['Semana']), registradoEm: l['Registrado em'] instanceof Date ? l['Registrado em'] : null };
    }).filter(function (p) { return p.email && p.tipo === 'PULOU'; }),
    hoje: hoje_(),
    vagas: obterConfigNumero('VAGAS_HOME_OFFICE') || 1,
    foraDaFila: listaEmails_(obterConfig('HO_FORA_DA_FILA'))
  };
}

function reservasDaSemana_(reservas, segunda) {
  return reservas.filter(function (x) { return mesmoDia_(x.inicio, segunda); });
}

function presencialNaSemana_(bloqueios, segunda, sexta) {
  return bloqueios.filter(function (b) {
    return b.tipo === BLOQUEIO.SEMANA_PRESENCIAL && b.inicio.getTime() <= sexta.getTime() && b.fim.getTime() >= segunda.getTime();
  });
}

function montarSemanaHO_(segunda, c, u) {
  var sexta = adicionarDias_(segunda, 4);
  var reservas = reservasDaSemana_(c.reservas, segunda).map(function (x) {
    var p = c.pessoas[x.email];
    return {
      id: x.id, email: x.email, nome: nomeDe_(c.pessoas, x.email), setor: p ? p.setor : '',
      minha: x.email === u.email,
      reservadaEm: x.criadoEm ? formatarDataHoraBr_(x.criadoEm) : '',
      importada: /importado/i.test(x.observacao)
    };
  });
  var presencial = presencialNaSemana_(c.bloqueios, segunda, sexta);
  var feriados = c.bloqueios.filter(function (b) {
    return b.tipo === BLOQUEIO.FERIADO && b.inicio.getTime() <= sexta.getTime() && b.fim.getTime() >= segunda.getTime();
  });
  return {
    inicio: formatarDataIso_(segunda),
    fim: formatarDataIso_(sexta),
    titulo: tituloSemanaHO_(segunda, sexta),
    atual: segunda.getTime() === inicioDaSemana_(c.hoje).getTime(),
    passada: sexta.getTime() < c.hoje.getTime(),
    presencial: presencial.length > 0,
    presencialDescricao: presencial.map(function (b) { return b.descricao || 'Semana presencial'; }).join('; '),
    feriados: feriados.map(function (b) { return formatarDataBr_(b.inicio).substring(0, 5) + (b.descricao ? ' ' + b.descricao.replace(/\s*\(importado\)\s*$/i, '') : ''); }),
    reservas: reservas,
    vagas: c.vagas,
    problema: reservas.length > c.vagas ? reservas.length + ' pessoas para ' + c.vagas + ' vaga' + (c.vagas === 1 ? '' : 's') : '',
    minha: reservas.some(function (r) { return r.minha; })
  };
}

function tituloSemanaHO_(seg, sex) {
  var d = function (x) { return ('0' + x.getDate()).slice(-2) + '/' + ('0' + (x.getMonth() + 1)).slice(-2); };
  return d(seg) + ' a ' + d(sex);
}

/**
 * Situação de cada pessoa da equipe na "rodada" atual (sem ordem: a equipe não segue ordem fixa).
 * Rodada = número de vezes que cada um já usou (semanas de home office, passadas ou reservadas) ou pulou.
 * Quem tem o maior número "já usou nesta rodada"; os demais "ainda não usaram".
 * Fora da fila: gestor e os e-mails em Config > HO_FORA_DA_FILA (pessoas que já trabalham em home office).
 * @param {Date} semanaRef segunda-feira usada para saber quem está de férias
 */
function situacaoFilaHO_(c, semanaRef) {
  var sexta = adicionarDias_(semanaRef, 4);
  var membros = c.lista.filter(function (p) { return p.ativo && p.perfil !== PERFIL.GESTOR && c.foraDaFila.indexOf(p.email) < 0; });
  var itens = membros.map(function (p) {
    var reservas = c.reservas.filter(function (x) { return x.email === p.email; }).map(function (x) { return x.inicio; })
      .sort(function (a, b) { return a - b; });
    var pulos = c.pulos.filter(function (x) { return x.email === p.email; }).map(function (x) { return x.semana || x.registradoEm; }).filter(function (d) { return d; });
    var passadas = reservas.filter(function (d) { return d.getTime() < inicioDaSemana_(c.hoje).getTime(); });
    var futuras = reservas.filter(function (d) { return d.getTime() >= inicioDaSemana_(c.hoje).getTime(); });
    return {
      email: p.email, nome: p.nomeExibicao,
      usos: reservas.length + pulos.length,
      ultimaUsada: passadas.length ? passadas[passadas.length - 1] : null,
      proximaReserva: futuras.length ? futuras[0] : null,
      ultimoPulo: pulos.length ? new Date(Math.max.apply(null, pulos.map(function (d) { return d.getTime(); }))) : null,
      deFerias: estaDeFerias_(c.ferias, p.email, semanaRef, sexta)
    };
  });
  var max = itens.reduce(function (m, x) { return Math.max(m, x.usos); }, 0);
  itens.forEach(function (x) {
    if (x.proximaReserva) x.grupo = 'reservado';
    else if (max > 0 && x.usos >= max) x.grupo = 'usou';
    else x.grupo = 'falta';
  });
  return { itens: itens, max: max };
}

/** Fila para a tela: três grupos (reservado, já usou, ainda não usou), sem ordem. */
function montarFilaHO_(c, semanaRef, u) {
  var sit = situacaoFilaHO_(c, semanaRef);
  var porNome = function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); };
  var grupo = function (nome) {
    return sit.itens.filter(function (x) { return x.grupo === nome; }).sort(porNome).map(function (x) {
      var detalhe = '';
      if (x.grupo === 'reservado') detalhe = tituloSemanaHO_(x.proximaReserva, adicionarDias_(x.proximaReserva, 4));
      else if (x.grupo === 'usou') {
        if (x.ultimoPulo && (!x.ultimaUsada || x.ultimoPulo.getTime() > x.ultimaUsada.getTime())) detalhe = 'pulou em ' + formatarDataBr_(x.ultimoPulo).substring(0, 5);
        else if (x.ultimaUsada) detalhe = tituloSemanaHO_(x.ultimaUsada, adicionarDias_(x.ultimaUsada, 4));
      } else if (x.deFerias) detalhe = 'de férias';
      return { email: x.email, nome: x.nome, minha: x.email === u.email, detalhe: detalhe };
    });
  };
  return { reservado: grupo('reservado'), usou: grupo('usou'), falta: grupo('falta') };
}

/** Quem ainda não usou nesta rodada (e não está de férias na semana), se a pessoa já usou a dela. */
function quemFaltaUsar_(email, segunda, c, reservasSimuladas, pulosSimulados) {
  var ctx = { lista: c.lista, reservas: reservasSimuladas, ferias: c.ferias, pulos: pulosSimulados, hoje: c.hoje, foraDaFila: c.foraDaFila };
  var sit = situacaoFilaHO_(ctx, segunda);
  var eu = sit.itens.filter(function (x) { return x.email === email; })[0];
  if (!eu || sit.max === 0 || eu.usos < sit.max) return [];
  return sit.itens.filter(function (x) { return x.email !== email && x.usos < sit.max && !x.deFerias; });
}

/**
 * Salva um lote de mudanças no home office.
 * @param {Object} dados {reservar: [{semana: "yyyy-MM-dd" (qualquer dia da semana), email?: string}], cancelar: [id]}
 * @param {boolean} confirmado true quando o usuário clicou em "Salvar mesmo assim"
 * Avisos de RESERVAR pedem confirmação; de CANCELAR só ficam registrados (mesma decisão dos sábados).
 */
function salvarHomeOffice(dados, confirmado) {
  var u = exigirUsuario_();
  dados = dados || {};

  var reservar = (dados.reservar || []).map(function (e) {
    var data = paraData_(e.semana);
    if (!data) throw new Error('Semana inválida: ' + e.semana);
    var email = e.email ? normalizarEmail_(e.email) : u.email;
    if (email !== u.email && !u.gestor) throw new Error('Só o gestor pode reservar para outra pessoa.');
    return { segunda: inicioDaSemana_(data), email: email };
  });
  var idsCancelar = (dados.cancelar || []).map(String);
  if (!reservar.length && !idsCancelar.length) throw new Error('Nada para salvar.');

  var c = contextoHomeOffice_();
  reservar.forEach(function (e) {
    var p = c.pessoas[e.email];
    if (!p || !p.ativo) throw new Error('Pessoa não encontrada no cadastro: ' + e.email);
  });

  var cancelar = [];
  idsCancelar.forEach(function (id) {
    var lanc = c.reservas.filter(function (x) { return x.id === id; })[0];
    if (!lanc) {
      var qualquer = listarLancamentos_({ tipos: [TIPO.HOME_OFFICE] }).filter(function (x) { return x.id === id; })[0];
      if (!qualquer) throw new Error('Reserva não encontrada (' + id + ').');
      return; // já cancelada
    }
    if (lanc.email !== u.email && !u.gestor) throw new Error('Só o gestor pode cancelar a reserva de outra pessoa.');
    cancelar.push(lanc);
  });

  var idsSaindo = {};
  cancelar.forEach(function (l) { idsSaindo[l.id] = true; });
  var simuladas = c.reservas.filter(function (x) { return !idsSaindo[x.id]; });

  var avisosReservar = [], avisosCancelar = [];
  cancelar.forEach(function (l) {
    var dataBr = tituloSemanaHO_(l.inicio, adicionarDias_(l.inicio, 4));
    if (l.inicio.getTime() < inicioDaSemana_(c.hoje).getTime()) {
      avisosCancelar.push(aviso_('HO_PASSADO', 'Semana ' + dataBr + ' já passou', 'Cancelar altera o registro do que aconteceu.'));
    }
  });

  reservar.forEach(function (e) {
    var seg = e.segunda, sex = adicionarDias_(seg, 4);
    var dataBr = tituloSemanaHO_(seg, sex);
    var pessoa = c.pessoas[e.email];
    var nomeAlvo = e.email === u.email ? 'Você' : pessoa.nomeExibicao;
    var naSemana = reservasDaSemana_(simuladas, seg);
    if (naSemana.some(function (x) { return x.email === e.email; })) {
      throw new Error(nomeAlvo + ' já tem home office na semana ' + dataBr + '.');
    }
    if (naSemana.length >= c.vagas) {
      var quem = naSemana.map(function (x) {
        return nomeDe_(c.pessoas, x.email) + (x.criadoEm ? ', reservada em ' + formatarDataHoraBr_(x.criadoEm).replace(' ', ' às ') : '');
      }).join('; ');
      avisosReservar.push(aviso_('HO_SEMANA_OCUPADA', 'Semana ' + dataBr + ' já está reservada', 'Esta semana já é de ' + quem + '. São ' + c.vagas + ' vaga' + (c.vagas === 1 ? '' : 's') + ' por semana na equipe.'));
    }
    var presencial = presencialNaSemana_(c.bloqueios, seg, sex);
    if (presencial.length) {
      avisosReservar.push(aviso_('HO_PRESENCIAL', 'Semana ' + dataBr + ' é presencial', (presencial[0].descricao || 'Definida pelo gestor') + '. Reservar gera aviso.'));
    }
    if (seg.getTime() < inicioDaSemana_(c.hoje).getTime()) {
      avisosReservar.push(aviso_('HO_PASSADO', 'Semana ' + dataBr + ' já passou', 'O lançamento vale como registro do que aconteceu.'));
    }
    if (estaDeFerias_(c.ferias, e.email, seg, sex)) {
      avisosReservar.push(aviso_('HO_FERIAS', nomeAlvo + ' está de férias nessa semana', 'Há férias aprovadas cobrindo ' + dataBr + '.'));
    }
    var faltam = quemFaltaUsar_(e.email, seg, c, simuladas, c.pulos);
    if (faltam.length) {
      avisosReservar.push(aviso_('HO_FORA_DA_VEZ', (e.email === u.email ? 'Você' : pessoa.nomeExibicao) + ' já usou nesta rodada',
        (faltam.length === 1 ? 'Ainda falta usar: ' : 'Ainda faltam usar: ') + faltam.map(function (x) { return x.nome; }).join(', ') + '.'));
    }
    simuladas.push({ id: '', tipo: TIPO.HOME_OFFICE, email: e.email, inicio: seg, fim: sex, status: STATUS.ATIVO, criadoEm: new Date(), observacao: '' });
  });

  if (avisosReservar.length && !confirmado) return respostaComAvisos_(avisosReservar);

  var criados = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // vale quem gravou primeiro: dentro do lock, confere de novo se a semana continua livre e avisa no retorno
    cancelar.forEach(function (l) { atualizarLancamento_(l.id, { 'Status': STATUS.CANCELADO }); });
    reservar.forEach(function (e) {
      criados.push(criarLancamento_({ tipo: TIPO.HOME_OFFICE, email: e.email, inicio: e.segunda, fim: adicionarDias_(e.segunda, 4) }, u));
    });
  } finally {
    lock.releaseLock();
  }

  registrarAvisosIgnorados_(u, criados.length ? criados[0].id : '', avisosReservar);
  registrarAvisosIgnorados_(u, cancelar.length ? cancelar[0].id : '', avisosCancelar);

  cancelar.forEach(function (l) { if (l.idEvento) removerEvento_(l.idEvento, 'salvarHomeOffice'); });
  criados.forEach(function (lanc) {
    var idEvento = criarEventoHomeOffice_(lanc, c.pessoas[lanc.email]);
    if (idEvento) atualizarLancamento_(lanc.id, { 'ID evento agenda': idEvento });
  });

  var porPessoa = {};
  criados.forEach(function (lanc) {
    if (lanc.email === u.email) return;
    (porPessoa[lanc.email] = porPessoa[lanc.email] || []).push(lanc);
  });
  Object.keys(porPessoa).forEach(function (email) {
    var p = c.pessoas[email];
    var itens = porPessoa[email].map(function (lanc) { return '<li><strong>' + tituloSemanaHO_(lanc.inicio, lanc.fim) + '</strong></li>'; }).join('');
    enviarEmail_({
      para: email,
      assunto: 'Home office reservado para você',
      corpoHtml: '<p>Olá, ' + escaparHtml_(p.nomeExibicao) + '.</p>' +
        '<p>' + escaparHtml_(u.nomeExibicao) + ' reservou home office para você:</p><ul>' + itens + '</ul>' +
        '<p><a href="' + urlDoApp_() + '?tela=homeoffice">Abrir a escala</a></p>',
      origem: 'salvarHomeOffice'
    });
  });

  return { ok: true, reservadas: criados.length, canceladas: cancelar.length, avisosIgnorados: avisosReservar.length + avisosCancelar.length };
}

/** "Pular minha vez": registra em FilaHO e a pessoa vai para o fim da fila da equipe. */
function pularVezHomeOffice() {
  var u = exigirUsuario_();
  if (u.gestor) throw new Error('O gestor não entra na fila de home office.');
  if (listaEmails_(obterConfig('HO_FORA_DA_FILA')).indexOf(u.email) >= 0) throw new Error('Você não está na fila de home office.');
  var agora = new Date();
  anexarLinha_(ABA_FILA_HO, {
    'E-mail': u.email, 'Setor': u.setor, 'Tipo': 'PULOU',
    'Semana': inicioDaSemana_(hoje_()), 'Registrado em': agora
  });
  return { ok: true, fila: montarFilaHO_(contextoHomeOffice_(), inicioDaSemana_(hoje_()), u) };
}

function criarEventoHomeOffice_(lanc, pessoa) {
  try {
    return criarEvento_({
      titulo: 'Home office – ' + pessoa.nomeExibicao,
      inicio: lanc.inicio,
      fim: lanc.fim,
      diaInteiro: true,
      descricao: 'Semana de home office. Lançado pelo Escala Suporte.',
      convidados: [pessoa.email],
      origem: 'salvarHomeOffice'
    });
  } catch (e) {
    registrarNotificacao_('EVENTO', 'salvarHomeOffice', pessoa.email, '', 'Home office ' + formatarDataBr_(lanc.inicio), 'ERRO: ' + e.message);
    return '';
  }
}
