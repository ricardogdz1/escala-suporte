/**
 * Painel: monta a visão de hoje e de dois períodos (esta semana + próxima, ou este mês + próximo)
 * a partir de Lancamentos, Bloqueios e do cadastro.
 * Os problemas de cobertura (vagas e setores) viram avisos abertos.
 */

/**
 * Chamado pelo cliente.
 * @param {string} modo 'semana' | 'mes'
 * Sempre devolve o período atual e o seguinte (esta semana + próxima, ou este mês + próximo),
 * além dos cartões de hoje (férias, home office, meio-dia, plantão) e dos avisos abertos.
 */
function obterPainel(modo) {
  var u = exigirUsuario_();
  modo = modo === 'mes' ? 'mes' : 'semana';
  var hoje = hoje_();

  var periodos = [0, 1].map(function (n) { return montarPeriodo_(modo, hoje, n); });
  var diaHoje = montarDia_(hoje, contextoPainel_(hoje, hoje));
  var avisos = avisosAbertos_(u);

  // avisos desligados nas configurações da pessoa somem do painel (lista e células da tabela)
  var ligados = preferenciasDe_(mapaPreferencias_(), u.email).avisos;
  var grupoDoProblema = { meioDia: 'meiodia', plantao: 'plantao', sabado: 'sabados', setores: 'sabados', homeOffice: 'homeoffice' };
  var filtrarDia = function (dia) {
    Object.keys(dia.problemas).forEach(function (k) { if (ligados[grupoDoProblema[k]] === false) delete dia.problemas[k]; });
  };
  periodos.forEach(function (p) { p.dias.forEach(filtrarDia); });
  filtrarDia(diaHoje);
  avisos.lista = avisos.lista.filter(function (a) { return ligados[a.grupo] !== false; });

  return {
    modo: modo,
    hoje: formatarDataIso_(hoje),
    hojeExtenso: DIAS_SEMANA[hoje.getDay()] + (hoje.getDay() % 6 ? '-feira' : '') + ', ' +
      hoje.getDate() + ' de ' + MESES[hoje.getMonth()] + ' de ' + hoje.getFullYear(),
    diaHoje: diaHoje,
    periodos: periodos,
    trocas: listarMinhasTrocas_(u),
    // avisos abertos: de hoje até o fim do mês que vem, sempre (não muda com o período exibido)
    avisos: avisos.lista,
    avisosAte: avisos.ate
  };
}

/**
 * Um período da tabela: semana (segunda a sábado) ou mês, deslocado n períodos a partir de hoje.
 * @return {{rotulo: string, titulo: string, dias: Array}}
 */
