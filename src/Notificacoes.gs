/**
 * Ponto único de saída do sistema: e-mails e eventos de agenda.
 * NENHUM outro arquivo chama MailApp/GmailApp/CalendarApp diretamente.
 *
 * Modo teste (Config > MODO_TESTE = Sim):
 *  - todo e-mail vai só para EMAIL_TESTE, com o assunto prefixado e os
 *    destinatários originais listados no corpo;
 *  - todo evento vai para o calendário ID_CALENDARIO_TESTE (ou a agenda da
 *    conta que roda o sistema, se vazio) e o único participante é EMAIL_TESTE.
 * Eventos entram na agenda da pessoa como compromisso já confirmado (participante com presença
 * "aceita", sem e-mail de convite), via serviço avançado do Calendar. Se ele falhar, cai no CalendarApp.
 * Tudo que sai fica registrado na aba LogNotificacoes.
 */

// ---------- E-mail ----------

/**
 * Envia um e-mail.
 * @param {Object} o  {para: string|string[], cc?: string|string[], assunto: string,
 *                     corpoHtml?: string, corpoTexto?: string, origem?: string}
 * @return {Object} {enviado: boolean, destinatarioReal: string, modoTeste: boolean}
 */
function enviarEmail_(o) {
  var prefs = mapaPreferencias_();
  var recusados = [];
  var filtrar = function (lista) {
    return lista.filter(function (e) {
      if (preferenciasDe_(prefs, e).emails) return true;
      recusados.push(e);
      return false;
    });
  };
  var para = filtrar(listaEmails_(o.para));
  var cc = filtrar(listaEmails_(o.cc));
  var assunto = o.assunto || '(sem assunto)';

  if (recusados.length && !para.length) {
    registrarNotificacao_('EMAIL', o.origem, recusados.join(', '), '', assunto, 'ignorado: destinatário(s) desligou e-mails');
    return { enviado: false, destinatarioReal: '', modoTeste: modoTeste() };
  }
  var corpoTexto = o.corpoTexto || removerHtml_(o.corpoHtml || '');
  var corpoHtml = o.corpoHtml || '<pre>' + escaparHtml_(corpoTexto) + '</pre>';
  var teste = modoTeste();

  var destinoPara = para;
  var destinoCc = cc;

  if (teste) {
    var emailTeste = String(obterConfig('EMAIL_TESTE')).trim();
    if (!emailTeste) throw new Error('Modo teste ligado, mas Config > EMAIL_TESTE está vazio.');
    var aviso = 'MODO TESTE – destinatários originais: para=' + (para.join(', ') || '-') +
      (cc.length ? '; cc=' + cc.join(', ') : '');
    assunto = '[TESTE] ' + assunto;
    corpoTexto = aviso + '\n\n' + corpoTexto;
    corpoHtml = '<p style="background:#FBEFD9;color:#8A4B08;padding:8px;border-radius:6px">' +
      escaparHtml_(aviso) + '</p>' + corpoHtml;
    destinoPara = [emailTeste];
    destinoCc = [];
  }

  if (!destinoPara.length) {
    registrarNotificacao_('EMAIL', o.origem, para.concat(cc).join(', '), '', assunto, 'ignorado: sem destinatário');
    return { enviado: false, destinatarioReal: '', modoTeste: teste };
  }

  var opcoes = { htmlBody: corpoHtml, name: 'Escala Suporte' };
  if (destinoCc.length) opcoes.cc = destinoCc.join(',');
  MailApp.sendEmail(destinoPara.join(','), assunto, corpoTexto, opcoes);

  registrarNotificacao_('EMAIL', o.origem, para.concat(cc).join(', '), destinoPara.join(', '), assunto, 'enviado');
  return { enviado: true, destinatarioReal: destinoPara.join(', '), modoTeste: teste };
}

// ---------- Agenda ----------

