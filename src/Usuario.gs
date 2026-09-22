/**
 * Pessoas, setores e identificação de quem está usando o sistema.
 * O e-mail corporativo é a chave de tudo; nome nunca é usado como identificador.
 */

/**
 * O cadastro (Pessoas, Setores, Setores extras) muda raramente e é lido em toda chamada do cliente,
 * então fica 5 minutos no CacheService. O gatilho onEdit da planilha (Setup.gs) limpa o cache
 * quando o gestor edita essas abas, e o menu "Recarregar configurações" também.
 */
var CACHE_CADASTRO_CHAVE = 'cadastro_v1';
var CACHE_CADASTRO_SEGUNDOS = 300;
var cadastroDaExecucao_ = null; // evita consultar o CacheService várias vezes na mesma chamada

function obterCadastro_() {
  if (cadastroDaExecucao_) return cadastroDaExecucao_;

  var cache = CacheService.getScriptCache();
  var emCache = cache.get(CACHE_CADASTRO_CHAVE);
  if (emCache) {
    cadastroDaExecucao_ = JSON.parse(emCache);
    return cadastroDaExecucao_;
  }

  var cadastro = { pessoas: lerPessoasDaPlanilha_(), setores: lerSetoresDaPlanilha_() };
  try {
    cache.put(CACHE_CADASTRO_CHAVE, JSON.stringify(cadastro), CACHE_CADASTRO_SEGUNDOS);
  } catch (e) {
    // cache é só aceleração: se falhar (ex.: valor grande demais), segue lendo da planilha
  }
  cadastroDaExecucao_ = cadastro;
  return cadastro;
}

function limparCacheCadastro() {
  cadastroDaExecucao_ = null;
  CacheService.getScriptCache().remove(CACHE_CADASTRO_CHAVE);
}

/** Lista as pessoas do cadastro (aba Pessoas + setores extras), ativas ou não. Objetos novos a cada chamada. */
function listarPessoas_() {
  return obterCadastro_().pessoas.map(function (p) {
    var copia = {};
    Object.keys(p).forEach(function (k) { copia[k] = k === 'setoresExtras' ? p[k].slice() : p[k]; });
    return copia;
  });
}

function lerPessoasDaPlanilha_() {
  var extras = {};
  lerAba_(ABA_SETORES_EXTRAS).forEach(function (l) {
    var email = normalizarEmail_(l['E-mail corporativo']);
    var setor = String(l['Setor extra'] || '').trim();
    if (!email || !setor) return;
    if (!extras[email]) extras[email] = [];
    if (extras[email].indexOf(setor) < 0) extras[email].push(setor);
  });

  return lerAba_(ABA_PESSOAS)
    .map(function (l) {
      var email = normalizarEmail_(l['E-mail corporativo']);
      if (!email) return null;
      var nome = String(l['Nome completo'] || '').trim();
      var exibicao = String(l['Nome de exibição'] || '').trim() || nome.split(' ')[0];
      return {
        email: email,
        nome: nome,
        nomeExibicao: exibicao,
        setor: String(l['Setor principal'] || '').trim(),
        setoresExtras: extras[email] || [],
        perfil: String(l['Perfil'] || PERFIL.COLABORADOR).trim(),
        ativo: ehSim_(l['Ativo']),
        dataEntrada: formatarDataIso_(l['Data de entrada na equipe'])
      };
    })
    .filter(function (p) { return p; });
}

/** Só as pessoas ativas, ordenadas pelo nome de exibição. */
function listarPessoasAtivas_() {
  return listarPessoas_()
    .filter(function (p) { return p.ativo; })
    .sort(function (a, b) { return a.nomeExibicao.localeCompare(b.nomeExibicao, 'pt-BR'); });
}

/** Mapa e-mail -> pessoa, para resolver nomes rapidamente. */
function mapaPessoas_() {
  var mapa = {};
  listarPessoas_().forEach(function (p) { mapa[p.email] = p; });
  return mapa;
}

/** Nome de exibição de um e-mail (ou o próprio e-mail se não estiver no cadastro). */
function nomeDe_(mapa, email) {
  var p = mapa[normalizarEmail_(email)];
  return p ? p.nomeExibicao : String(email || '');
}

/** Setores cadastrados: [{nome, ativo}]. */
function listarSetores_() {
  return obterCadastro_().setores.map(function (s) { return { nome: s.nome, ativo: s.ativo }; });
}

function lerSetoresDaPlanilha_() {
  return lerAba_(ABA_SETORES)
    .map(function (l) {
      return { nome: String(l['Setor'] || '').trim(), ativo: ehSim_(l['Ativo']) };
    })
    .filter(function (s) { return s.nome; });
}

function listarSetoresAtivos_() {
  return listarSetores_().filter(function (s) { return s.ativo; }).map(function (s) { return s.nome; });
}

/** E-mails de todos os gestores ativos (recebem avisos e resumo semanal). */
function emailsGestores_() {
  return listarPessoasAtivas_()
    .filter(function (p) { return p.perfil === PERFIL.GESTOR; })
    .map(function (p) { return p.email; });
}

/**
 * Quem está usando o sistema agora, com base na conta Google logada.
 * Retorna sempre um objeto; `autorizado` diz se a pessoa pode usar o app.
 */
function obterUsuarioAtual() {
  var email = normalizarEmail_(Session.getActiveUser().getEmail());
  var base = { email: email, autorizado: false, gestor: false, motivo: '' };

  if (!email) {
    base.motivo = 'Não foi possível identificar sua conta Google. Entre com a conta corporativa e tente de novo.';
    return base;
  }

  var pessoa = mapaPessoas_()[email];
  if (!pessoa) {
    base.motivo = 'O e-mail ' + email + ' não está no cadastro da equipe. Peça ao gestor para incluir você na aba Pessoas.';
    return base;
  }
  if (!pessoa.ativo) {
    base.motivo = 'Seu cadastro está inativo. Fale com o gestor.';
    return base;
  }

  pessoa.autorizado = true;
  pessoa.gestor = pessoa.perfil === PERFIL.GESTOR;
  pessoa.motivo = '';
  pessoa.modoTeste = modoTeste();
  return pessoa;
}

/** Garante que quem chama está autorizado; usado no início de toda função exposta ao cliente. */
function exigirUsuario_() {
  var u = obterUsuarioAtual();
  if (!u.autorizado) throw new Error(u.motivo || 'Acesso não autorizado.');
  return u;
}

/** Idem, mas só para gestores. */
function exigirGestor_() {
  var u = exigirUsuario_();
  if (!u.gestor) throw new Error('Só o gestor pode fazer isso.');
  return u;
}