function montarPeriodo_(modo, hoje, n) {
  var inicio, fim, titulo, rotulo;
  if (modo === 'mes') {
    var ref = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1);
    inicio = inicioDoMes_(ref);
    fim = fimDoMes_(ref);
    titulo = MESES[inicio.getMonth()] + ' de ' + inicio.getFullYear();
    rotulo = n === 0 ? 'Este mês' : 'Próximo mês';
  } else {
    inicio = adicionarDias_(inicioDaSemana_(hoje), 7 * n);
    fim = adicionarDias_(inicio, 5); // segunda a sábado
    if (inicio.getMonth() === fim.getMonth()) {
      titulo = 'Semana de ' + inicio.getDate() + ' a ' + fim.getDate() + ' de ' + MESES[fim.getMonth()].toLowerCase();
    } else {
      titulo = 'Semana de ' + inicio.getDate() + '/' + MESES[inicio.getMonth()].toLowerCase().substring(0, 3) +
        ' a ' + fim.getDate() + '/' + MESES[fim.getMonth()].toLowerCase().substring(0, 3);
    }
    rotulo = n === 0 ? 'Esta semana' : 'Próxima semana';
  }
  var contexto = contextoPainel_(inicio, fim);
  return {
    rotulo: rotulo,
    titulo: titulo,
    dias: diasEntre_(inicio, fim).map(function (d) { return montarDia_(d, contexto); })
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
    vagasPlantaoSabado: obterConfigNumero('VAGAS_PLANTAO_SABADO'),
    vagasHomeOffice: obterConfigNumero('VAGAS_HOME_OFFICE') || 1,
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
    bloqueios: bloqueios.map(function (b) { return { tipo: b.tipo, titulo: tituloBloqueio_(b) }; }),
    meioDia: nomes(TIPO.MEIO_DIA),
    plantao: nomes(TIPO.PLANTAO),
    homeOffice: nomes(TIPO.HOME_OFFICE),
    ferias: doDia.filter(function (x) { return x.tipo === TIPO.FERIAS; }).map(function (x) {
      return { nome: nomeDe_(c.pessoas, x.email), ate: formatarDataBr_(x.fim).substring(0, 5) };
    }),
    sabado: null,
    problemas: {}
  };

  // meio-dia: segunda a sexta. plantão: segunda a sexta (18h–20h) e sábado (13h–17h). Nunca em feriado.
  dia.plantaoAplica = (ehDiaUtil_(data) || ehSabado_(data)) && !feriado;
  dia.plantaoHorario = ehSabado_(data) ? '13h–17h' : 'até 20h';
  // meio-dia é organizado na segunda de cada semana: só a semana atual gera pendência
  var semanaAtual = inicioDaSemana_(data).getTime() === inicioDaSemana_(c.hoje).getTime();
  if (ehDiaUtil_(data) && !feriado && semanaAtual) {
    var pMeioDia = problemaDeVagas_(dia.meioDia.length, c.vagasMeioDia);
    if (pMeioDia) {
      dia.problemas.meioDia = {
        curto: pMeioDia.curto, tela: 'meiodia', grupo: 'meiodia',
        titulo: 'Meio-dia de ' + nomeDia + ' ' + diaCurto,
        texto: pMeioDia.texto
      };
    }
  }
  if (dia.plantaoAplica) {
    var vagasPlantao = ehSabado_(data) ? c.vagasPlantaoSabado : c.vagasPlantao;
    var pPlantao = problemaDeVagas_(dia.plantao.length, vagasPlantao);
    if (pPlantao) {
      dia.problemas.plantao = {
        curto: pPlantao.curto, tela: 'plantao', grupo: 'plantao',
        titulo: 'Plantão de ' + nomeDia + ' ' + diaCurto,
        texto: pPlantao.quantidade === 0 ? 'Ninguém escalado (' + (ehSabado_(data) ? '13h–17h' : '18h–20h') + ').' : pPlantao.texto
      };
    }
  }

  // home office: um aviso por semana (na segunda) quando há mais gente que vaga ou reserva em semana presencial
  if (data.getDay() === 1) {
    var sexta = adicionarDias_(data, 4);
    var semanaBr = diaCurto + ' a ' + formatarDataBr_(sexta).substring(0, 5);
    var presencial = bloqueios.filter(function (b) { return b.tipo === BLOQUEIO.SEMANA_PRESENCIAL; });
    if (dia.homeOffice.length > c.vagasHomeOffice) {
      dia.problemas.homeOffice = { curto: dia.homeOffice.length + ' pessoas', tela: 'homeoffice', grupo: 'homeoffice',
        titulo: 'Home office na semana de ' + semanaBr, texto: dia.homeOffice.length + ' pessoas para ' + c.vagasHomeOffice + ' vaga' + (c.vagasHomeOffice === 1 ? '' : 's') + ': ' + dia.homeOffice.join(', ') + '.' };
    } else if (presencial.length && dia.homeOffice.length) {
      dia.problemas.homeOffice = { curto: 'Semana presencial', tela: 'homeoffice', grupo: 'homeoffice',
        titulo: 'Home office em semana presencial (' + semanaBr + ')', texto: dia.homeOffice.join(', ') + ' com reserva numa semana definida como presencial.' };
    }
  }

  if (ehSabado_(data)) {
    // quem está em treinamento aparece, mas não conta para mínimo/máximo nem cobre setor
    var escalados = doDia.filter(function (x) { return x.tipo === TIPO.SABADO && !x.treinamento; });
    var total = escalados.length;
    dia.sabado = {
      t8: nomes(TIPO.SABADO, function (x) { return x.turno === TURNO.T8_11; }),
      t9: nomes(TIPO.SABADO, function (x) { return x.turno === TURNO.T9_12; }),
      total: total,
      bloqueado: bloqueios.some(function (b) { return b.tipo === BLOQUEIO.TREINAMENTO; })
    };
    if (!dia.sabado.bloqueado) {
      if (total === 0) {
        dia.problemas.sabado = { curto: 'Sem ninguém', tela: 'sabados', grupo: 'sabados',
          titulo: 'Sábado ' + diaCurto + ' sem ninguém', texto: 'Nenhuma pessoa escalada. O mínimo é ' + c.sabadoMin + '.' };
      } else if (total < c.sabadoMin) {
        dia.problemas.sabado = { curto: total + ' pessoa' + (total > 1 ? 's' : '') + ' (mín. ' + c.sabadoMin + ')', tela: 'sabados', grupo: 'sabados',
          titulo: 'Sábado ' + diaCurto + ' com ' + total + ' pessoa' + (total > 1 ? 's' : ''), texto: 'O mínimo é ' + c.sabadoMin + '.' };
      } else if (total > c.sabadoMax) {
        dia.problemas.sabado = { curto: total + ' pessoas (máx. ' + c.sabadoMax + ')', tela: 'sabados', grupo: 'sabados',
          titulo: 'Sábado ' + diaCurto + ' com ' + total + ' pessoas', texto: 'O máximo é ' + c.sabadoMax + '.' };
      }
      if (total > 0) {
        var semCobertura = setoresSemCobertura_(escalados, c);
        if (semCobertura.length) {
          dia.problemas.setores = { curto: 'Sem ' + semCobertura.join(', '), tela: 'sabados', grupo: 'sabados',
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

/**
 * Avisos abertos: de hoje até o fim do mês seguinte.
 * Cada aviso traz `grupo` (sabados, plantao, meiodia, homeoffice, ferias) para a lista agrupada do painel.
 * @return {{lista: Array, ate: string}} ate = "dd/MM" do último dia considerado
 */
function avisosAbertos_(u) {
  var inicio = hoje_();
  var fim = fimDoMes_(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1));
  var contexto = contextoPainel_(inicio, fim);
  var lista = [];
  diasEntre_(inicio, fim).forEach(function (d) {
    var dia = montarDia_(d, contexto);
    Object.keys(dia.problemas).forEach(function (chave) {
      var p = dia.problemas[chave];
      lista.push({ data: dia.data, grupo: p.grupo, titulo: p.titulo, texto: p.texto, tela: p.tela });
    });
  });
  if (u) lista = lista.concat(avisosFeriasPainel_(u));
  lista.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
  return { lista: lista, ate: formatarDataBr_(fim).substring(0, 5) };
}
