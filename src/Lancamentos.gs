/**
 * Leitura e gravação da aba Lancamentos e da aba Bloqueios.
 * Cada lançamento vira um objeto com datas já convertidas para Date.
 */

/**
 * Turno como está na célula -> código de TURNO.
 * Aceita "8h-11h", "8-11", "8–11", "(11:00)" e também Date (célula "8-11" que o Planilhas
 * converteu em 11/08): mês 8 dia 11 = 8h-11h, mês 9 dia 12 = 9h-12h.
 */
function normalizarTurno_(valor) {
  if (valor instanceof Date) {
    var m = valor.getMonth() + 1, d = valor.getDate();
    if (m === 8 && d === 11) return TURNO.T8_11;
    if (m === 9 && d === 12) return TURNO.T9_12;
    return '';
  }
  var t = String(valor || '').trim().toLowerCase().replace(/\s/g, '');
  if (!t) return '';
  if (/^8h?[-–]11h?$|11:00/.test(t)) return TURNO.T8_11;
  if (/^9h?[-–]12h?$|12:00/.test(t)) return TURNO.T9_12;
  return t;
}

/** Linha da planilha -> objeto de lançamento. */
function lancamentoDaLinha_(l) {
  return {
    id: String(l['ID'] || ''),
    tipo: String(l['Tipo'] || '').trim(),
    email: normalizarEmail_(l['E-mail']),
    inicio: paraData_(l['Data início']),
    fim: paraData_(l['Data fim']) || paraData_(l['Data início']),
    turno: normalizarTurno_(l['Turno']),
    status: String(l['Status'] || '').trim().toLowerCase(),
    criadoPor: normalizarEmail_(l['Criado por']),
    criadoEm: l['Criado em'] instanceof Date ? l['Criado em'] : null,
    atualizadoEm: l['Atualizado em'] instanceof Date ? l['Atualizado em'] : null,
    idEvento: String(l['ID evento agenda'] || ''),
    observacao: String(l['Observação'] || ''),
    treinamento: ehSim_(l['Em treinamento']), // sábado: a pessoa está no dia mas em treinamento (não atende)
    _linha: l._linha
  };
}

/**
 * Lista lançamentos.
 * @param {Object} f  filtro opcional: {tipos: [], status: [], de: Date, ate: Date, email: string}
 *   de/ate: retorna lançamentos que tocam o intervalo (não precisam caber inteiros nele).
 */
function listarLancamentos_(f) {
  f = f || {};
  return lerAba_(ABA_LANCAMENTOS)
    .map(lancamentoDaLinha_)
    .filter(function (x) {
      if (!x.inicio) return false;
      if (f.tipos && f.tipos.indexOf(x.tipo) < 0) return false;
      if (f.status && f.status.indexOf(x.status) < 0) return false;
      if (f.email && x.email !== normalizarEmail_(f.email)) return false;
      if (f.de && x.fim.getTime() < f.de.getTime()) return false;
      if (f.ate && x.inicio.getTime() > f.ate.getTime()) return false;
      return true;
    });
}

/** Status que contam como "valendo" para efeito de escala. */
function statusValendo_(tipo) {
  if (tipo === TIPO.FERIAS) return [STATUS.APROVADA, STATUS.ENCAMINHADA];
  return [STATUS.ATIVO];
}

/** Lançamentos que valem (não cancelados; férias só aprovadas/encaminhadas) num intervalo. */
function listarLancamentosValendo_(de, ate) {
  return listarLancamentos_({ de: de, ate: ate }).filter(function (x) {
    return statusValendo_(x.tipo).indexOf(x.status) >= 0;
  });
}

/** Grava um lançamento novo. Retorna o objeto criado (com id). */
function criarLancamento_(dados, usuario) {
  var agora = new Date();
  var obj = {
    'ID': gerarId_(),
    'Tipo': dados.tipo,
    'E-mail': normalizarEmail_(dados.email),
    'Data início': dados.inicio,
    'Data fim': dados.fim || dados.inicio,
    'Turno': dados.turno || '',
    'Status': dados.status || STATUS.ATIVO,
    'Criado por': usuario.email,
    'Criado em': agora,
    'Atualizado em': agora,
    'ID evento agenda': dados.idEvento || '',
    'Observação': dados.observacao || '',
    'Em treinamento': dados.treinamento ? 'Sim' : 'Não'
  };
  var linha = anexarLinha_(ABA_LANCAMENTOS, obj);
  obj._linha = linha;
  return lancamentoDaLinha_(obj);
}

/** Atualiza campos de um lançamento existente (por ID). */
function atualizarLancamento_(id, campos) {
  var atual = listarLancamentos_().filter(function (x) { return x.id === id; })[0];
  if (!atual) throw new Error('Lançamento não encontrado: ' + id);
  campos['Atualizado em'] = new Date();
  atualizarLinha_(ABA_LANCAMENTOS, atual._linha, campos);
  return atual;
}

// ---------- Bloqueios ----------

function listarBloqueios_(de, ate) {
  return lerAba_(ABA_BLOQUEIOS)
    .map(function (l) {
      var inicio = paraData_(l['Data início']);
      return {
        id: String(l['ID'] || ''),
        tipo: String(l['Tipo'] || '').trim(),
        inicio: inicio,
        fim: paraData_(l['Data fim']) || inicio,
        descricao: String(l['Descrição'] || ''),
        _linha: l._linha
      };
    })
    .filter(function (b) {
      if (!b.inicio) return false;
      if (de && b.fim.getTime() < de.getTime()) return false;
      if (ate && b.inicio.getTime() > ate.getTime()) return false;
      return true;
    });
}

/**
 * Texto de exibição de um bloqueio. TREINAMENTO aparece sempre como "TREINAMENTO" (caixa alta);
 * os demais usam a descrição (sem a marca "(importado)") ou o tipo.
 */
function tituloBloqueio_(b) {
  if (b.tipo === BLOQUEIO.TREINAMENTO) return 'TREINAMENTO';
  var d = String(b.descricao || '').replace(/\s*\(importado\)\s*$/i, '').trim();
  if (d) return d;
  if (b.tipo === BLOQUEIO.FERIADO) return 'Feriado';
  return b.tipo;
}

function bloqueiosDoDia_(bloqueios, data) {
  return bloqueios.filter(function (b) { return dentroDe_(data, b.inicio, b.fim); });
}

function ehFeriado_(bloqueios, data) {
  return bloqueiosDoDia_(bloqueios, data).some(function (b) { return b.tipo === BLOQUEIO.FERIADO; });
}
