/**
 * Acesso à planilha-banco. Todo o resto do código lê e grava por aqui.
 * Convenção: uma linha por registro, primeira linha = cabeçalho.
 * Funções terminadas em "_" são privadas (não aparecem para o cliente).
 */

function planilha_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Retorna a aba ou lança erro claro se ela não existir. */
function aba_(nome) {
  var aba = planilha_().getSheetByName(nome);
  if (!aba) {
    throw new Error('A aba "' + nome + '" não existe. Rode setup() no editor do Apps Script.');
  }
  return aba;
}

/**
 * Memória de uma execução: cada aba é lida da planilha no máximo uma vez por chamada do cliente
 * (getValues custa 100–300 ms). Quem grava chama esquecerAba_() para a próxima leitura ser fresca.
 * Apps Script cria um contexto novo a cada execução, então isso nunca vaza entre chamadas.
 */
var abasLidas_ = {};

/**
 * Além da memória da execução, as abas grandes ficam no CacheService entre execuções:
 * ler a planilha é a parte mais cara de cada chamada, e essas abas mudam pouco.
 * Qualquer gravação (ou edição manual, pelo onEdit) derruba o cache da aba.
 */
var ABAS_COM_CACHE = [ABA_LANCAMENTOS, ABA_BLOQUEIOS, ABA_PREFERENCIAS, ABA_SALDO_FERIAS, ABA_TROCAS, ABA_FILA_HO];
var CACHE_ABA_SEGUNDOS = 600;      // máximo do CacheService
var CACHE_PEDACO = 90000;          // o limite é 100 KB por chave
var CACHE_MAX_PEDACOS = 8;

function chaveCacheAba_(nome) { return 'aba_v1_' + nome; }

function esquecerAba_(nome) {
  delete abasLidas_[nome];
  if (ABAS_COM_CACHE.indexOf(nome) < 0) return;
  try {
    var chave = chaveCacheAba_(nome);
    var cache = CacheService.getScriptCache();
    var chaves = [chave + '_n'];
    for (var i = 0; i < CACHE_MAX_PEDACOS; i++) chaves.push(chave + '_' + i);
    cache.removeAll(chaves);
  } catch (e) {
    // cache é só aceleração; se falhar, a próxima leitura vai à planilha
  }
}

/**
 * JSON que preserva as datas: sem isso, um Date volta do cache como texto e
 * quebra quem faz `valor instanceof Date`.
 */
function abaParaTexto_(registros) {
  return JSON.stringify(registros, function (chave, valor) {
    var original = this[chave];
    return original instanceof Date ? { __data: original.getTime() } : valor;
  });
}

function abaDeTexto_(texto) {
  return JSON.parse(texto, function (chave, valor) {
    return valor && typeof valor === 'object' && valor.__data !== undefined ? new Date(valor.__data) : valor;
  });
}

function lerAbaDoCache_(nome) {
  if (ABAS_COM_CACHE.indexOf(nome) < 0) return null;
  try {
    var chave = chaveCacheAba_(nome);
    var cache = CacheService.getScriptCache();
    var quantos = Number(cache.get(chave + '_n'));
    if (!quantos) return null;
    var chaves = [];
    for (var i = 0; i < quantos; i++) chaves.push(chave + '_' + i);
    var partes = cache.getAll(chaves);
    var texto = '';
    for (var j = 0; j < chaves.length; j++) {
      if (partes[chaves[j]] === undefined) return null;   // um pedaço expirou: lê da planilha
      texto += partes[chaves[j]];
    }
    return abaDeTexto_(texto);
  } catch (e) {
    return null;
  }
}

function guardarAbaNoCache_(nome, registros) {
  if (ABAS_COM_CACHE.indexOf(nome) < 0) return;
  try {
    var texto = abaParaTexto_(registros);
    var quantos = Math.ceil(texto.length / CACHE_PEDACO);
    if (quantos > CACHE_MAX_PEDACOS) return;   // grande demais: não compensa
    var chave = chaveCacheAba_(nome);
    var mapa = {};
    for (var i = 0; i < quantos; i++) mapa[chave + '_' + i] = texto.substr(i * CACHE_PEDACO, CACHE_PEDACO);
    mapa[chave + '_n'] = String(quantos);
    CacheService.getScriptCache().putAll(mapa, CACHE_ABA_SEGUNDOS);
  } catch (e) {
    // idem: cache é opcional
  }
}

/**
 * Lê uma aba inteira como lista de objetos {cabeçalho: valor}.
 * Ignora linhas totalmente vazias. Cada objeto recebe também _linha (número da linha na planilha).
 * Quem chama não deve alterar os objetos retornados (são compartilhados dentro da execução).
 */
function lerAba_(nome) {
  if (abasLidas_[nome]) return abasLidas_[nome];
  var registros = lerAbaDoCache_(nome);
  if (!registros) {
    registros = lerAbaDaPlanilha_(nome);
    guardarAbaNoCache_(nome, registros);
  }
  abasLidas_[nome] = registros;
  return registros;
}

function lerAbaDaPlanilha_(nome) {
  var aba = aba_(nome);
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  if (ultimaLinha < 2 || ultimaColuna < 1) return [];

  var valores = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getValues();
  var cabecalho = valores[0].map(function (c) { return String(c).trim(); });
  var registros = [];

  for (var i = 1; i < valores.length; i++) {
    var linha = valores[i];
    var vazia = linha.every(function (v) { return v === '' || v === null; });
    if (vazia) continue;

    var obj = { _linha: i + 1 };
    for (var j = 0; j < cabecalho.length; j++) {
      if (cabecalho[j]) obj[cabecalho[j]] = linha[j];
    }
    registros.push(obj);
  }
  return registros;
}

