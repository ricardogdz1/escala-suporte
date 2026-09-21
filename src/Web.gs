/**
 * Entrada do web app (HtmlService).
 * Index.html é a casca (menu + área principal); cada tela é carregada
 * pelo cliente via google.script.run chamando as funções públicas (sem "_").
 */

function doGet(e) {
  var usuario = obterUsuarioAtual();
  var modelo = HtmlService.createTemplateFromFile(usuario.autorizado ? 'Index' : 'SemAcesso');
  modelo.usuario = usuario;
  modelo.telaInicial = (e && e.parameter && e.parameter.tela) || 'painel';

  return modelo.evaluate()
    .setTitle('Escala Suporte')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Inclui outro arquivo HTML (CSS/JS) dentro de um template: <?!= incluir('Estilos') ?> */
function incluir(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

/** URL pública do app (para links em e-mails). */
function urlDoApp_() {
  return ScriptApp.getService().getUrl();
}
