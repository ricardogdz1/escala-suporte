/**
 * setup(): prepara a planilha-banco. Pode ser rodado quantas vezes quiser:
 * cria só o que falta e nunca apaga dados nem sobrescreve valores da Config.
 *
 * Como rodar: no editor do Apps Script, escolha "setup" e clique em Executar
 * (na primeira vez o Google pede autorização dos escopos).
 */
function setup() {
  var ss = planilha_();
  var relatorio = [];

  // 1. Abas de cadastro precisam existir com os cabeçalhos esperados
  [ABA_PESSOAS, ABA_SETORES, ABA_SETORES_EXTRAS].forEach(function (nome) {
    var aba = ss.getSheetByName(nome);
    if (!aba) {
      throw new Error('A aba de cadastro "' + nome + '" não foi encontrada. Ela deve vir da planilha de cadastro.');
    }
    var faltando = colunasFaltando_(aba, CABECALHOS[nome]);
    if (faltando.length) {
      throw new Error('A aba "' + nome + '" está sem as colunas: ' + faltando.join(', '));
    }
    relatorio.push(nome + ': ok');
  });

  // 2. Abas do sistema: cria as que faltam e completa cabeçalhos
  ABAS_DO_SISTEMA.forEach(function (nome) {
    relatorio.push(nome + ': ' + garantirAba_(ss, nome, CABECALHOS[nome]));
  });

  // 3. Config: adiciona chaves que faltam (não mexe nas existentes)
  relatorio.push('Config: ' + garantirConfigPadrao_());

  // 4. Formatação e validações (ajudam o gestor a editar direto na planilha)
  aplicarFormatacao_(ss);

  limparCacheConfig();
  Logger.log('setup concluído:\n' + relatorio.join('\n'));
  return relatorio;
}

/** Cria a aba se não existir; se existir, acrescenta colunas que faltam no fim. */
function garantirAba_(ss, nome, cabecalho) {
  var aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    formatarCabecalho_(aba, cabecalho.length);
    return 'criada';
  }

  var existentes = cabecalhoDaAba_(aba).filter(function (c) { return c; });
  if (!existentes.length) {
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    formatarCabecalho_(aba, cabecalho.length);
    return 'cabeçalho criado';
  }

  var faltando = cabecalho.filter(function (c) { return existentes.indexOf(c) < 0; });
  if (faltando.length) {
    aba.getRange(1, existentes.length + 1, 1, faltando.length).setValues([faltando]);
    formatarCabecalho_(aba, existentes.length + faltando.length);
    return 'colunas adicionadas: ' + faltando.join(', ');
  }
  return 'já existia';
}

function colunasFaltando_(aba, esperadas) {
  var existentes = cabecalhoDaAba_(aba);
  return esperadas.filter(function (c) { return existentes.indexOf(c) < 0; });
}

function formatarCabecalho_(aba, qtdColunas) {
  aba.getRange(1, 1, 1, qtdColunas).setFontWeight('bold').setBackground('#E8EFE9');
  aba.setFrozenRows(1);
}

/** Insere na Config as chaves de CONFIG_PADRAO que ainda não existem. */
function garantirConfigPadrao_() {
  var aba = aba_(ABA_CONFIG);
  var existentes = {};
  lerAba_(ABA_CONFIG).forEach(function (l) { existentes[String(l['Chave']).trim()] = true; });

  var emailAtual = Session.getEffectiveUser().getEmail();
  var novas = CONFIG_PADRAO
    .filter(function (c) { return !existentes[c[0]]; })
    .map(function (c) {
      var valor = c[1];
      // e-mail de teste começa como o de quem rodou o setup (dono do sistema)
      if (c[0] === 'EMAIL_TESTE' && !valor) valor = emailAtual;
      return [c[0], valor, c[2]];
    });

  if (!novas.length) return 'nada a adicionar';
  aba.getRange(aba.getLastRow() + 1, 1, novas.length, 3).setValues(novas);
  return 'adicionadas ' + novas.length + ' chaves';
}

/** Formatos de data e listas suspensas nas abas do sistema. */
function aplicarFormatacao_(ss) {
  var FORMATO_DATA = 'dd/mm/yyyy';
  var FORMATO_DATA_HORA = 'dd/mm/yyyy hh:mm';
  var LINHAS = 2000; // faixa aplicada; linhas além disso o gestor não vai alcançar tão cedo

  formatarColunas_(ss, ABA_LANCAMENTOS, ['Data início', 'Data fim'], FORMATO_DATA, LINHAS);
  formatarColunas_(ss, ABA_LANCAMENTOS, ['Criado em', 'Atualizado em'], FORMATO_DATA_HORA, LINHAS);
  validarLista_(ss, ABA_LANCAMENTOS, 'Tipo', valoresDe_(TIPO), LINHAS);
  validarLista_(ss, ABA_LANCAMENTOS, 'Status', valoresDe_(STATUS), LINHAS);
  formatarColunas_(ss, ABA_LANCAMENTOS, ['Turno'], '@', LINHAS); // texto puro: "8-11" viraria data
  validarLista_(ss, ABA_LANCAMENTOS, 'Turno', valoresDe_(TURNO), LINHAS);

  formatarColunas_(ss, ABA_BLOQUEIOS, ['Data início', 'Data fim'], FORMATO_DATA, LINHAS);
  validarLista_(ss, ABA_BLOQUEIOS, 'Tipo', valoresDe_(BLOQUEIO), LINHAS);

  formatarColunas_(ss, ABA_FILA_HO, ['Semana'], FORMATO_DATA, LINHAS);
  formatarColunas_(ss, ABA_FILA_HO, ['Registrado em'], FORMATO_DATA_HORA, LINHAS);

  formatarColunas_(ss, ABA_SALDO_FERIAS, ['Prazo limite para gozo'], FORMATO_DATA, LINHAS);

  formatarColunas_(ss, ABA_TROCAS, ['Criada em', 'Respondida em'], FORMATO_DATA_HORA, LINHAS);

  formatarColunas_(ss, ABA_AVISOS_IGNORADOS, ['Quando'], FORMATO_DATA_HORA, LINHAS);
  formatarColunas_(ss, ABA_LOG_NOTIFICACOES, ['Quando'], FORMATO_DATA_HORA, LINHAS);
  formatarColunas_(ss, ABA_FILA, ['Criada em'], FORMATO_DATA_HORA, LINHAS);

  var config = ss.getSheetByName(ABA_CONFIG);
  config.setColumnWidth(1, 220);
  config.setColumnWidth(2, 260);
  config.setColumnWidth(3, 520);
}

