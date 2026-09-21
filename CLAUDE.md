# Escala Suporte – Agro1

Sistema web para organizar a escala da equipe de suporte do ERP Agro1: sábados, meio-dia, plantão, home office e férias. Substitui abas de uma planilha Google usada hoje pelo gestor.

Responda sempre em **português do Brasil**.

## Stack (decidida, não trocar sem perguntar)
- **Google Apps Script** (web app com HtmlService), vinculado a uma **planilha Google** que funciona como banco de dados.
- Código local sincronizado com o Google via **clasp** (`src/` → `clasp push`).
- **100% gratuito**: nada fora do Google Workspace da empresa. Sem Supabase, Vercel, Firebase ou APIs pagas.
- Login automático pela conta Google do domínio `agro1.inf.br`.
- Integração com Google Agenda pelo serviço nativo do Apps Script.

Os porquês estão em `docs/decisoes.md`. Leia antes de propor mudanças de arquitetura.

## Regras que valem para todo o código
1. **Nenhuma regra de negócio bloqueia um lançamento.** Toda violação gera **aviso**: o usuário vê o aviso e pode "Salvar mesmo assim". O sistema registra quem salvou ignorando o aviso. A única "trava" permitida é o consentimento em trocas (o colega precisa aceitar).
2. **O e-mail corporativo é o identificador da pessoa.** Nunca use o nome como chave.
3. **Modo teste:** quando `Config > Modo teste = Sim`, TODO e-mail e convite de agenda vai só para `Config > E-mail de teste`, e eventos vão para o calendário de teste. Nenhum colega pode ser notificado durante testes. Todo código que envia e-mail ou cria evento passa por uma função central que respeita isso.
4. **Nada fixo no código:** IDs de planilha/calendário, e-mails e limites das regras (6–8 no sábado, 2 no meio-dia etc.) ficam na aba `Config`.
5. O sistema roda na conta do criador do projeto ("Executar como: eu").
6. Use `LockService` em qualquer gravação onde a ordem importa (reserva de home office: vale quem pediu primeiro).

## Onde está cada coisa
- `docs/regras.md` – regras de negócio de cada módulo (fonte da verdade).
- `docs/decisoes.md` – decisões tomadas e seus motivos.
- `docs/modelo-dados.md` – abas da planilha-banco e colunas.
- `docs/telas.md` – descrição das telas do esboço visual.
- `docs/plano.md` – fases do projeto e status. **Atualize ao concluir etapas.**
- `referencia/` – planilha antiga e planilha de cadastro (contêm dados pessoais: nunca commitar).
- `src/` – código Apps Script (`.gs`, `.html`, `appsscript.json`).

## Como trabalhar
- Antes de implementar uma fase, **proponha um plano e espere aprovação**.
- Mudanças pequenas e testáveis; uma funcionalidade por vez.
- Nunca rode `clasp login` nem manipule credenciais: o usuário faz isso manualmente.
- Não faça `clasp deploy` de produção sem pedido explícito. Para testes, use a implantação de teste (`/dev`).
- Nunca commite `.clasprc.json`, `.clasp.json` nem arquivos de `referencia/`.
- Interface em português, com textos curtos e acessível (botões reais, contraste adequado, alvos de toque ≥ 44px).

## Comandos
- `clasp push` – envia `src/` para o Apps Script.
- `clasp open` – abre o projeto no editor web.
- `clasp deployments` – lista implantações.
