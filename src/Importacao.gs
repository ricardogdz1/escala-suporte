/**
 * Importação da planilha antiga do gestor (ver referencia/LEIA-ME.md).
 *
 * Pré-requisitos:
 *  1. A planilha antiga convertida para Planilha Google no Drive e seu ID em Config > ID_PLANILHA_ANTIGA.
 *  2. setup() rodado (cria a aba MapaNomes).
 *
 * Passos:
 *  - importarPrevia(): lê tudo, NÃO grava lançamentos; escreve a aba RelatorioImportacao com
 *    nomes não reconhecidos, contagens e ocorrências estranhas. Preencha MapaNomes e rode de novo.
 *  - importarDefinitivo(): grava em Lancamentos, Bloqueios e SaldoFerias (Observação = "importado").
 *    Não duplica o que já existe; pode rodar mais de uma vez.
 *  - apagarImportacao(): remove tudo que foi importado.
 */

var MARCA_IMPORTADO = 'importado';
var MAPA_IGNORAR = 'IGNORAR';

// Nomes das abas na planilha antiga (comparados sem acento e sem maiúsculas)
var ABAS_ANTIGAS = {
  sabados: 'Sábados',
  feriasAba: 'Férias',
  meioDia: 'Plantão Meio dia',
  homeOffice: 'HomeOffice',
  plantoes: 'Plantões 2026'
};

function importarPrevia() {
  var r = executarImportacao_(false);
  Logger.log(r.resumo.join('\n'));
}

function importarDefinitivo() {
  var r = executarImportacao_(true);
  Logger.log(r.resumo.join('\n'));
}

function apagarImportacao() {
  var total = 0;
  total += apagarLinhasOnde_(ABA_LANCAMENTOS, 'Observação', MARCA_IMPORTADO);
  total += apagarLinhasOnde_(ABA_BLOQUEIOS, 'Descrição', MARCA_IMPORTADO);
  total += apagarLinhasOnde_(ABA_SALDO_FERIAS, 'Período aquisitivo', MARCA_IMPORTADO);
  Logger.log('Apagadas ' + total + ' linhas importadas.');
}

// ---------- Núcleo ----------

function executarImportacao_(gravar) {
  var id = String(obterConfig('ID_PLANILHA_ANTIGA')).trim();
  if (!id) throw new Error('Preencha Config > ID_PLANILHA_ANTIGA com o ID da planilha antiga (convertida para Planilha Google).');
  var antiga = SpreadsheetApp.openById(id);

  var ctx = {
    gravar: gravar,
    dataInicio: paraData_(obterConfig('DATA_INICIO_IMPORTACAO')) || new Date(2026, 0, 1),
    resolvedor: criarResolvedorDeNomes_(),
    lancamentos: [],   // {tipo, email, inicio, fim, turno, status}
    bloqueios: {},     // chave tipo|inicio|fim -> {tipo, inicio, fim, descricao}
    saldos: [],        // {email, saldoInicial, limite}
    relatorio: [],     // [secao, item, detalhe]
    contagem: {}
  };

  importarSabados_(abaAntiga_(antiga, ABAS_ANTIGAS.sabados), ctx);
  importarPlantoes_(abaAntiga_(antiga, ABAS_ANTIGAS.plantoes), ctx);
  importarHomeOffice_(abaAntiga_(antiga, ABAS_ANTIGAS.homeOffice), ctx);
  importarMeioDia_(abaAntiga_(antiga, ABAS_ANTIGAS.meioDia), ctx);
  importarFerias_(abaAntiga_(antiga, ABAS_ANTIGAS.feriasAba), ctx);

  var naoMapeados = ctx.resolvedor.naoMapeados();
  naoMapeados.forEach(function (n) {
    ctx.relatorio.push(['Nomes não reconhecidos', n.nome, 'aparece em: ' + n.abas.join(', ') + ' — preencha MapaNomes (e-mail ou IGNORAR)']);
  });

  var resumo = ['Lançamentos: ' + ctx.lancamentos.length, 'Bloqueios: ' + Object.keys(ctx.bloqueios).length,
    'Saldos de férias: ' + ctx.saldos.length, 'Nomes não reconhecidos: ' + naoMapeados.length];
  Object.keys(ctx.contagem).sort().forEach(function (k) { resumo.push('  ' + k + ': ' + ctx.contagem[k]); });

  var gravados = null;
  if (gravar) {
    if (naoMapeados.length) {
      throw new Error('Há ' + naoMapeados.length + ' nome(s) não reconhecido(s). Veja a aba ' +
        ABA_RELATORIO_IMPORTACAO + ', preencha MapaNomes e rode importarPrevia() de novo.');
    }
    gravados = gravarImportacao_(ctx);
    resumo.push('GRAVADO: ' + gravados.lancamentos + ' lançamentos, ' + gravados.bloqueios + ' bloqueios, ' +
      gravados.saldos + ' saldos (' + gravados.ignorados + ' já existiam)');
  } else {
    resumo.push('PRÉVIA: nada foi gravado. Confira a aba ' + ABA_RELATORIO_IMPORTACAO + '.');
  }

  escreverRelatorio_(ctx, resumo);
  return { resumo: resumo };
}