function formatarColunas_(ss, nomeAba, colunas, formato, linhas) {
  var aba = ss.getSheetByName(nomeAba);
  var cabecalho = cabecalhoDaAba_(aba);
  colunas.forEach(function (nome) {
    var idx = cabecalho.indexOf(nome);
    if (idx >= 0) aba.getRange(2, idx + 1, linhas, 1).setNumberFormat(formato);
  });
}

function validarLista_(ss, nomeAba, coluna, valores, linhas) {
  var aba = ss.getSheetByName(nomeAba);
  var idx = cabecalhoDaAba_(aba).indexOf(coluna);
  if (idx < 0) return;
  var regra = SpreadsheetApp.newDataValidation()
    .requireValueInList(valores, true)
    .setAllowInvalid(true) // regra do projeto: nada bloqueia, só avisa
    .build();
  aba.getRange(2, idx + 1, linhas, 1).setDataValidation(regra);
}

function valoresDe_(obj) {
  return Object.keys(obj).map(function (k) { return obj[k]; });
}

/**
 * Corrige a coluna Turno de Lancamentos: células que viraram data (11/08, 12/09)
 * ou usam a grafia antiga ("8-11") passam a "8h-11h" / "9h-12h" como texto.
 */
function corrigirTurnos() {
  var aba = aba_(ABA_LANCAMENTOS);
  var col = cabecalhoDaAba_(aba).indexOf('Turno') + 1;
  var ultima = aba.getLastRow();
  if (!col || ultima < 2) { Logger.log('Nada a corrigir.'); return; }

  var faixa = aba.getRange(2, col, ultima - 1, 1);
  faixa.setNumberFormat('@');
  var valores = faixa.getValues();
  var corrigidos = 0;
  var novos = valores.map(function (linha) {
    var atual = linha[0];
    var novo = normalizarTurno_(atual);
    if (atual instanceof Date || String(atual) !== novo) corrigidos++;
    return [novo];
  });
  faixa.setValues(novos);
  Logger.log('Turnos corrigidos: ' + corrigidos + ' de ' + valores.length + ' linhas.');
}

/**
 * Mede quanto cada tela custa no servidor (rodar no editor).
 * A primeira passada enche o cache das abas; a segunda mostra o ganho.
 */
function medirDesempenho() {
  var medir = function (nome, fn) {
    var t = new Date().getTime();
    fn();
    return nome + ': ' + (new Date().getTime() - t) + ' ms';
  };
  var rodada = function (titulo) {
    var linhas = [titulo];
    linhas.push(medir('obterPainel', function () { obterPainel('semana'); }));
    linhas.push(medir('obterSabados', function () { obterSabados(''); }));
    linhas.push(medir('obterMeioDia', function () { obterMeioDia(''); }));
    linhas.push(medir('obterPlantao', function () { obterPlantao(''); }));
    linhas.push(medir('obterHomeOffice', function () { obterHomeOffice(''); }));
    linhas.push(medir('obterFerias', function () { obterFerias(''); }));
    return linhas.join('\n');
  };
  limparCaches();
  var frio = rodada('--- Sem cache (primeira leitura da planilha)');
  limparCaches();
  obterPainel('semana');              // enche o cache
  var quente = rodada('--- Com o cache das abas quente');
  Logger.log(frio + '\n\n' + quente);
}

/** Menu na planilha para o gestor. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Escala Suporte')
    .addItem('Preparar/atualizar abas (setup)', 'setup')
    .addItem('Recarregar configurações e cadastro', 'limparCaches')
    .addItem('Corrigir treinamentos importados', 'corrigirTreinamentosImportados')
    .addToUi();
}

/**
 * Gatilho simples: quando alguém edita Config ou o cadastro direto na planilha,
 * limpa o cache para o app refletir a mudança na hora (sem esperar os 5 minutos).
 */
function onEdit(e) {
  var nome = e && e.range && e.range.getSheet().getName();
  if (!nome) return;
  if (nome === ABA_CONFIG) limparCacheConfig();
  else if (nome === ABA_PESSOAS || nome === ABA_SETORES || nome === ABA_SETORES_EXTRAS) limparCacheCadastro();
  // mexeu na aba à mão: o app não pode continuar servindo a versão guardada
  esquecerAba_(nome);
}
