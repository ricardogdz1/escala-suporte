/**
 * Fila de tarefas lentas (eventos de agenda e e-mails).
 *
 * Por que existe: criar um evento leva de 0,3 a 0,8 s e um e-mail outro tanto. Escalar
 * cinco pessoas custava vários segundos com o usuário parado esperando a resposta.
 * Agora a gravação na planilha responde na hora e essas tarefas ficam para um gatilho
 * que roda logo em seguida — o evento aparece na agenda alguns segundos depois.
 *
 * Tudo continua passando por Notificacoes.gs, então o modo teste vale igual.
 */

var TAREFA = { EVENTO_CRIAR: 'EVENTO_CRIAR', EVENTO_REMOVER: 'EVENTO_REMOVER', EMAIL: 'EMAIL' };
var TAREFA_MAX_TENTATIVAS = 3;
var TAREFA_GATILHO = 'processarFila';
var TAREFA_SEGUNDOS_LIMITE = 240; // deixa folga no limite de 6 min do Apps Script

/** Tarefas acumuladas nesta execução; gravadas de uma vez em despacharFila_(). */
var filaDaExecucao_ = [];

/** Evento a criar depois. `lancamento` recebe o ID do evento quando ficar pronto. */
function enfileirarEvento_(o, lancamentoId) {
  filaDaExecucao_.push({
    tipo: TAREFA.EVENTO_CRIAR,
    dados: {
      titulo: o.titulo, descricao: o.descricao || '', origem: o.origem || '',
      inicio: o.inicio.toISOString(), fim: o.fim.toISOString(), diaInteiro: !!o.diaInteiro,
      convidados: o.convidados || [], lancamentoId: lancamentoId || ''
    }
  });
}

function enfileirarRemocaoDeEvento_(idEvento, origem) {
  if (!idEvento) return;
  filaDaExecucao_.push({ tipo: TAREFA.EVENTO_REMOVER, dados: { idEvento: idEvento, origem: origem || '' } });
}

function enfileirarEmail_(o) {
  filaDaExecucao_.push({
    tipo: TAREFA.EMAIL,
    dados: { para: o.para, cc: o.cc || '', assunto: o.assunto, corpoHtml: o.corpoHtml || '', corpoTexto: o.corpoTexto || '', origem: o.origem || '' }
  });
}

/**
 * Grava o que foi enfileirado e agenda o processamento.
 * Chamar no fim de toda função de gravação que use enfileirar*.
 */
function despacharFila_() {
  if (!filaDaExecucao_.length) return 0;
  // roda no finally das gravações: um problema aqui não pode derrubar um lançamento
  // que já está na planilha, então nada daqui propaga erro
  try {
    var aba = aba_(ABA_FILA);
    var agora = new Date();
    var linhas = filaDaExecucao_.map(function (t) {
      return [gerarId_(), t.tipo, JSON.stringify(t.dados), agora, 0, 'pendente'];
    });
    aba.getRange(aba.getLastRow() + 1, 1, linhas.length, 6).setValues(linhas);
    esquecerAba_(ABA_FILA);
    var quantas = filaDaExecucao_.length;
    filaDaExecucao_ = [];   // só esvazia depois de gravar
    agendarProcessamento_();
    return quantas;
  } catch (e) {
    Logger.log('Falha ao despachar a fila: ' + e.message);
    try {
      registrarNotificacao_('FILA', 'despacharFila_', '', '', filaDaExecucao_.length + ' tarefa(s)', 'ERRO: ' + e.message);
    } catch (e2) { /* nem o log pode atrapalhar a resposta */ }
    return 0;
  }
}

/** Cria o gatilho de daqui a instantes, se ainda não houver um esperando. */
function agendarProcessamento_() {
  try {
    var jaTem = ScriptApp.getProjectTriggers().some(function (g) { return g.getHandlerFunction() === TAREFA_GATILHO; });
    if (jaTem) return;
    ScriptApp.newTrigger(TAREFA_GATILHO).timeBased().after(5 * 1000).create();
  } catch (e) {
    // sem gatilho (cota, permissão) as tarefas ficam na fila e saem no próximo despacho
    Logger.log('Não foi possível agendar a fila: ' + e.message);
  }
}

/** Apaga os gatilhos já usados, para não encostar no limite do Apps Script. */
function limparGatilhosDaFila_() {
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === TAREFA_GATILHO) ScriptApp.deleteTrigger(g);
  });
}

