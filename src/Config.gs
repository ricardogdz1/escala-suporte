/**
 * Leitura da aba Config (Chave | Valor | Descrição).
 * Nada de limite, e-mail ou ID fica fixo no código: tudo vem daqui.
 * Os valores ficam em cache por 5 minutos; após editar a aba, chame limparCacheConfig().
 */

var CACHE_CONFIG_CHAVE = 'config_v1';
var CACHE_CONFIG_SEGUNDOS = 300;

/** Retorna todas as configs como objeto {CHAVE: valor}. */
function obterConfigTudo_() {
  var cache = CacheService.getScriptCache();
  var emCache = cache.get(CACHE_CONFIG_CHAVE);
  if (emCache) return JSON.parse(emCache);

  var config = {};
  lerAba_(ABA_CONFIG).forEach(function (linha) {
    var chave = String(linha['Chave'] || '').trim();
    if (chave) config[chave] = linha['Valor'];
  });
  cache.put(CACHE_CONFIG_CHAVE, JSON.stringify(config), CACHE_CONFIG_SEGUNDOS);
  return config;
}

/** Valor de uma chave. Se não existir na aba, usa o padrão de CONFIG_PADRAO. */
function obterConfig(chave) {
  var config = obterConfigTudo_();
  if (config[chave] !== undefined && config[chave] !== '') return config[chave];
  for (var i = 0; i < CONFIG_PADRAO.length; i++) {
    if (CONFIG_PADRAO[i][0] === chave) return CONFIG_PADRAO[i][1];
  }
  return '';
}

/** Valor numérico de uma chave. */
function obterConfigNumero(chave) {
  var n = Number(obterConfig(chave));
  return isNaN(n) ? 0 : n;
}

/** true se a chave está como "Sim". */
function obterConfigSim(chave) {
  return ehSim_(obterConfig(chave));
}

/** true quando o sistema está em modo teste (nenhum colega pode ser notificado). */
function modoTeste() {
  return obterConfigSim('MODO_TESTE');
}

function limparCacheConfig() {
  CacheService.getScriptCache().remove(CACHE_CONFIG_CHAVE);
}

/** Limpa todos os caches (Config e cadastro). Usado pelo menu da planilha e pelo onEdit. */
function limparCaches() {
  limparCacheConfig();
  limparCacheCadastro();
}

// ---------- Regras editáveis pelo gestor (janela "Regras da escala") ----------

/**
 * Quais chaves da Config o gestor edita pelo app, com rótulo e limites.
 * O resto (IDs de calendário, modo teste, importação) continua só na planilha:
 * são coisas de instalação, não do dia a dia.
 */
var REGRAS_EDITAVEIS = [
  { chave: 'SABADO_MIN', rotulo: 'Sábado: mínimo de pessoas', ajuda: 'Somando os dois turnos. Abaixo disso o sábado fica em âmbar.', min: 0, max: 40 },
  { chave: 'SABADO_MAX', rotulo: 'Sábado: máximo de pessoas', ajuda: 'Acima disso o sábado gera aviso.', min: 0, max: 40 },
  { chave: 'VAGAS_MEIO_DIA', rotulo: 'Meio-dia: pessoas por dia', ajuda: 'De segunda a sexta, até 12:30.', min: 0, max: 20 },
  { chave: 'VAGAS_PLANTAO', rotulo: 'Plantão: pessoas por dia útil', ajuda: 'De segunda a sexta, 18h às 20h.', min: 0, max: 20 },
  { chave: 'VAGAS_PLANTAO_SABADO', rotulo: 'Plantão: pessoas no sábado', ajuda: 'Sábado, 13h às 17h.', min: 0, max: 20 },
  { chave: 'VAGAS_HOME_OFFICE', rotulo: 'Home office: pessoas por semana', ajuda: 'Da equipe inteira, por semana.', min: 0, max: 20 },
  { chave: 'ANTECEDENCIA_FERIAS_DIAS', rotulo: 'Férias: antecedência mínima (dias)', ajuda: 'Pedir com menos que isso gera aviso.', min: 0, max: 365 },
  { chave: 'FERIAS_SOBREPOSICAO_MIN_DIAS', rotulo: 'Férias: sobreposição a partir de (dias)', ajuda: 'Duas pessoas juntas por menos dias que isso não viram aviso.', min: 1, max: 60 }
];

/** Valores atuais das regras, para a janela do gestor. */
function obterRegras() {
  exigirGestor_();
  return REGRAS_EDITAVEIS.map(function (r) {
    var item = { chave: r.chave, rotulo: r.rotulo, ajuda: r.ajuda, min: r.min, max: r.max, valor: obterConfigNumero(r.chave) };
    return item;
  });
}

/**
 * Salva as regras (só gestor). Valores fora do intervalo ou não numéricos são recusados,
 * porque aqui um número errado muda o aviso de todo mundo.
 * @param {Object} valores {CHAVE: número}
 */
function salvarRegras(valores) {
  var u = exigirGestor_();
  valores = valores || {};
  var aGravar = [];
  REGRAS_EDITAVEIS.forEach(function (r) {
    if (valores[r.chave] === undefined || valores[r.chave] === '') return;
    var n = Number(valores[r.chave]);
    if (isNaN(n) || n !== Math.floor(n)) throw new Error(r.rotulo + ': informe um número inteiro.');
    if (n < r.min || n > r.max) throw new Error(r.rotulo + ': use um valor entre ' + r.min + ' e ' + r.max + '.');
    aGravar.push({ chave: r.chave, valor: n });
  });
  if (!aGravar.length) return { ok: true, alteradas: 0 };

  var mapa = {};
  aGravar.forEach(function (g) { mapa[g.chave] = g.valor; });
  var minimo = mapa.SABADO_MIN !== undefined ? mapa.SABADO_MIN : obterConfigNumero('SABADO_MIN');
  var maximo = mapa.SABADO_MAX !== undefined ? mapa.SABADO_MAX : obterConfigNumero('SABADO_MAX');
  if (minimo > maximo) throw new Error('O mínimo do sábado (' + minimo + ') não pode ser maior que o máximo (' + maximo + ').');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var alteradas = 0;
  try {
    var linhas = {};
    lerAba_(ABA_CONFIG).forEach(function (l) { linhas[String(l['Chave'] || '').trim()] = l; });
    aGravar.forEach(function (g) {
      var atual = linhas[g.chave];
      if (atual) {
        if (Number(atual['Valor']) === g.valor) return;
        atualizarLinha_(ABA_CONFIG, atual._linha, { 'Valor': g.valor });
      } else {
        var padrao = CONFIG_PADRAO.filter(function (c) { return c[0] === g.chave; })[0];
        anexarLinha_(ABA_CONFIG, { 'Chave': g.chave, 'Valor': g.valor, 'Descrição': padrao ? padrao[2] : '' });
      }
      alteradas++;
    });
  } finally {
    lock.releaseLock();
  }
  limparCacheConfig();
  if (alteradas) {
    registrarNotificacao_('CONFIG', 'salvarRegras', '', '',
      aGravar.map(function (g) { return g.chave + '=' + g.valor; }).join(', '), 'salvo por ' + u.email);
  }
  return { ok: true, alteradas: alteradas };
}
