/**
 * Motor de avisos. Regra do projeto: nenhum aviso bloqueia; o usuário pode
 * "Salvar mesmo assim" e isso fica registrado em AvisosIgnorados.
 *
 * Fluxo padrão de toda gravação:
 *   1. cliente chama salvarX(dados, confirmado=false)
 *   2. servidor calcula avisos; se houver e não confirmado, devolve {avisos} sem gravar
 *   3. cliente mostra a janela "Cancelar / Salvar mesmo assim" e chama de novo com confirmado=true
 *   4. servidor grava e registra os avisos ignorados
 */

function aviso_(codigo, texto) {
  return { codigo: codigo, texto: texto };
}

/** Resposta padrão quando há avisos e o usuário ainda não confirmou. */
function respostaComAvisos_(avisos) {
  return { ok: false, precisaConfirmar: true, avisos: avisos };
}

/** Grava em AvisosIgnorados quem salvou mesmo assim. */
function registrarAvisosIgnorados_(usuario, idLancamento, avisos) {
  if (!avisos || !avisos.length) return;
  var aba = aba_(ABA_AVISOS_IGNORADOS);
  var agora = new Date();
  var linhas = avisos.map(function (a) {
    return [agora, usuario.email, idLancamento || '', a.codigo, a.texto];
  });
  aba.getRange(aba.getLastRow() + 1, 1, linhas.length, 5).setValues(linhas);
}

/** true se a pessoa está de férias (aprovadas/encaminhadas) em alguma data do intervalo. */
function estaDeFerias_(lancamentos, email, inicio, fim) {
  return lancamentos.some(function (x) {
    return x.tipo === TIPO.FERIAS && x.email === email &&
      x.inicio.getTime() <= (fim || inicio).getTime() && x.fim.getTime() >= inicio.getTime();
  });
}
