/**
 * Espelho da planilha oficial da equipe (a que o gestor continua usando durante a transição).
 *
 * REGRA DESTE ARQUIVO: só leitura da planilha oficial. Nenhuma função aqui grava nela —
 * as gravações acontecem apenas na planilha-banco do sistema.
 *
 * Primeiro passo (este): descobrir o formato do arquivo e o desenho das abas.
 */

/** Extrai o ID de uma URL de planilha; aceita também o ID puro. */
function idDePlanilha_(texto) {
  var t = String(texto || '').trim();
  var m = t.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(t) ? t : '';
}

/** Menu: pergunta o link da planilha oficial e guarda só o ID na aba Config. */
function definirPlanilhaOficial() {
  var ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    // Rodada pelo editor: não existe tela para a caixa de diálogo.
    throw new Error('Esta função só funciona pelo menu da planilha: Escala Suporte > ' +
      'Definir planilha oficial (link). Pelo editor, use inspecionarPlanilhaOficial() ' +
      'depois de colar o ID na aba Config, linha ID_PLANILHA_OFICIAL.');
  }
  var r = ui.prompt('Planilha oficial da equipe',
    'Cole o link (ou o ID) da planilha que a equipe usa hoje.\n\nO sistema só vai LER dela.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var id = idDePlanilha_(r.getResponseText());
  if (!id) { ui.alert('Não reconheci um ID de planilha nesse texto.'); return; }
  gravarConfig_('ID_PLANILHA_OFICIAL', id);
  ui.alert('Guardado: ' + id + '\n\nAgora rode "Inspecionar planilha oficial" no mesmo menu.');
}

/**
 * Relatório de leitura da planilha oficial: formato, abas, tamanho e as primeiras linhas
 * de cada aba. Serve para mapear as grades antes de escrever o espelho.
 * Não altera nada — nem na planilha oficial, nem na do sistema.
 */
function inspecionarPlanilhaOficial() {
  // Aceita o link inteiro na Config, não só o ID.
  var id = idDePlanilha_(obterConfig('ID_PLANILHA_OFICIAL'));
  if (!id) throw new Error('Rode "Definir planilha oficial" no menu Escala Suporte e cole o link.');

  var linhas = ['ID: ' + id];
  var ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (e) {
    linhas.push('NÃO ABRIU COMO PLANILHA GOOGLE: ' + e.message);
    linhas.push('Se for um arquivo .xlsx, a leitura terá que ser feita sobre uma cópia convertida.');
    Logger.log(linhas.join(String.fromCharCode(10)));
    return;
  }

  linhas.push('Nome: ' + ss.getName());
  linhas.push('Formato: Planilha Google (leitura direta, sem cópia)');
  linhas.push('Fuso da planilha: ' + ss.getSpreadsheetTimeZone());

  ss.getSheets().forEach(function (aba) {
    var nl = aba.getLastRow(), nc = aba.getLastColumn();
    linhas.push('');
    linhas.push('--- ABA "' + aba.getName() + '" · gid ' + aba.getSheetId() +
      ' · ' + nl + ' linhas x ' + nc + ' colunas' + (aba.isSheetHidden() ? ' · OCULTA' : ''));
    if (!nl || !nc) { linhas.push('(vazia)'); return; }
    aba.getRange(1, 1, Math.min(6, nl), Math.min(10, nc)).getDisplayValues()
      .forEach(function (l, i) {
        linhas.push((i + 1) + ': ' + l.map(function (c) {
          c = String(c).replace(/\s+/g, ' ').trim();
          return c.length > 18 ? c.substring(0, 17) + '…' : c;
        }).join(' | '));
      });
  });

  Logger.log(linhas.join(String.fromCharCode(10)));
}

/** Abre a planilha oficial para leitura. Só leitura: nada aqui grava nela. */
function abrirPlanilhaOficial_() {
  var id = idDePlanilha_(obterConfig('ID_PLANILHA_OFICIAL'));
  if (!id) throw new Error('Preencha Config > ID_PLANILHA_OFICIAL (menu Escala Suporte > Definir planilha oficial).');
  return SpreadsheetApp.openById(id);
}

/** "1:Aline, 2:Camila, 24-40:vazio, …" — revela blocos empilhados na grade. */
function mapaColunaA_(valores) {
  var partes = [];
  var i = 0;
  while (i < valores.length && partes.length < 60) {
    if (!valores[i]) {
      var j = i;
      while (j < valores.length && !valores[j]) j++;
      partes.push((i + 1) + (j - i > 1 ? '-' + j : '') + ':vazio');
      i = j;
    } else {
      partes.push((i + 1) + ':' + (valores[i].length > 14 ? valores[i].substring(0, 13) + '…' : valores[i]));
      i++;
    }
  }
  if (i < valores.length) partes.push('… até ' + valores.length);
  return partes.join(', ');
}

