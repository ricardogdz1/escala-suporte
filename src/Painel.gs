/**
 * Painel "quem está onde": monta a visão de um dia, semana ou mês
 * a partir de Lancamentos, Bloqueios e do cadastro.
 * Os problemas de cobertura (vagas e setores) viram avisos abertos.
 */

/**
 * Chamado pelo cliente.
 * @param {string} dataIso  dia de referência "yyyy-MM-dd" (vazio = hoje)
 * @param {string} modo     'hoje' | 'semana' | 'mes'
 *   hoje: cartões do dia + tabela da semana desse dia.
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
  } else {
    inicio = inicioDaSemana_(referencia);
    fim = adicionarDias_(inicio, 5); // segunda a sábado
    titulo = 'Semana de ' + inicio.getDate() + ' a ' + fim.getDate() + ' de ' + MESES[fim.getMonth()].toLowerCase();
    if (inicio.getMonth() !== fim.getMonth()) {
      titulo = 'Semana de ' + inicio.getDate() + '/' + MESES[inicio.getMonth()].toLowerCase().substring(0, 3) +
        ' a ' + fim.getDate() + '/' + MESES[fim.getMonth()].toLowerCase().substring(0, 3);
    }
    anterior = adicionarDias_(referencia, modo === 'hoje' ? -1 : -7);
    proximo = adicionarDias_(referencia, modo === 'hoje' ? 1 : 7);
  }

  var contexto = contextoPainel_(inicio, fim);
  var dias = diasEntre_(inicio, fim).map(function (d) { return montarDia_(d, contexto); });

  var avisos = [];
  dias.forEach(function (dia) {
    if (dia.passado) return;
    Object.keys(dia.problemas).forEach(function (chave) {
      var p = dia.problemas[chave];
      avisos.push({ data: dia.data, titulo: p.titulo, texto: p.texto, tela: p.tela });
    });
  });

  var diaRef = montarDia_(referencia, contextoPainel_(referencia, referencia));

  return {
    modo: modo,
    referencia: formatarDataIso_(referencia),
    referenciaExtenso: DIAS_SEMANA[referencia.getDay()] + (referencia.getDay() % 6 ? '-feira' : '') + ', ' +
      referencia.getDate() + ' de ' + MESES[referencia.getMonth()] + ' de ' + referencia.getFullYear(),
    hoje: formatarDataIso_(hoje_()),
    titulo: titulo,
    anterior: formatarDataIso_(anterior),
    proximo: formatarDataIso_(proximo),
    diaReferencia: diaRef,
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
  var diaCurto = formatarDataBr_(data).substring(0, 5);
  var nomeDia = DIAS_SEMANA[data.getDay()].toLowerCase();

  var bloqueios = bloqueiosDoDia_(c.bloqueios, data);
  var feriado = bloqueios.some(function (b) { return b.tipo === BLOQUEIO.FERIADO; });
  var dia = {
    data: formatarDataIso_(data),
    rotulo: DIAS_SEMANA_CURTO[data.getDay()] + ' ' + data.getDate(),
    rotuloCompleto: DIAS_SEMANA_CURTO[data.getDay()] + ' ' + diaCurto,
    diaSemana: data.getDay(),
    hoje: mesmoDia_(data, c.hoje),
    passado: data.getTime() < c.hoje.getTime(),
    feriado: feriado,
    bloqueios: bloqueios.map(function (b) { return { tipo: b.tipo, descricao: b.descricao }; }),
    meioDia: nomes(TIPO.MEIO_DIA),
    plantao: nomes(TIPO.PLANTAO),
    homeOffice: nomes(TIPO.HOME_OFFICE),
    ferias: doDia.filter(function (x) { return x.tipo === TIPO.FERIAS; }).map(function (x) {
      return { nome: nomeDe_(c.pessoas, x.email), ate: formatarDataBr_(x.fim).substring(0, 5) };
    }),
    sabado: null,
    problemas: {}
  };

  if (ehDiaUtil_(data) && !feriado) {
    var pMeioDia = problemaDeVagas_(dia.meioDia.length, c.vagasMeioDia);
    if (pMeioDia) {
      dia.problemas.meioDia = {
        curto: pMeioDia.curto, tela: 'meiodia',
        titulo: 'Meio-dia de ' + nomeDia + ' ' + diaCurto,
        texto: pMeioDia.texto
      };
    }
    var pPlantao = problemaDeVagas_(dia.plantao.length, c.vagasPlantao);
    if (pPlantao) {
      dia.problemas.plantao = {
        curto: pPlantao.curto, tela: 'meiodia',
        titulo: 'Plantão de ' + nomeDia + ' ' + diaCurto,
        texto: pPlantao.quantidade === 0 ? 'Ninguém escalado até as 20h.' : pPlantao.texto
      };
    }
  }

  if (ehSabado_(data)) {
    var escalados = doDia.filter(function (x) { return x.tipo === TIPO.SABADO; });
    var total = escalados.length;
    dia.sabado = {
      t8: nomes(TIPO.SABADO, function (x) { return x.turno === TURNO.T8_11; }),
      t9: nomes(TIPO.SABADO, function (x) { return x.turno === TURNO.T9_12; }),
      total: total,
      bloqueado: bloqueios.some(function (b) { return b.tipo === BLOQUEIO.TREINAMENTO; })
    };
    if (!dia.sabado.bloqueado) {
      if (total === 0) {
        dia.problemas.sabado = { curto: 'Sem ninguém', tela: 'sabados',
          titulo: 'Sábado ' + diaCurto + ' sem ninguém', texto: 'Nenhuma pessoa escalada. O mínimo é ' + c.sabadoMin + '.' };
      } else if (total < c.sabadoMin) {
        dia.problemas.sabado = { curto: total + ' pessoa' + (total > 1 ? 's' : '') + ' (mín. ' + c.sabadoMin + ')', tela: 'sabados',
          titulo: 'Sábado ' + diaCurto + ' com ' + total + ' pessoa' + (total > 1 ? 's' : ''), texto: 'O mínimo é ' + c.sabadoMin + '.' };
      } else if (total > c.sabadoMax) {
        dia.problemas.sabado = { curto: total + ' pessoas (máx. ' + c.sabadoMax + ')', tela: 'sabados',
          titulo: 'Sábado ' + diaCurto + ' com ' + total + ' pessoas', texto: 'O máximo é ' + c.sabadoMax + '.' };
      }
      if (total > 0) {
        var semCobertura = setoresSemCobertura_(escalados, c);
        if (semCobertura.length) {
          dia.problemas.setores = { curto: 'Sem ' + semCobertura.join(', '), tela: 'sabados',
            titulo: 'Sábado ' + diaCurto + ' sem ' + semCobertura.map(capitalizar_).join(', '),
            texto: semCobertura.length === 1 ? 'Nenhuma pessoa do setor escalada.' : 'Nenhuma pessoa desses setores escalada.' };
        }
      }
    }
  }

  return dia;
}

/** Problema de contagem ou null quando a quantidade bate com as vagas. */
function problemaDeVagas_(quantidade, vagas) {
  if (quantidade === vagas) return null;
  if (quantidade === 0) return { quantidade: 0, curto: 'Sem ninguém', texto: 'Nenhuma pessoa escalada.' };
  if (quantidade < vagas) {
    var faltam = vagas - quantidade;
    return { quantidade: quantidade, curto: faltam + ' vaga' + (faltam > 1 ? 's' : ''),
      texto: quantidade + ' de ' + vagas + ' vagas preenchida' + (quantidade > 1 ? 's' : '') + '.' };
  }
  return { quantidade: quantidade, curto: quantidade + ' pessoas (máx. ' + vagas + ')',
    texto: quantidade + ' pessoas para ' + vagas + ' vaga' + (vagas > 1 ? 's' : '') + '.' };
}

/** "CONTABILIDADE" -> "Contabilidade" */
function capitalizar_(texto) {
  var t = String(texto || '').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
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
