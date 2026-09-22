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

/**
 * Diagnóstico (rodar no editor): mostra em qual etapa obterPessoas falha ou demora.
 * Útil quando a janela "Pessoas" não carrega no app.
 */
function diagnosticoPessoas() {
  var etapas = [];
  var marcar = function (nome, fn) {
    var t = new Date().getTime();
    var r = fn();
    etapas.push(nome + ': ' + (new Date().getTime() - t) + ' ms' + (r === undefined ? '' : ' → ' + r));
    return r;
  };
  try {
    marcar('usuário', function () {
      var u = obterUsuarioAtual();
      return u.email + ' (gestor: ' + u.gestor + ')';
    });
    marcar('pessoas no cadastro', function () { return listarPessoas_().length; });
    marcar('setores ativos', function () { return listarSetoresAtivos_().join(', '); });
    marcar('lançamentos de hoje em diante', function () { return listarLancamentos_({ de: hoje_() }).length; });
    var dados = marcar('obterPessoas()', function () {
      var d = obterPessoas();
      return d.pessoas.length + ' pessoas, ' + d.setores.length + ' setores';
    });
    marcar('resposta serializável', function () {
      return JSON.stringify(obterPessoas()).length + ' caracteres';
    });
    Logger.log('OK\n' + etapas.join('\n'));
  } catch (e) {
    Logger.log('FALHOU em: ' + (etapas.length ? etapas[etapas.length - 1] : 'primeira etapa') +
      '\n' + etapas.join('\n') + '\nERRO: ' + e.message + '\n' + (e.stack || ''));
    throw e;
  }
}

/**
 * Troca o setor principal e os setores extras de uma pessoa (só gestor).
 * Setor principal: um só, usado na fila e na exibição.
 * Setores extras: quantos precisar — a pessoa cobre todos eles no sábado.
 * @param {Object} dados {email, setor, setoresExtras: string[]}
 */
function definirSetoresPessoa(dados) {
  var u = exigirGestor_();
  dados = dados || {};
  var email = normalizarEmail_(dados.email);
  if (!email) throw new Error('Pessoa não informada.');

  var ativos = listarSetoresAtivos_();
  var setor = String(dados.setor || '').trim();
  if (!setor) throw new Error('Escolha o setor principal.');
  if (ativos.indexOf(setor) < 0) throw new Error('Setor desconhecido: ' + setor + '.');

  var vistos = {};
  vistos[setor] = true; // o principal não se repete nos extras
  var extras = (dados.setoresExtras || []).map(function (s) { return String(s || '').trim(); })
    .filter(function (s) {
      if (!s || vistos[s]) return false;
      if (ativos.indexOf(s) < 0) throw new Error('Setor desconhecido: ' + s + '.');
      vistos[s] = true;
      return true;
    });

  var linhaPessoa = lerAba_(ABA_PESSOAS).filter(function (l) {
    return normalizarEmail_(l['E-mail corporativo']) === email;
  })[0];
  if (!linhaPessoa) throw new Error('Pessoa não encontrada no cadastro.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    atualizarLinha_(ABA_PESSOAS, linhaPessoa._linha, { 'Setor principal': setor });
    gravarSetoresExtras_(email, extras);
  } finally {
    lock.releaseLock();
  }
  limparCacheCadastro();
  registrarNotificacao_('CADASTRO', 'definirSetoresPessoa', '', '',
    email + ': ' + setor + (extras.length ? ' + ' + extras.join(', ') : ''), 'salvo por ' + u.email);
  return { ok: true, setor: setor, setoresExtras: extras };
}

/**
 * Regrava as linhas da pessoa na aba "Setores extras".
 * Escreve só as colunas de dados e reaproveita as linhas livres já formatadas,
 * para não atropelar a coluna de fórmula (Nome automático).
 */
function gravarSetoresExtras_(email, extras) {
  var aba = aba_(ABA_SETORES_EXTRAS);
  var cabecalho = cabecalhoDaAba_(aba);
  var colEmail = cabecalho.indexOf('E-mail corporativo') + 1;
  var colSetor = cabecalho.indexOf('Setor extra') + 1;
  if (!colEmail || !colSetor) throw new Error('A aba "' + ABA_SETORES_EXTRAS + '" está sem as colunas esperadas.');

  var ultima = aba.getLastRow();
  var emails = ultima >= 2 ? aba.getRange(2, colEmail, ultima - 1, 1).getValues() : [];

  var livres = [];   // linhas em branco que já existem (mantêm a fórmula do nome)
  var daPessoa = []; // linhas que já são dela
  emails.forEach(function (v, i) {
    var atual = normalizarEmail_(v[0]);
    if (atual === email) daPessoa.push(i + 2);
    else if (!atual) livres.push(i + 2);
  });

  // reaproveita as linhas dela, depois as livres, e só então cresce a aba
  var destino = daPessoa.concat(livres);
  extras.forEach(function (setor, i) {
    var linha = destino[i] || (aba.getLastRow() + 1);
    aba.getRange(linha, colEmail).setValue(email);
    aba.getRange(linha, colSetor).setValue(setor);
  });
  // limpa o que sobrou das linhas antigas dela
  daPessoa.slice(extras.length).forEach(function (linha) {
    aba.getRange(linha, colEmail).clearContent();
    aba.getRange(linha, colSetor).clearContent();
  });
  esquecerAba_(ABA_SETORES_EXTRAS);
}
