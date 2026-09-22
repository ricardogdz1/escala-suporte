/**
 * Cadastro de pessoas pelo app (só gestor): adicionar e inativar/reativar.
 * O resto da aba Pessoas (setores extras, correções de nome) continua sendo
 * editado na planilha, que é da gestão.
 *
 * Nunca apagamos uma pessoa: inativar preserva o histórico de escalas dela.
 */

/** Lista para a janela do gestor: ativos primeiro, com contagem de lançamentos futuros. */
function obterPessoas() {
  exigirGestor_();
  var hoje = hoje_();
  var futuros = {};
  listarLancamentos_({ de: hoje }).forEach(function (x) {
    if (statusValendo_(x.tipo).indexOf(x.status) < 0) return;
    futuros[x.email] = (futuros[x.email] || 0) + 1;
  });

  var pessoas = listarPessoas_().map(function (p) {
    return {
      email: p.email, nome: p.nome, nomeExibicao: p.nomeExibicao, setor: p.setor,
      setoresExtras: p.setoresExtras, perfil: p.perfil, ativo: p.ativo,
      dataEntrada: p.dataEntrada, lancamentosFuturos: futuros[p.email] || 0
    };
  }).sort(function (a, b) {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    return a.nomeExibicao.localeCompare(b.nomeExibicao, 'pt-BR');
  });

  return {
    pessoas: pessoas,
    setores: listarSetoresAtivos_(),
    perfis: [PERFIL.COLABORADOR, PERFIL.GESTOR],
    dominio: String(obterConfig('DOMINIO')).trim(),
    hoje: formatarDataIso_(hoje),
    meuEmail: obterUsuarioAtual().email
  };
}

/** "ricardo.ferronato" -> "Ricardo Ferronato" (sugestão de nome a partir do e-mail). */
function nomeSugerido_(email) {
  return String(email || '').split('@')[0].split(/[._-]+/)
    .filter(function (p) { return p; })
    .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); })
    .join(' ');
}

/**
 * Adiciona uma pessoa ao cadastro (só gestor).
 * @param {Object} dados {email, nome?, nomeExibicao?, setor, perfil?, dataEntrada?}
 */
function adicionarPessoa(dados) {
  var u = exigirGestor_();
  dados = dados || {};
  var email = normalizarEmail_(dados.email);
  if (!email || email.indexOf('@') < 0) throw new Error('Informe o e-mail corporativo da pessoa.');

  var dominio = String(obterConfig('DOMINIO')).trim().toLowerCase();
  if (dominio && email.split('@')[1] !== dominio) {
    throw new Error('O e-mail precisa ser do domínio ' + dominio + '.');
  }

  var setor = String(dados.setor || '').trim();
  var setoresAtivos = listarSetoresAtivos_();
  if (!setor) throw new Error('Escolha o setor principal.');
  if (setoresAtivos.indexOf(setor) < 0) throw new Error('Setor desconhecido: ' + setor + '.');

  var perfil = String(dados.perfil || PERFIL.COLABORADOR).trim();
  if ([PERFIL.COLABORADOR, PERFIL.GESTOR].indexOf(perfil) < 0) throw new Error('Perfil inválido: ' + perfil + '.');

  var nome = String(dados.nome || '').trim() || nomeSugerido_(email);
  var exibicao = String(dados.nomeExibicao || '').trim() || nome.split(' ')[0];
  var entrada = paraData_(dados.dataEntrada) || hoje_();

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var existente = listarPessoas_().filter(function (p) { return p.email === email; })[0];
    if (existente) {
      throw new Error(existente.nomeExibicao + ' já está no cadastro' +
        (existente.ativo ? '.' : ' (inativa). Use "Reativar" na lista.'));
    }
    // escreve só as colunas de dados: a aba tem coluna de fórmula (Qtd. setores extras)
    var aba = aba_(ABA_PESSOAS);
    var cabecalho = cabecalhoDaAba_(aba);
    var linha = aba.getLastRow() + 1;
    var valores = {};
    valores['E-mail corporativo'] = email;
    valores['Nome completo'] = nome;
    valores['Nome de exibição'] = exibicao;
    valores['Setor principal'] = setor;
    valores['Perfil'] = perfil;
    valores['Ativo'] = SIM;
    valores['Data de entrada na equipe'] = entrada;
    Object.keys(valores).forEach(function (coluna) {
      var col = cabecalho.indexOf(coluna);
      if (col >= 0) aba.getRange(linha, col + 1).setValue(valores[coluna]);
    });
    esquecerAba_(ABA_PESSOAS);
  } finally {
    lock.releaseLock();
  }
  limparCacheCadastro();
  registrarNotificacao_('CADASTRO', 'adicionarPessoa', '', '', email + ' (' + setor + ')', 'adicionada por ' + u.email);
  return { ok: true, email: email, nome: exibicao };
}

/**
 * Inativa ou reativa uma pessoa (só gestor). Os lançamentos dela continuam existindo.
 * @param {Object} dados {email, ativo: boolean}
 * @param {boolean} confirmado true depois do "Salvar mesmo assim"
 */
function definirPessoaAtiva(dados, confirmado) {
  var u = exigirGestor_();
  dados = dados || {};
  var email = normalizarEmail_(dados.email);
  var ativo = !!dados.ativo;
  if (!email) throw new Error('Pessoa não informada.');
  if (email === u.email && !ativo) throw new Error('Você não pode inativar a si mesmo.');

  var linhas = lerAba_(ABA_PESSOAS).filter(function (l) { return normalizarEmail_(l['E-mail corporativo']) === email; });
  if (!linhas.length) throw new Error('Pessoa não encontrada no cadastro.');
  var pessoa = listarPessoas_().filter(function (p) { return p.email === email; })[0];

  if (!ativo) {
    var avisos = [];
    var futuros = listarLancamentos_({ de: hoje_(), email: email }).filter(function (x) {
      return statusValendo_(x.tipo).indexOf(x.status) >= 0;
    });
    if (futuros.length) {
      avisos.push(aviso_('PESSOA_COM_ESCALA', pessoa.nomeExibicao + ' tem ' + futuros.length + ' lançamento' + (futuros.length > 1 ? 's' : '') + ' a partir de hoje',
        'Eles continuam valendo. Tire a pessoa das escalas futuras se ela não for mais cumpri-las.'));
    }
    if (pessoa.perfil === PERFIL.GESTOR && emailsGestores_().length <= 1) {
      avisos.push(aviso_('ULTIMO_GESTOR', 'É o único gestor ativo', 'Sem gestor ativo, ninguém aprova férias nem recebe as pendências.'));
    }
    if (avisos.length && !confirmado) return respostaComAvisos_(avisos);
    if (avisos.length) registrarAvisosIgnorados_(u, '', avisos);
  }

  atualizarLinha_(ABA_PESSOAS, linhas[0]._linha, { 'Ativo': ativo ? SIM : NAO });
  limparCacheCadastro();
  registrarNotificacao_('CADASTRO', 'definirPessoaAtiva', '', '', email, (ativo ? 'reativada' : 'inativada') + ' por ' + u.email);
  return { ok: true, ativo: ativo };
}
