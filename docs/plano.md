# Plano

Status: ⬜ não iniciado · 🟨 em andamento · ✅ concluído

## Preparação ✅ (21/09/2026)
- [x] Node.js 24 e clasp 3.4.1 instalados (clasp em `%APPDATA%\npm`, git em `%LOCALAPPDATA%\Programs\Git`)
- [x] API do Apps Script ativada em script.google.com/home/usersettings
- [x] `clasp login` (feito pelo usuário)
- [x] Planilha de cadastro importada no Google Planilhas (pasta `Projeto_Agenda_Suporte` no Drive, planilha nativa)
- [x] Projeto Apps Script "Escala Suporte" vinculado à planilha e ligado a `src/` com clasp
- [x] Repositório git iniciado

## Fase 1 – Fundação ⬜
- Abas Config, Lancamentos, Bloqueios e demais de `docs/modelo-dados.md`
- Web app com login e identificação do usuário pelo e-mail (perfil vindo de `Pessoas`)
- Função central de envio de e-mail/evento respeitando o modo teste
- Estrutura das telas e menu lateral
- Painel "quem está onde"
- Importação dos dados atuais da planilha antiga (ver `referencia/LEIA-ME.md`)

## Fase 2 – Sábados e Home office ⬜
- Sábados com turnos, contagem, cobertura por setor e avisos
- Home office com reserva (LockService), fila por setor, pular, vez guardada, semanas presenciais

## Fase 3 – Meio-dia e plantão ⬜
- Grade semanal com vagas, copiar semana anterior, feriados, relatório de plantões

## Fase 4 – Trocas ⬜
- Proposta, aceite por e-mail/app, atualização e aviso ao gestor

## Fase 5 – Férias ⬜
- Saldo, fluxo de aprovação, linha do tempo, avisos, coletivas

## Fase 6 – Google Agenda ⬜
- Calendário compartilhado "Escala Suporte" (convidando a pessoa)
- Depois: "local de trabalho: casa" e "fora do escritório" na agenda pessoal

## Produção ⬜
1. Apagar lançamentos de teste (manter cadastro)
2. Criar calendário "Escala Suporte" e colocar o ID na Config
3. Modo teste = Não
4. Nova implantação: Aplicativo da Web, executar como o criador, acesso a qualquer pessoa em agro1.inf.br (link /exec)
5. Proteger abas; dar acesso de editor ao gestor