function abaAntiga_(ss, nome) {
  var alvo = semAcentos_(nome);
  var aba = ss.getSheets().filter(function (s) { return semAcentos_(s.getName()) === alvo; })[0];
  if (!aba) throw new Error('Aba "' + nome + '" não encontrada na planilha antiga.');
  return aba;
}

function contar_(ctx, chave) {
  ctx.contagem[chave] = (ctx.contagem[chave] || 0) + 1;
}

function adicionarLancamento_(ctx, l) {
  if (!l.inicio) return;
  l.fim = l.fim || l.inicio;
  if (l.fim.getTime() < ctx.dataInicio.getTime()) return;   // terminou antes do corte
  ctx.lancamentos.push(l);
  contar_(ctx, l.tipo);
}

function adicionarBloqueio_(ctx, tipo, inicio, fim, descricao) {
  if (!inicio) return;
  fim = fim || inicio;
  if (fim.getTime() < ctx.dataInicio.getTime()) return;
  var chave = tipo + '|' + formatarDataIso_(inicio) + '|' + formatarDataIso_(fim);
  var atual = ctx.bloqueios[chave];
  if (!atual) {
    ctx.bloqueios[chave] = { tipo: tipo, inicio: inicio, fim: fim, descricoes: [] };
    atual = ctx.bloqueios[chave];
    contar_(ctx, 'BLOQUEIO_' + tipo);
  }
  descricao = String(descricao || '').trim();
  if (descricao && atual.descricoes.indexOf(descricao) < 0) atual.descricoes.push(descricao);
}

// ---------- Leitura de grades "pessoas × datas" ----------

/** Lê a matriz inteira da aba (valores) e devolve {cabecalho, linhasPessoas:[{nome, linha, valores}]}. */
function lerGrade_(aba, linhaCabecalho, primeiraLinhaPessoa) {
  var valores = aba.getDataRange().getValues();
  var cabecalho = valores[linhaCabecalho - 1] || [];
  var pessoas = [];
  var vaziasSeguidas = 0;
  for (var i = primeiraLinhaPessoa - 1; i < valores.length; i++) {
    var nome = String(valores[i][0] || '').trim();
    if (!nome) {                                        // linhas em branco no meio da lista existem
      if (++vaziasSeguidas >= 5) break;                 // fim do bloco de pessoas
      continue;
    }
    vaziasSeguidas = 0;
    if (/^qtd/i.test(nome) || /^total/i.test(nome)) break;
    pessoas.push({ nome: nome, linha: i + 1, valores: valores[i] });
  }
  return { cabecalho: cabecalho, pessoas: pessoas };
}

/** Interpreta o cabeçalho de coluna do sábado: Date ou "dd/MM/yyyy (11:00)". */
function cabecalhoSabado_(valor) {
  if (valor instanceof Date) return { data: paraData_(valor), turno: '' };
  var m = String(valor || '').match(/(\d{2})\/(\d{2})\/(\d{4})\s*\((\d{2}):\d{2}\)/);
  if (!m) return null;
  var data = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  var turno = m[4] === '11' ? TURNO.T8_11 : (m[4] === '12' ? TURNO.T9_12 : '');
  return { data: data, turno: turno };
}

function ehMarcaX_(v) {
  return /^x+$/i.test(String(v || '').trim());
}

