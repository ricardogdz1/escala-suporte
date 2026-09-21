/**
 * Utilitários de data. Todas as datas "de calendário" são Date à meia-noite
 * no fuso do projeto (America/Sao_Paulo). Entre servidor e cliente trafegam
 * como "yyyy-MM-dd" (google.script.run não aceita Date).
 */

var DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
var DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function hoje_() {
  return paraData_(new Date());
}

function adicionarDias_(data, dias) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

/** Segunda-feira da semana em que a data cai. */
function inicioDaSemana_(data) {
  var dia = data.getDay(); // 0 = domingo
  var recuo = dia === 0 ? 6 : dia - 1;
  return adicionarDias_(data, -recuo);
}

function inicioDoMes_(data) {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function fimDoMes_(data) {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0);
}

function ehSabado_(data) { return data.getDay() === 6; }
function ehDomingo_(data) { return data.getDay() === 0; }
function ehDiaUtil_(data) { return data.getDay() >= 1 && data.getDay() <= 5; }

/** true se inicio <= data <= fim (todas sem hora). */
function dentroDe_(data, inicio, fim) {
  return data.getTime() >= inicio.getTime() && data.getTime() <= (fim || inicio).getTime();
}

/** Lista de Date, um por dia, de inicio a fim (inclusive). */
function diasEntre_(inicio, fim) {
  var dias = [];
  for (var d = inicio; d.getTime() <= fim.getTime(); d = adicionarDias_(d, 1)) dias.push(d);
  return dias;
}

function mesmoDia_(a, b) {
  return a.getTime() === b.getTime();
}
