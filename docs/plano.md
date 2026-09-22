# Plano

Status: ⬜ não iniciado · 🟨 em andamento · ✅ concluído

## Preparação ✅ (21/09/2026)
- [x] Node.js 24 e clasp 3.4.1 instalados (clasp em `%APPDATA%\npm`, git em `%LOCALAPPDATA%\Programs\Git`)
- [x] API do Apps Script ativada em script.google.com/home/usersettings
- [x] `clasp login` (feito pelo usuário)
- [x] Planilha de cadastro importada no Google Planilhas (pasta `Projeto_Agenda_Suporte` no Drive, planilha nativa)
- [x] Projeto Apps Script "Escala Suporte" vinculado à planilha e ligado a `src/` com clasp
- [x] Repositório git iniciado

## Fase 1 – Fundação ✅ (21/09/2026)
- [x] Abas Config, Lancamentos, Bloqueios e demais de `docs/modelo-dados.md` (`Setup.gs`, idempotente, menu na planilha)
- [x] Web app com login e identificação do usuário pelo e-mail (`Usuario.gs`, `Web.gs`, tela SemAcesso)
- [x] Função central de envio de e-mail/evento respeitando o modo teste (`Notificacoes.gs` + aba LogNotificacoes)
- [x] Estrutura das telas e menu lateral (`Index.html`, `Estilos.html`, `Script.html`)
- [x] Painel "quem está onde" com Hoje/Semana/Mês e avisos de cobertura (`Painel.gs`, `TelaPainel.html`)
- [x] Importação da planilha antiga a partir de 01/01/2026 (`Importacao.gs`, abas MapaNomes e RelatorioImportacao)
- Implantação de teste: `/dev` (ID AKfycbwpbaraP0mGgUvwlkX-QVvGVny53IWoGJ9wiQGobQ)

## Fase 2 – Sábados e Home office ✅ (21/09/2026)
- [x] Sábados com turnos, contagem, cobertura por setor e avisos (`Sabados.gs`, `TelaSabados.html`)
- [x] Home office com reserva (LockService), fila por setor, pular, vez guardada, semanas presenciais (`HomeOffice.gs`, `TelaHomeOffice.html`)

## Fase 3 – Meio-dia e plantão ✅ (21/09/2026)
- [x] Duas abas (Meio-dia e Plantão) com cartões por semana, seleção em lote, copiar semana anterior, feriados, relatório do mês (`Semanal.gs`, `TelaSemanal.html`)
- [x] Plantão de sábado 13h–17h (`VAGAS_PLANTAO_SABADO`); painel mostra plantão no sábado
- [x] Testado no /dev pelo usuário

## Fase 4 – Trocas ✅ (21/09/2026)
- [x] Propor (⇄ nas telas), aceitar/recusar/cancelar no Painel, avisos dos dois lados, agenda refeita, e-mails para colega e gestor (`Trocas.gs`)

## Fase 5 – Férias ✅ (22/09/2026)
- [x] Saldo, rascunho/solicitar/aprovar/devolver/encaminhar, linha do tempo da equipe com sobreposições e coletivas, avisos (CLT desligada até o RH confirmar), e-mails, evento na agenda ao aprovar (`Ferias.gs`, `TelaFerias.html`)
- [x] Testado no /dev pelo usuário (22/09/2026)

## Fase 7 – Gestor ✅ (22/09/2026)
Decisões: sem tela nova (ações nas telas e em Configurações); feriado facultativo não cobra escala, muda só a etiqueta; sem "ver como colaborador".
- [x] Sábado de treinamento da equipe pelo cartão (`Bloqueios.gs`, `TelaSabados.html`)
- [x] Feriados obrigatório/facultativo na grade de Meio-dia e Plantão (`Bloqueios.gs`, `TelaSemanal.html`)
- [x] Regras (mín/máx do sábado, vagas e limites de férias) na janela Configurações › Regras da escala (`Config.gs`, `Script.html`)
- [x] Pessoas: adicionar e inativar/reativar na janela Configurações › Pessoas (`Pessoas.gs`, `Script.html`)
- Já existia: escalar/tirar qualquer pessoa nas quatro telas e todo o fluxo de status das férias

## Fase 6 – Google Agenda ✅ (22/09/2026)
- [x] Eventos criados pelo serviço avançado do Calendar, com a pessoa como participante já aceito (feito nas Fases 2–5)
- [x] **Sem calendário separado** (decisão do usuário, 22/09/2026): o evento sai da agenda da conta que roda o sistema e entra na agenda de cada pessoa, que é adicionada como participante. `ID_CALENDARIO_PRODUCAO` fica vazio; preencher só se um dia quiserem um calendário próprio.
- ⛔ "Local de trabalho: casa" e "fora do escritório" **na agenda pessoal**: o Google só permite esses tipos de evento no calendário primário da própria pessoa, o que exigiria delegação de domínio (admin do Workspace). O home office continua como evento comum de dia inteiro.

## Produção ⬜
1. Apagar lançamentos de teste (manter cadastro): `apagarDadosDeExemplo()`
2. Modo teste = Não (a partir daí e-mails e eventos vão para a equipe de verdade)
3. Nova implantação: Aplicativo da Web, executar como o criador, acesso a qualquer pessoa em agro1.inf.br (link /exec)
4. Proteger abas; dar acesso de editor ao gestor