function importarSabados_(aba, ctx) {
  var g = lerGrade_(aba, 1, 2);
  var colunas = g.cabecalho.map(cabecalhoSabado_);

  g.pessoas.forEach(function (p) {
    var email = ctx.resolvedor.resolver(p.nome, ABAS_ANTIGAS.sabados);
    for (var c = 1; c < colunas.length; c++) {
      var col = colunas[c];
      var v = String(p.valores[c] || '').trim();
      if (!col || !v || col.data.getTime() < ctx.dataInicio.getTime()) continue;

      if (ehMarcaX_(v)) {
        if (email && email !== MAPA_IGNORAR) {
          adicionarLancamento_(ctx, { tipo: TIPO.SABADO, email: email, inicio: col.data, turno: col.turno, status: STATUS.ATIVO });
          if (!col.turno) ctx.relatorio.push(['Sábado sem turno', p.nome + ' em ' + formatarDataBr_(col.data), 'coluna antiga sem "(11:00)/(12:00)"; importado sem turno']);
        }
      } else if (/^feriad/i.test(v)) {
        adicionarBloqueio_(ctx, BLOQUEIO.FERIADO, col.data, col.data, v);
      } else if (/^f[ée]rias/i.test(v)) {
        // férias vêm da aba Férias
      } else if (/^#/.test(v)) {
        ctx.relatorio.push(['Célula com erro', aba.getName() + ' linha ' + p.linha + ' (' + formatarDataBr_(col.data) + ')', v]);
      } else {
        adicionarBloqueio_(ctx, BLOQUEIO.TREINAMENTO, col.data, col.data, v);
      }
    }
  });
}

function importarPlantoes_(aba, ctx) {
  var g = lerGrade_(aba, 1, 2);
  g.pessoas.forEach(function (p) {
    var email = ctx.resolvedor.resolver(p.nome, ABAS_ANTIGAS.plantoes);
    for (var c = 1; c < g.cabecalho.length; c++) {
      var data = g.cabecalho[c] instanceof Date ? paraData_(g.cabecalho[c]) : null;
      var v = String(p.valores[c] || '').trim();
      if (!data || !v) continue;
      if (ehMarcaX_(v)) {
        if (email && email !== MAPA_IGNORAR) {
          adicionarLancamento_(ctx, { tipo: TIPO.PLANTAO, email: email, inicio: data, status: STATUS.ATIVO });
        }
      } else if (/^feriad/i.test(v)) {
        adicionarBloqueio_(ctx, BLOQUEIO.FERIADO, data, data, '');
      } else {
        ctx.relatorio.push(['Valor não reconhecido', aba.getName() + ' linha ' + p.linha + ' (' + formatarDataBr_(data) + ')', v]);
      }
    }
  });
}

function importarHomeOffice_(aba, ctx) {
  var g = lerGrade_(aba, 1, 2);
  var presenciais = {}; // segunda (iso) -> true

  g.pessoas.forEach(function (p) {
    var email = ctx.resolvedor.resolver(p.nome, ABAS_ANTIGAS.homeOffice);
    var porSemana = {}; // segunda iso -> {inicio, fim}
    for (var c = 1; c < g.cabecalho.length; c++) {
      var data = g.cabecalho[c] instanceof Date ? paraData_(g.cabecalho[c]) : null;
      var v = String(p.valores[c] || '').trim();
      if (!data || !v) continue;
      var segunda = inicioDaSemana_(data);
      var chave = formatarDataIso_(segunda);
      if (ehMarcaX_(v)) {
        if (!porSemana[chave]) porSemana[chave] = { inicio: data, fim: data };
        else if (data.getTime() > porSemana[chave].fim.getTime()) porSemana[chave].fim = data;
      } else if (/^presencial/i.test(v)) {
        presenciais[chave] = segunda;
      } else {
        ctx.relatorio.push(['Valor não reconhecido', aba.getName() + ' linha ' + p.linha + ' (' + formatarDataBr_(data) + ')', v]);
      }
    }
    if (email && email !== MAPA_IGNORAR) {
      Object.keys(porSemana).forEach(function (k) {
        adicionarLancamento_(ctx, { tipo: TIPO.HOME_OFFICE, email: email, inicio: porSemana[k].inicio, fim: porSemana[k].fim, status: STATUS.ATIVO });
      });
    }
  });

  Object.keys(presenciais).forEach(function (k) {
    var segunda = presenciais[k];
    adicionarBloqueio_(ctx, BLOQUEIO.SEMANA_PRESENCIAL, segunda, adicionarDias_(segunda, 4), 'Semana presencial');
  });
}