/** Anexa uma linha na aba a partir de um objeto {cabeçalho: valor}. Retorna o número da linha. */
function anexarLinha_(nome, obj) {
  var aba = aba_(nome);
  var cabecalho = cabecalhoParaGravar_(aba, nome);
  var linha = cabecalho.map(function (c) { return obj[c] !== undefined ? obj[c] : ''; });
  aba.appendRow(linha);
  esquecerAba_(nome);
  return aba.getLastRow();
}

/** Atualiza colunas de uma linha existente. Só mexe nas chaves presentes em obj. */
function atualizarLinha_(nome, numeroLinha, obj) {
  var aba = aba_(nome);
  var cabecalho = cabecalhoParaGravar_(aba, nome);
  Object.keys(obj).forEach(function (chave) {
    var col = cabecalho.indexOf(chave);
    if (col >= 0) aba.getRange(numeroLinha, col + 1).setValue(obj[chave]);
  });
  esquecerAba_(nome);
}

/** Apaga uma linha da aba (as linhas seguintes sobem: releia antes de usar outro número). */
function apagarLinha_(nome, numeroLinha) {
  aba_(nome).deleteRow(numeroLinha);
  esquecerAba_(nome);
}

/**
 * Cabeçalho para gravar numa aba do sistema, criando as colunas que faltarem.
 * Sem isso, uma coluna nova no código (e ainda não criada na planilha) faz a gravação
 * ser perdida em silêncio: atualizarLinha_ ignora chaves fora do cabeçalho e a leitura
 * volta ao padrão. Só mexe nas abas do sistema; as de cadastro são do gestor.
 */
function cabecalhoParaGravar_(aba, nome) {
  var cabecalho = cabecalhoDaAba_(aba);
  var esperado = CABECALHOS[nome];
  if (!esperado || ABAS_DO_SISTEMA.indexOf(nome) < 0) return cabecalho;

  var faltando = esperado.filter(function (c) { return cabecalho.indexOf(c) < 0; });
  if (!faltando.length) return cabecalho;

  aba.getRange(1, cabecalho.length + 1, 1, faltando.length).setValues([faltando]);
  aba.getRange(1, 1, 1, cabecalho.length + faltando.length).setFontWeight('bold').setBackground('#E8EFE9');
  Logger.log('Colunas criadas em "' + nome + '": ' + faltando.join(', '));
  return cabecalho.concat(faltando);
}

function cabecalhoDaAba_(aba) {
  var ultimaColuna = aba.getLastColumn();
  if (ultimaColuna < 1) return [];
  return aba.getRange(1, 1, 1, ultimaColuna).getValues()[0]
    .map(function (c) { return String(c).trim(); });
}

/**
 * Anexa à resposta de uma gravação a tela já recarregada, para o cliente não
 * precisar de uma segunda chamada (é o round-trip que mais pesa no uso).
 * @param {Object} resposta  o que a função de gravação ia devolver
 * @param {string[]} janelas os blocos que o cliente tem abertos
 * @param {Function} montar  função que devolve os dados de uma janela
 */
function comDadosAtualizados_(resposta, janelas, montar) {
  if (!janelas || !janelas.length) return resposta;
  resposta.dados = {};
  janelas.slice(0, 4).forEach(function (j) {   // limite: o cliente raramente tem mais que isso aberto
    try {
      resposta.dados[j] = montar(j);
    } catch (e) {
      delete resposta.dados[j];                 // se falhar, o cliente busca do jeito antigo
    }
  });
  return resposta;
}

/** ID curto e único para lançamentos, bloqueios e trocas. */
function gerarId_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 12);
}

/** Normaliza e-mail para comparação: minúsculo e sem espaços. */
function normalizarEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

/** Converte valor da planilha em booleano (Sim/Não, true/false, 1/0). */
function ehSim_(valor) {
  var v = String(valor || '').trim().toLowerCase();
  return v === 'sim' || v === 'true' || v === '1' || v === 's';
}

/** Data (sem hora) no fuso do projeto, a partir de Date ou string "yyyy-MM-dd". */
function paraData_(valor) {
  if (valor instanceof Date) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  var partes = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!partes) return null;
  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

/**
 * As três formatações abaixo são feitas na mão, sem Utilities.formatDate: aquilo é
 * chamada de serviço e aqui roda milhares de vezes por tela. O runtime já usa o fuso
 * do projeto, e todas as datas do sistema nascem locais, então o resultado é o mesmo.
 */
function doisDigitos_(n) { return n < 10 ? '0' + n : String(n); }

function dataValida_(data) { return data instanceof Date && !isNaN(data.getTime()); }

/** Date -> "yyyy-MM-dd" (formato usado entre servidor e cliente). */
function formatarDataIso_(data) {
  if (!dataValida_(data)) return '';
  return data.getFullYear() + '-' + doisDigitos_(data.getMonth() + 1) + '-' + doisDigitos_(data.getDate());
}

/** Date -> "dd/MM/yyyy" para exibição. */
function formatarDataBr_(data) {
  if (!dataValida_(data)) return '';
  return doisDigitos_(data.getDate()) + '/' + doisDigitos_(data.getMonth() + 1) + '/' + data.getFullYear();
}

/** Date -> "dd/MM/yyyy HH:mm" para exibição. */
function formatarDataHoraBr_(data) {
  if (!dataValida_(data)) return '';
  return formatarDataBr_(data) + ' ' + doisDigitos_(data.getHours()) + ':' + doisDigitos_(data.getMinutes());
}
