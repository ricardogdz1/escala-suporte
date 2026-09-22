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
