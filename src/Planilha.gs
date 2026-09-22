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

function esquecerAba_(nome) {
  delete abasLidas_[nome];
}

/**
 * Lê uma aba inteira como lista de objetos {cabeçalho: valor}.
 * Ignora linhas totalmente vazias. Cada objeto recebe também _linha (número da linha na planilha).
 * Quem chama não deve alterar os objetos retornados (são compartilhados dentro da execução).
 */
function lerAba_(nome) {
  if (abasLidas_[nome]) return abasLidas_[nome];
  var registros = lerAbaDaPlanilha_(nome);
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

/** Date -> "yyyy-MM-dd" (formato usado entre servidor e cliente). */
function formatarDataIso_(data) {
  if (!(data instanceof Date) || isNaN(data.getTime())) return '';
  return Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Date -> "dd/MM/yyyy" para exibição. */
function formatarDataBr_(data) {
  if (!(data instanceof Date) || isNaN(data.getTime())) return '';
  return Utilities.formatDate(data, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/** Date -> "dd/MM/yyyy HH:mm" para exibição. */
function formatarDataHoraBr_(data) {
  if (!(data instanceof Date) || isNaN(data.getTime())) return '';
  return Utilities.formatDate(data, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}
