/**
 * Pessoas, setores e identificação de quem está usando o sistema.
 * O e-mail corporativo é a chave de tudo; nome nunca é usado como identificador.
 */

/** Lista as pessoas do cadastro (aba Pessoas + setores extras), ativas ou não. */
function listarPessoas_() {
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
