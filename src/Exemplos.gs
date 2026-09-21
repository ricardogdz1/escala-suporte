/**
 * Dados de exemplo para testar as telas antes da importação da planilha antiga.
 * Rodar no editor: criarDadosDeExemplo() e, para limpar, apagarDadosDeExemplo().
 * Os registros ficam marcados com Observação = "exemplo".
 */

var MARCA_EXEMPLO = 'exemplo';

function criarDadosDeExemplo() {
  var usuario = { email: Session.getEffectiveUser().getEmail() };
  var pessoas = listarPessoasAtivas_();
  if (pessoas.length < 4) throw new Error('Preciso de pelo menos 4 pessoas ativas na aba Pessoas.');
  var p = function (i) { return pessoas[i % pessoas.length].email; };

  var segunda = inicioDaSemana_(hoje_());
  var sabado = adicionarDias_(segunda, 5);
  var criados = 0;
  var lancar = function (dados) {
    dados.observacao = MARCA_EXEMPLO;
    criarLancamento_(dados, usuario);
    criados++;
  };

  // Meio-dia: 2 pessoas seg–qui, só 1 na sexta (gera aviso "1 vaga")
  for (var d = 0; d < 5; d++) {
    lancar({ tipo: TIPO.MEIO_DIA, email: p(d), inicio: adicionarDias_(segunda, d) });
    if (d < 4) lancar({ tipo: TIPO.MEIO_DIA, email: p(d + 1), inicio: adicionarDias_(segunda, d) });
  }
  // Plantão: 1 por dia seg–qua; qui e sex ficam sem ninguém (gera aviso)
  for (var e = 0; e < 3; e++) {
    lancar({ tipo: TIPO.PLANTAO, email: p(e + 2), inicio: adicionarDias_(segunda, e) });
  }
  // Home office: uma pessoa a semana inteira
  lancar({ tipo: TIPO.HOME_OFFICE, email: p(3), inicio: segunda, fim: adicionarDias_(segunda, 4) });
  // Férias aprovadas: quarta a sexta da semana que vem
  lancar({ tipo: TIPO.FERIAS, email: p(1), status: STATUS.APROVADA,
    inicio: adicionarDias_(segunda, 9), fim: adicionarDias_(segunda, 11) });
  // Sábado: 3 pessoas (abaixo do mínimo, gera aviso) nos dois turnos
  lancar({ tipo: TIPO.SABADO, email: p(0), inicio: sabado, turno: TURNO.T8_11 });
  lancar({ tipo: TIPO.SABADO, email: p(2), inicio: sabado, turno: TURNO.T8_11 });
  lancar({ tipo: TIPO.SABADO, email: p(3), inicio: sabado, turno: TURNO.T9_12 });

  // Feriado de exemplo na sexta da semana que vem
  anexarLinha_(ABA_BLOQUEIOS, {
    'ID': gerarId_(), 'Tipo': BLOQUEIO.FERIADO,
    'Data início': adicionarDias_(segunda, 11), 'Data fim': adicionarDias_(segunda, 11),
    'Descrição': 'Feriado de exemplo (' + MARCA_EXEMPLO + ')'
  });

  Logger.log('Criados ' + criados + ' lançamentos de exemplo + 1 feriado, a partir de ' + formatarDataBr_(segunda));
}

/** Apaga tudo que foi marcado como exemplo (Lancamentos e Bloqueios). */
function apagarDadosDeExemplo() {
  var total = 0;
  total += apagarLinhasOnde_(ABA_LANCAMENTOS, 'Observação', MARCA_EXEMPLO);
  total += apagarLinhasOnde_(ABA_BLOQUEIOS, 'Descrição', MARCA_EXEMPLO);
  Logger.log('Apagadas ' + total + ' linhas de exemplo.');
}

function apagarLinhasOnde_(nomeAba, coluna, contem) {
  var aba = aba_(nomeAba);
  var linhas = lerAba_(nomeAba)
    .filter(function (l) { return String(l[coluna] || '').indexOf(contem) >= 0; })
    .map(function (l) { return l._linha; })
    .sort(function (a, b) { return b - a; }); // de baixo para cima para não deslocar índices
  linhas.forEach(function (n) { aba.deleteRow(n); });
  return linhas.length;
}