/**
 * Segunda inspeção: só as cinco abas que o sistema usa, olhando o que faltou na primeira —
 * o fim do cabeçalho (colunas recentes), se o sábado traz turno e onde ficam os blocos de pessoas.
 */
function inspecionarGradesOficiais() {
  var ss = abrirPlanilhaOficial_();
  var linhas = [];
  [ABAS_ANTIGAS.sabados, ABAS_ANTIGAS.meioDia, ABAS_ANTIGAS.homeOffice,
   ABAS_ANTIGAS.plantoes, ABAS_ANTIGAS.feriasAba].forEach(function (nome) {
    linhas.push('');
    var aba;
    try { aba = abaAntiga_(ss, nome); } catch (e) { linhas.push('=== ' + nome + ': ' + e.message); return; }
    var nl = aba.getLastRow(), nc = aba.getLastColumn();
    linhas.push('=== ' + nome + ' · ' + nl + ' x ' + nc);

    var cabecalho = aba.getRange(1, 1, 1, nc).getValues()[0];
    var datas = 0, comTurno = 0, texto = 0, vazias = 0;
    cabecalho.forEach(function (v) {
      if (v instanceof Date) datas++;
      else if (String(v || '').trim() === '') vazias++;
      else if (/\(\d{1,2}:\d{2}\)/.test(String(v))) comTurno++;
      else texto++;
    });
    linhas.push('Cabeçalho: ' + datas + ' data(s), ' + comTurno + ' com turno "(hh:mm)", ' +
      texto + ' outro(s) texto(s), ' + vazias + ' vazia(s)');

    var ini = Math.max(1, nc - 9);
    linhas.push('Últimas colunas (' + ini + '..' + nc + '): ' +
      aba.getRange(1, ini, 1, nc - ini + 1).getDisplayValues()[0].map(function (c) {
        c = String(c).replace(/\s+/g, ' ').trim();
        return c.length > 20 ? c.substring(0, 19) + '…' : (c || '·');
      }).join(' | '));

    linhas.push('Coluna A: ' + mapaColunaA_(
      aba.getRange(1, 1, nl, 1).getDisplayValues().map(function (l) { return String(l[0] || '').trim(); })));
  });
  Logger.log(linhas.join(String.fromCharCode(10)));
}

/**
 * O que está de fato marcado numa grade: contagem por ano, textos distintos e alguns exemplos.
 * Responde "a aba está vazia no período?" sem precisar abrir a planilha.
 */
function inspecionarMarcasOficiais() {
  var ss = abrirPlanilhaOficial_();
  var linhas = [];
  [ABAS_ANTIGAS.plantoes, ABAS_ANTIGAS.homeOffice].forEach(function (nome) {
    var aba = abaAntiga_(ss, nome);
    var g = lerGrade_(aba, 1, 2);
    var porAno = {}, textos = {}, exemplos = [], total = 0;
    g.pessoas.forEach(function (p) {
      for (var c = 1; c < g.cabecalho.length; c++) {
        var data = g.cabecalho[c] instanceof Date ? paraData_(g.cabecalho[c]) : null;
        var v = String(p.valores[c] || '').replace(/\s+/g, ' ').trim();
        if (!data || !v) continue;
        total++;
        var ano = data.getFullYear();
        porAno[ano] = (porAno[ano] || 0) + 1;
        var t = v.length > 20 ? v.substring(0, 19) + '…' : v;
        textos[t] = (textos[t] || 0) + 1;
        if (ano >= 2026 && exemplos.length < 8) {
          exemplos.push(p.nome + ' em ' + formatarDataBr_(data) + ' = "' + t + '"');
        }
      }
    });
    linhas.push('');
    linhas.push('=== ' + nome + ' · ' + g.pessoas.length + ' pessoas lidas · ' + total + ' células marcadas');
    linhas.push('Por ano: ' + Object.keys(porAno).sort().map(function (a) { return a + ': ' + porAno[a]; }).join(', '));
    linhas.push('Textos: ' + Object.keys(textos).sort(function (a, b) { return textos[b] - textos[a]; })
      .slice(0, 12).map(function (t) { return '"' + t + '" x' + textos[t]; }).join(', '));
    linhas.push('Exemplos 2026+: ' + (exemplos.length ? exemplos.join(' · ') : 'NENHUM'));
  });
  Logger.log(linhas.join(String.fromCharCode(10)));
}