/**
 * ID do calendário de onde os eventos saem.
 * Vazio (o normal) = agenda da conta que roda o sistema: o evento entra direto na
 * agenda de cada pessoa, que é adicionada como participante. Não existe calendário
 * separado "Escala Suporte" (decisão do usuário, 22/09/2026).
 */
function idCalendario_() {
  var id = String(obterConfig(modoTeste() ? 'ID_CALENDARIO_TESTE' : 'ID_CALENDARIO_PRODUCAO')).trim();
  return id || CalendarApp.getDefaultCalendar().getId();
}

/** Calendário (CalendarApp) onde os eventos são criados, conforme o modo. */
function calendario_() {
  var id = idCalendario_();
  var cal = CalendarApp.getCalendarById(id);
  if (!cal) throw new Error('Calendário não encontrado ou sem acesso: ' + id);
  return cal;
}

function dataIsoLocal_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function dataHoraRfc_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"); }

/**
 * Cria um evento e devolve o ID (guardar em Lancamentos > ID evento agenda).
 * @param {Object} o {titulo, inicio: Date, fim: Date, diaInteiro?: boolean,
 *                    descricao?: string, convidados?: string[], origem?: string}
 * @return {string} ID do evento
 */
function criarEvento_(o) {
  var convidadosOriginais = listaEmails_(o.convidados);
  var convidados = convidadosReais_(convidadosOriginais);
  var fimExclusivo = new Date(o.fim.getFullYear(), o.fim.getMonth(), o.fim.getDate() + 1); // dia inteiro: fim exclusivo
  var id;

  try {
    // Serviço avançado: participante já com presença aceita e sem e-mail de convite (compromisso certo, não convite)
    var recurso = {
      summary: o.titulo,
      description: o.descricao || '',
      attendees: convidados.map(function (e) { return { email: e, responseStatus: 'accepted' }; }),
      guestsCanInviteOthers: false,
      reminders: { useDefault: true }
    };
    if (o.diaInteiro) {
      recurso.start = { date: dataIsoLocal_(o.inicio) };
      recurso.end = { date: dataIsoLocal_(fimExclusivo) };
    } else {
      var fuso = Session.getScriptTimeZone();
      recurso.start = { dateTime: dataHoraRfc_(o.inicio), timeZone: fuso };
      recurso.end = { dateTime: dataHoraRfc_(o.fim), timeZone: fuso };
    }
    var criado = Calendar.Events.insert(recurso, idCalendario_(), { sendUpdates: 'none' });
    id = criado.iCalUID || criado.id;
  } catch (e) {
    // sem o serviço avançado (ou erro nele): cria pelo CalendarApp, ainda sem e-mail de convite
    var cal = calendario_();
    var opcoes = { description: o.descricao || '' };
    if (convidados.length) { opcoes.guests = convidados.join(','); opcoes.sendInvites = false; }
    var evento = o.diaInteiro ? cal.createAllDayEvent(o.titulo, o.inicio, fimExclusivo, opcoes) : cal.createEvent(o.titulo, o.inicio, o.fim, opcoes);
    id = evento.getId();
    registrarNotificacao_('EVENTO', o.origem, convidadosOriginais.join(', '), convidados.join(', '), o.titulo, 'API falhou (' + e.message + '); criado pelo CalendarApp');
  }

  registrarNotificacao_('EVENTO', o.origem, convidadosOriginais.join(', '), convidados.join(', '),
    o.titulo + ' (' + formatarDataBr_(o.inicio) + ')', 'criado ' + id);
  return id;
}

/** Atualiza título/datas/descrição de um evento existente. Retorna false se não achou. */
function atualizarEvento_(idEvento, o) {
  var evento = buscarEvento_(idEvento);
  if (!evento) return false;
  if (o.titulo) evento.setTitle(o.titulo);
  if (o.descricao !== undefined) evento.setDescription(o.descricao);
  if (o.inicio && o.fim) {
    if (o.diaInteiro) {
      var fimExclusivo = new Date(o.fim.getFullYear(), o.fim.getMonth(), o.fim.getDate() + 1);
      evento.setAllDayDates(o.inicio, fimExclusivo);
    } else {
      evento.setTime(o.inicio, o.fim);
    }
  }
  registrarNotificacao_('EVENTO', o.origem, '', '', evento.getTitle(), 'atualizado ' + idEvento);
  return true;
}

