/**
 * Painel "quem está onde": monta a visão de um dia, semana ou mês
 * a partir de Lancamentos, Bloqueios e do cadastro.
 * Os problemas de cobertura (vagas e setores) viram avisos abertos.
 */

/**
 * Chamado pelo cliente.
 * @param {string} dataIso  dia de referência "yyyy-MM-dd" (vazio = hoje)
 * @param {string} modo     'hoje' | 'semana' | 'mes'
 */
function obterPainel(dataIso, modo) {
  exigirUsuario_();
  var referencia = paraData_(dataIso) || hoje_();
  modo = modo || 'hoje';

  var inicio, fim, titulo, anterior, proximo;
  if (modo === 'mes') {
    inicio = inicioDoMes_(referencia);
    fim = fimDoMes_(referencia);
    titulo = MESES[inicio.getMonth()] + ' de ' + inicio.getFullYear();
    anterior = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1);
    proximo = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
  } else if (modo === 'semana') {
    inicio = inicioDaSemana_(referencia);
    fim = adicionarDias_(inicio, 6);
    titulo = 'Semana de ' + formatarDataBr_(inicio).substring(0, 5) + ' a ' + formatarDataBr_(fim);
    anterior = adicionarDias_(inicio, -7);
    proximo = adicionarDias_(inicio, 7);
  } else {
    inicio = referencia;
    fim = referencia;
    titulo = DIAS_SEMANA[referencia.getDay()] + ', ' + formatarDataBr_(referencia);
    anterior = adicionarDias_(referencia, -1);
    proximo = adicionarDias_(referencia, 1);
  }

  var contexto = contextoPainel_(inicio, fim);
  var dias = diasEntre_(inicio, fim).map(function (d) { return montarDia_(d, contexto); });

  var hoje = hoje_();
  var avisos = [];
  dias.forEach(function (dia) {
    if (dia.passado) return;
    Object.keys(dia.problemas).forEach(function (chave) {
      avisos.push({ data: dia.data, rotulo: dia.rotulo, texto: dia.problemas[chave] });
    });
  });

  return {
    modo: modo,
    referencia: formatarDataIso_(referencia),
    hoje: formatarDataIso_(hoje),
    titulo: titulo,
    anterior: formatarDataIso_(anterior),
    proximo: formatarDataIso_(proximo),
    dias: dias,
    avisos: avisos
  };
}

/** Carrega uma vez tudo que montarDia_ precisa para o intervalo. */
function contextoPainel_(inicio, fim) {
  var pessoas = mapaPessoas_();
  return {
    pessoas: pessoas,
    setoresAtivos: listarSetoresAtivos_(),
    lancamentos: listarLancamentosValendo_(inicio, fim),
    bloqueios: listarBloqueios_(inicio, fim),
    hoje: hoje_(),
    vagasMeioDia: obterConfigNumero('VAGAS_MEIO_DIA'),
    vagasPlantao: obterConfigNumero('VAGAS_PLANTAO'),
    sabadoMin: obterConfigNumero('SABADO_MIN'),
    sabadoMax: obterConfigNumero('SABADO_MAX')
  };
}

function montarDia_(data, c) {
  var doDia = c.lancamentos.filter(function (x) { return dentroDe_(data, x.inicio, x.fim); });
  var nomes = function (tipo, filtro) {
    return doDia
      .filter(function (x) { return x.tipo === tipo && (!filtro || filtro(x)); })
      .map(function (x) { return nomeDe_(c.pessoas, x.email); })
      .sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  };

  var bloqueios = bloqueiosDoDia_(c.bloqueios, data);
  var feriado = bloqueios.some(function (b) { return b.tipo === BLOQUEIO.FERIADO; });
  var dia = {
    data: formatarDataIso_(data),
    rotulo: DIAS_SEMANA_CURTO[data.getDay()] + ' ' + formatarDataBr_(data).substring(0, 5),
    diaSemana: data.getDay(),
    hoje: mesmoDia_(data, c.hoje),
    passado: data.getTime() < c.hoje.getTime(),
    feriado: feriado,
    bloqueios: bloqueios.map(function (b) { return { tipo: b.tipo, descricao: b.descricao }; }),
    meioDia: nomes(TIPO.MEIO_DIA),
    plantao: nomes(TIPO.PLANTAO),
    homeOffice: nomes(TIPO.HOME_OFFICE),
    ferias: nomes(TIPO.FERIAS),
    sabado: null,
    problemas: {}
  };

  if (ehDiaUtil_(data) && !feriado) {
    var pMeioDia = problemaDeVagas_(dia.meioDia.length, c.vagasMeioDia);
    if (pMeioDia) dia.problemas.meioDia = 'Meio-dia: ' + pMeioDia;
    var pPlantao = problemaDeVagas_(dia.plantao.length, c.vagasPlantao);
    if (pPlantao) dia.problemas.plantao = 'Plantão: ' + pPlantao;
  }

  if (ehSabado_(data)) {
    var escalados = doDia.filter(function (x) { return x.tipo === TIPO.SABADO; });
    dia.sabado = {
      t8: nomes(TIPO.SABADO, function (x) { return x.turno === TURNO.T8_11; }),
      t9: nomes(TIPO.SABADO, function (x) { return x.turno === TURNO.T9_12; }),
      total: escalados.length,
      bloqueado: bloqueios.some(function (b) { return b.tipo === BLOQUEIO.TREINAMENTO; })
    };
    if (!dia.sabado.bloqueado) {
      var total = escalados.length;
      if (total === 0) {
        dia.problemas.sabado = 'Sábado: sem ninguém';
      } else if (total < c.sabadoMin) {
        dia.problemas.sabado = 'Sábado: ' + total + ' pessoa' + (total > 1 ? 's' : '') + ' (mín. ' + c.sabadoMin + ')';
      } else if (total > c.sabadoMax) {
        dia.problemas.sabado = 'Sábado: ' + total + ' pessoas (máx. ' + c.sabadoMax + ')';
      }
      if (total > 0) {
        var semCobertura = setoresSemCobertura_(escalados, c);
        if (semCobertura.length) dia.problemas.setores = 'Sábado sem ' + semCobertura.join(', ');
      }
    }
  }

  return dia;
}

/** Texto do problema de contagem ou '' quando a quantidade bate com as vagas. */
function problemaDeVagas_(quantidade, vagas) {
  if (quantidade === vagas) return '';
  if (quantidade === 0) return 'sem ninguém';
  if (quantidade < vagas) {
    var faltam = vagas - quantidade;
    return faltam + ' vaga' + (faltam > 1 ? 's' : '');
  }
  return quantidade + ' pessoas (máx. ' + vagas + ')';
}

/** Setores ativos que nenhum dos escalados cobre (setor principal ou extra). */
function setoresSemCobertura_(escalados, c) {
  var cobertos = {};
  escalados.forEach(function (x) {
    var p = c.pessoas[x.email];
    if (!p) return;
    cobertos[p.setor] = true;
    p.setoresExtras.forEach(function (s) { cobertos[s] = true; });
  });
  return c.setoresAtivos.filter(function (s) { return !cobertos[s]; });
}

/** Quantidade de avisos abertos (hoje em diante, nas próximas 4 semanas) para o contador do menu. */
function contarAvisosAbertos() {
  exigirUsuario_();
  var inicio = hoje_();
  var fim = adicionarDias_(inicio, 27);
  var contexto = contextoPainel_(inicio, fim);
  return diasEntre_(inicio, fim).reduce(function (total, d) {
    return total + Object.keys(montarDia_(d, contexto).problemas).length;
  }, 0);
}