function importarMeioDia_(aba, ctx) {
  var segunda = paraData_(obterConfig('SEMANA_MEIO_DIA_IMPORTACAO')) || inicioDaSemana_(hoje_());
  segunda = inicioDaSemana_(segunda);
  var g = lerGrade_(aba, 1, 2);
  // colunas B..F = segunda..sexta (posições 1..5)
  g.pessoas.forEach(function (p) {
    var email = ctx.resolvedor.resolver(p.nome, ABAS_ANTIGAS.meioDia);
    if (!email || email === MAPA_IGNORAR) return;
    for (var d = 0; d < 5; d++) {
      if (ehMarcaX_(p.valores[d + 1])) {
        adicionarLancamento_(ctx, { tipo: TIPO.MEIO_DIA, email: email, inicio: adicionarDias_(segunda, d), status: STATUS.ATIVO });
      }
    }
  });
  ctx.relatorio.push(['Meio-dia', 'Semana aplicada', formatarDataBr_(segunda) + ' a ' + formatarDataBr_(adicionarDias_(segunda, 4))]);
}

function importarFerias_(aba, ctx) {
  var faixa = aba.getDataRange();
  var valores = faixa.getValues();
  var fundos = faixa.getBackgrounds();

  // Coletivas em M3:N3 (linha 3, colunas 13 e 14)
  var colIni = valores[2] && valores[2][12], colFim = valores[2] && valores[2][13];
  if (colIni instanceof Date && colFim instanceof Date) {
    adicionarBloqueio_(ctx, BLOQUEIO.FERIAS_COLETIVAS, paraData_(colIni), paraData_(colFim), 'Férias coletivas');
  }

  // Pessoas a partir da linha 5: A nome | B saldo | C limite | D-E período 1 | F-G período 2
  for (var i = 4; i < valores.length; i++) {
    var nome = String(valores[i][0] || '').trim();
    if (!nome) break;
    var email = ctx.resolvedor.resolver(nome, ABAS_ANTIGAS.feriasAba);
    if (!email || email === MAPA_IGNORAR) continue;

    var saldo = Number(valores[i][1]);
    var limite = valores[i][2] instanceof Date ? paraData_(valores[i][2]) : null;
    if (!isNaN(saldo) && (saldo > 0 || limite)) {
      ctx.saldos.push({ email: email, saldoInicial: saldo, limite: limite });
      contar_(ctx, 'SALDO_FERIAS');
    }

    [[3, 4], [5, 6]].forEach(function (par) {
      var ini = valores[i][par[0]], fim = valores[i][par[1]];
      if (!(ini instanceof Date)) return;
      if (!(fim instanceof Date)) fim = ini;
      var cor = String(fundos[i][par[0]] || '').toLowerCase();
      var status = cor === '#00ff00' ? STATUS.ENCAMINHADA : STATUS.APROVADA;
      adicionarLancamento_(ctx, { tipo: TIPO.FERIAS, email: email, inicio: paraData_(ini), fim: paraData_(fim), status: status });
    });
  }
}

// ---------- Nomes -> e-mails ----------

function semAcentos_(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\.+$/, '').replace(/\s+/g, ' ').trim();
}

/**
 * Resolve nomes da planilha antiga em e-mails.
 * Ordem: MapaNomes > nome de exibição igual > primeiro nome único no cadastro.
 */
function criarResolvedorDeNomes_() {
  var mapa = {};
  lerAba_(ABA_MAPA_NOMES).forEach(function (l) {
    var nome = semAcentos_(l['Nome na planilha antiga']);
    var email = String(l['E-mail'] || '').trim();
    if (nome && email) mapa[nome] = email.toUpperCase() === MAPA_IGNORAR ? MAPA_IGNORAR : normalizarEmail_(email);
  });

  var porExibicao = {}, porPrimeiroNome = {}, porNomeCompleto = {};
  listarPessoas_().forEach(function (p) {
    porExibicao[semAcentos_(p.nomeExibicao)] = p.email;
    porNomeCompleto[semAcentos_(p.nome)] = p.email;
    var primeiro = semAcentos_(p.nome).split(' ')[0];
    if (!porPrimeiroNome[primeiro]) porPrimeiroNome[primeiro] = [];
    porPrimeiroNome[primeiro].push(p.email);
  });

  var pendentes = {}; // nome original -> {nome, abas:[]}
  var cache = {};

  return {
    resolver: function (nomeOriginal, aba) {
      var chave = semAcentos_(nomeOriginal);
      if (cache[chave] !== undefined) {
        if (cache[chave] === null) registrarPendente(nomeOriginal, aba);
        return cache[chave];
      }
      var email = mapa[chave] || porExibicao[chave] || porNomeCompleto[chave] || null;
      if (!email && porPrimeiroNome[chave] && porPrimeiroNome[chave].length === 1) {
        email = porPrimeiroNome[chave][0];
      }
      cache[chave] = email;
      if (!email) registrarPendente(nomeOriginal, aba);
      return email;
    },
    naoMapeados: function () {
      return Object.keys(pendentes).map(function (k) { return pendentes[k]; });
    }
  };

  function registrarPendente(nome, aba) {
    var k = semAcentos_(nome);
    if (!pendentes[k]) pendentes[k] = { nome: nome.trim(), abas: [] };
    if (pendentes[k].abas.indexOf(aba) < 0) pendentes[k].abas.push(aba);
  }
}