/**
 * Processa a fila: chamado pelo gatilho (e pode ser rodado à mão no editor).
 * Uma tarefa por vez, com lock, para dois gatilhos não repetirem o mesmo trabalho.
 */
function processarFila() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // outro processamento em andamento

  var comecou = new Date().getTime();
  var feitas = 0, falhas = 0, sobraram = 0;
  try {
    limparGatilhosDaFila_();
    var aba = aba_(ABA_FILA);
    var pendentes = lerAba_(ABA_FILA).filter(function (l) { return String(l['Status'] || '').trim() === 'pendente'; });

    for (var i = 0; i < pendentes.length; i++) {
      if ((new Date().getTime() - comecou) / 1000 > TAREFA_SEGUNDOS_LIMITE) { sobraram = pendentes.length - i; break; }
      var linha = pendentes[i];
      var tentativas = Number(linha['Tentativas'] || 0) + 1;
      try {
        executarTarefa_(String(linha['Tipo'] || ''), JSON.parse(String(linha['Dados'] || '{}')));
        atualizarLinha_(ABA_FILA, linha._linha, { 'Status': 'feita', 'Tentativas': tentativas });
        feitas++;
      } catch (e) {
        var desistiu = tentativas >= TAREFA_MAX_TENTATIVAS;
        atualizarLinha_(ABA_FILA, linha._linha, {
          'Status': desistiu ? 'falhou' : 'pendente',
          'Tentativas': tentativas,
          'Erro': String(e.message).substring(0, 400)
        });
        if (desistiu) falhas++; else sobraram++;
        registrarNotificacao_('FILA', linha['Tipo'], '', '', 'tarefa ' + linha['ID'],
          (desistiu ? 'desistiu' : 'vai tentar de novo') + ': ' + e.message);
      }
    }
    apagarTarefasAntigas_();
  } finally {
    lock.releaseLock();
  }
  if (sobraram) agendarProcessamento_();
  Logger.log('Fila: ' + feitas + ' feita(s), ' + falhas + ' desistida(s), ' + sobraram + ' para depois.');
  return { feitas: feitas, falhas: falhas, sobraram: sobraram };
}

function executarTarefa_(tipo, d) {
  if (tipo === TAREFA.EVENTO_CRIAR) {
    var id = criarEvento_({
      titulo: d.titulo, descricao: d.descricao, origem: d.origem,
      inicio: new Date(d.inicio), fim: new Date(d.fim), diaInteiro: d.diaInteiro,
      convidados: d.convidados
    });
    if (id && d.lancamentoId) {
      var lanc = listarLancamentos_().filter(function (x) { return x.id === d.lancamentoId; })[0];
      // lançamento cancelado antes de o evento nascer: desfaz para não deixar lixo na agenda
      if (!lanc || lanc.status === STATUS.CANCELADO) removerEvento_(id, d.origem);
      else atualizarLancamento_(d.lancamentoId, { 'ID evento agenda': id });
    }
    return;
  }
  if (tipo === TAREFA.EVENTO_REMOVER) { removerEvento_(d.idEvento, d.origem); return; }
  if (tipo === TAREFA.EMAIL) { enviarEmail_(d); return; }
  throw new Error('Tipo de tarefa desconhecido: ' + tipo);
}

/** Mantém a aba enxuta: tarefas concluídas somem depois de uma semana. */
function apagarTarefasAntigas_() {
  var limite = adicionarDias_(hoje_(), -7).getTime();
  var aba = aba_(ABA_FILA);
  var apagar = lerAba_(ABA_FILA).filter(function (l) {
    var quando = l['Criada em'] instanceof Date ? l['Criada em'].getTime() : 0;
    return String(l['Status'] || '') === 'feita' && quando && quando < limite;
  }).map(function (l) { return l._linha; }).sort(function (a, b) { return b - a; });
  apagar.forEach(function (n) { aba.deleteRow(n); });
  if (apagar.length) esquecerAba_(ABA_FILA);
}

/** Roda no editor para despachar agora o que estiver pendente (ex.: gatilho falhou). */
function processarFilaAgora() {
  var r = processarFila();
  Logger.log(r ? JSON.stringify(r) : 'Havia outro processamento em andamento.');
}