/** Remove um evento. Retorna false se não achou (já removido, por exemplo). */
function removerEvento_(idEvento, origem) {
  var evento = buscarEvento_(idEvento);
  if (!evento) return false;
  var titulo = evento.getTitle();
  evento.deleteEvent();
  registrarNotificacao_('EVENTO', origem, '', '', titulo, 'removido ' + idEvento);
  return true;
}

function buscarEvento_(idEvento) {
  if (!idEvento) return null;
  try {
    return calendario_().getEventById(idEvento);
  } catch (e) {
    return null;
  }
}

/**
 * Participantes que de fato entram no evento: tira quem não ligou "eventos na agenda" nas configurações;
 * em modo teste, o único participante possível é EMAIL_TESTE.
 */
function convidadosReais_(convidados) {
  var prefs = mapaPreferencias_();
  var aceitam = convidados.filter(function (e) { return preferenciasDe_(prefs, e).agenda; });
  if (!modoTeste()) return aceitam;
  var emailTeste = String(obterConfig('EMAIL_TESTE')).trim();
  if (!emailTeste) throw new Error('Modo teste ligado, mas Config > EMAIL_TESTE está vazio.');
  return aceitam.length ? [emailTeste] : [];
}

// ---------- Log ----------

function registrarNotificacao_(tipo, origem, originais, real, assunto, resultado) {
  try {
    anexarLinha_(ABA_LOG_NOTIFICACOES, {
      'Quando': new Date(),
      'Tipo': tipo,
      'Origem': origem || '',
      'Destinatários originais': originais,
      'Destinatário real': real,
      'Assunto/título': assunto,
      'Resultado': resultado
    });
  } catch (e) {
    // log nunca pode derrubar a operação principal
    Logger.log('Falha ao registrar notificação: ' + e.message);
  }
}

// ---------- Utilitários ----------

function listaEmails_(valor) {
  if (!valor) return [];
  var lista = Array.isArray(valor) ? valor : String(valor).split(/[,;]/);
  var vistos = {};
  return lista.map(normalizarEmail_).filter(function (e) {
    if (!e || vistos[e]) return false;
    vistos[e] = true;
    return true;
  });
}

function escaparHtml_(texto) {
  return String(texto).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function removerHtml_(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

// ---------- Teste manual (rodar no editor) ----------

/**
 * Envia um e-mail e cria um evento de teste para conferir o modo teste.
 * Com MODO_TESTE = Sim, o e-mail e o convite chegam só em EMAIL_TESTE,
 * mesmo com destinatários "falsos" abaixo.
 */
function testarNotificacoes() {
  var r = enviarEmail_({
    para: ['colega.exemplo@' + obterConfig('DOMINIO')],
    assunto: 'Teste do Escala Suporte',
    corpoHtml: '<p>Se você recebeu este e-mail, o envio central está funcionando.</p>',
    origem: 'testarNotificacoes'
  });

  var amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(8, 0, 0, 0);
  var fim = new Date(amanha.getTime());
  fim.setHours(11, 0, 0, 0);

  var idEvento = criarEvento_({
    titulo: '[TESTE] Escala Suporte – sábado 8h–11h',
    inicio: amanha,
    fim: fim,
    descricao: 'Evento de teste. Pode apagar.',
    convidados: ['colega.exemplo@' + obterConfig('DOMINIO')],
    origem: 'testarNotificacoes'
  });

  Logger.log('E-mail: ' + JSON.stringify(r));
  Logger.log('Evento criado: ' + idEvento + ' no calendário "' + calendario_().getName() + '"');
  Logger.log('Confira a aba ' + ABA_LOG_NOTIFICACOES + '.');
}