// ---------- Gravação ----------

function gravarImportacao_(ctx) {
  var usuario = { email: Session.getEffectiveUser().getEmail() };
  var existentes = {};
  listarLancamentos_().forEach(function (x) {
    existentes[chaveLancamento_(x.tipo, x.email, x.inicio, x.fim, x.turno)] = true;
  });

  var contadores = { lancamentos: 0, bloqueios: 0, saldos: 0, ignorados: 0 };
  var agora = new Date();
  var linhas = [];
  ctx.lancamentos.forEach(function (l) {
    var chave = chaveLancamento_(l.tipo, l.email, l.inicio, l.fim, l.turno);
    if (existentes[chave]) { contadores.ignorados++; return; }
    existentes[chave] = true;
    linhas.push([gerarId_(), l.tipo, l.email, l.inicio, l.fim, l.turno || '', l.status,
      usuario.email, agora, agora, '', MARCA_IMPORTADO]);
  });
  if (linhas.length) {
    var abaL = aba_(ABA_LANCAMENTOS);
    abaL.getRange(abaL.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
  }
  contadores.lancamentos = linhas.length;

  var bloqueiosExistentes = {};
  listarBloqueios_().forEach(function (b) {
    bloqueiosExistentes[b.tipo + '|' + formatarDataIso_(b.inicio) + '|' + formatarDataIso_(b.fim)] = true;
  });
  var linhasB = [];
  Object.keys(ctx.bloqueios).forEach(function (chave) {
    if (bloqueiosExistentes[chave]) { contadores.ignorados++; return; }
    var b = ctx.bloqueios[chave];
    var descricao = (b.descricoes.join('; ') || b.tipo) + ' (' + MARCA_IMPORTADO + ')';
    linhasB.push([gerarId_(), b.tipo, b.inicio, b.fim, descricao]);
  });
  if (linhasB.length) {
    var abaB = aba_(ABA_BLOQUEIOS);
    abaB.getRange(abaB.getLastRow() + 1, 1, linhasB.length, 5).setValues(linhasB);
  }
  contadores.bloqueios = linhasB.length;

  var saldosExistentes = {};
  lerAba_(ABA_SALDO_FERIAS).forEach(function (l) { saldosExistentes[normalizarEmail_(l['E-mail'])] = true; });
  var linhasS = [];
  ctx.saldos.forEach(function (s) {
    if (saldosExistentes[s.email]) { contadores.ignorados++; return; }
    saldosExistentes[s.email] = true;
    linhasS.push([s.email, s.saldoInicial, s.limite || '', MARCA_IMPORTADO]);
  });
  if (linhasS.length) {
    var abaS = aba_(ABA_SALDO_FERIAS);
    abaS.getRange(abaS.getLastRow() + 1, 1, linhasS.length, 4).setValues(linhasS);
  }
  contadores.saldos = linhasS.length;

  return contadores;
}

function chaveLancamento_(tipo, email, inicio, fim, turno) {
  return [tipo, normalizarEmail_(email), formatarDataIso_(inicio), formatarDataIso_(fim), turno || ''].join('|');
}

function escreverRelatorio_(ctx, resumo) {
  var ss = planilha_();
  var aba = ss.getSheetByName(ABA_RELATORIO_IMPORTACAO);
  if (!aba) {
    aba = ss.insertSheet(ABA_RELATORIO_IMPORTACAO);
  } else {
    aba.clear();
  }
  var linhas = [CABECALHOS[ABA_RELATORIO_IMPORTACAO]];
  linhas.push(['Resumo', 'Gerado em', formatarDataHoraBr_(new Date()) + (ctx.gravar ? ' (definitivo)' : ' (prévia)')]);
  resumo.forEach(function (r) { linhas.push(['Resumo', r.trim(), '']); });
  ctx.relatorio.forEach(function (r) { linhas.push(r); });
  aba.getRange(1, 1, linhas.length, 3).setValues(linhas);
  formatarCabecalho_(aba, 3);
  aba.setColumnWidth(1, 200);
  aba.setColumnWidth(2, 320);
  aba.setColumnWidth(3, 520);
}
