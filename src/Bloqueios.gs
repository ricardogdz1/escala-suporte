/**
 * Bloqueios do calendário gravados pelo gestor na própria tela:
 * sábado de treinamento da equipe, feriado (obrigatório ou facultativo) e semana presencial.
 *
 * Leitura e helpers ficam em Lancamentos.gs; aqui está só a gravação.
 * Regra do projeto: nada bloqueia de verdade — um sábado "de treinamento" apenas
 * deixa de cobrar mínimo/máximo e avisa quem se escalar nele.
 */

/** Um bloqueio de um dia só, do tipo indicado (ou null). */
function bloqueioDoDia_(data, tipo) {
  return listarBloqueios_(data, data).filter(function (b) {
    return b.tipo === tipo && dentroDe_(data, b.inicio, b.fim);
  })[0] || null;
}

/**
 * Marca ou desmarca um sábado como treinamento da equipe (só gestor).
 * @param {Object} dados {data: "yyyy-MM-dd", marcar: boolean, descricao?: string}
 * @return {Object} {ok, marcado, descricao}
 */
function definirTreinamentoDoSabado(dados) {
  var u = exigirGestor_();
  dados = dados || {};
  var data = paraData_(dados.data);
  if (!data || !ehSabado_(data)) throw new Error('Escolha um sábado.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var atual = bloqueioDoDia_(data, BLOQUEIO.TREINAMENTO);
    if (dados.marcar) {
      var descricao = String(dados.descricao || '').trim().substring(0, 200) || 'Treinamento com toda a equipe';
      if (atual) {
        // um treinamento que veio da importação pode cobrir vários dias: não mexe no período, só no texto
        atualizarLinha_(ABA_BLOQUEIOS, atual._linha, { 'Descrição': descricao });
      } else {
        anexarLinha_(ABA_BLOQUEIOS, {
          'ID': gerarId_(), 'Tipo': BLOQUEIO.TREINAMENTO,
          'Data início': data, 'Data fim': data, 'Descrição': descricao
        });
      }
      registrarNotificacao_('BLOQUEIO', 'definirTreinamentoDoSabado', '', '',
        'Treinamento em ' + formatarDataBr_(data), 'marcado por ' + u.email);
      return { ok: true, marcado: true, descricao: descricao };
    }

    if (!atual) return { ok: true, marcado: false };
    if (!mesmoDia_(atual.inicio, atual.fim)) {
      throw new Error('Esse treinamento cobre de ' + formatarDataBr_(atual.inicio) + ' a ' + formatarDataBr_(atual.fim) +
        '. Ajuste o período na aba Bloqueios da planilha.');
    }
    apagarLinha_(ABA_BLOQUEIOS, atual._linha);
    registrarNotificacao_('BLOQUEIO', 'definirTreinamentoDoSabado', '', '',
      'Treinamento em ' + formatarDataBr_(data), 'removido por ' + u.email);
    return { ok: true, marcado: false };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Marca, troca ou remove o feriado de um dia (só gestor).
 * Os dois tipos dispensam escala de meio-dia e plantão; o facultativo existe para
 * o gestor separar o que é feriado de verdade do que é ponto facultativo.
 * @param {Object} dados {data: "yyyy-MM-dd", tipo: 'FERIADO'|'FERIADO_FACULTATIVO'|'' (remover), descricao?: string}
 */
function definirFeriado(dados) {
  var u = exigirGestor_();
  dados = dados || {};
  var data = paraData_(dados.data);
  if (!data) throw new Error('Data inválida.');
  var tipo = String(dados.tipo || '').trim();
  if (tipo && tipo !== BLOQUEIO.FERIADO && tipo !== BLOQUEIO.FERIADO_FACULTATIVO) {
    throw new Error('Tipo de feriado inválido: ' + tipo);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var atuais = listarBloqueios_(data, data).filter(function (b) {
      return ehTipoFeriado_(b) && dentroDe_(data, b.inicio, b.fim);
    });
    var variosDias = atuais.filter(function (b) { return !mesmoDia_(b.inicio, b.fim); })[0];
    if (variosDias) {
      throw new Error('Esse feriado cobre de ' + formatarDataBr_(variosDias.inicio) + ' a ' + formatarDataBr_(variosDias.fim) +
        '. Ajuste o período na aba Bloqueios da planilha.');
    }

    var descricao = String(dados.descricao || '').trim().substring(0, 200);
    if (!tipo) {
      // de baixo para cima: apagar uma linha move as seguintes
      atuais.map(function (b) { return b._linha; })
        .sort(function (a, b) { return b - a; })
        .forEach(function (linha) { apagarLinha_(ABA_BLOQUEIOS, linha); });
      registrarNotificacao_('BLOQUEIO', 'definirFeriado', '', '', 'Feriado em ' + formatarDataBr_(data), 'removido por ' + u.email);
      return { ok: true, tipo: '', descricao: '' };
    }

    if (atuais.length) {
      atualizarLinha_(ABA_BLOQUEIOS, atuais[0]._linha, { 'Tipo': tipo, 'Descrição': descricao });
      atuais.slice(1).map(function (b) { return b._linha; })
        .sort(function (a, b) { return b - a; })
        .forEach(function (linha) { apagarLinha_(ABA_BLOQUEIOS, linha); });
    } else {
      anexarLinha_(ABA_BLOQUEIOS, {
        'ID': gerarId_(), 'Tipo': tipo,
        'Data início': data, 'Data fim': data, 'Descrição': descricao
      });
    }
    registrarNotificacao_('BLOQUEIO', 'definirFeriado', '', '',
      (tipo === BLOQUEIO.FERIADO ? 'Feriado' : 'Feriado facultativo') + ' em ' + formatarDataBr_(data), 'salvo por ' + u.email);
    return { ok: true, tipo: tipo, descricao: descricao };
  } finally {
    lock.releaseLock();
  }
}
