# Regras de negócio

Todas as regras abaixo geram **aviso**, nunca bloqueio. Os números ficam na aba `Config`.

## Setores
GERAL, CONTABILIDADE, EMISSÃO, SEMENTES, ATUALIZAÇÃO, AQILA, CADASTROS (hoje sem pessoas; o gestor pode desativar).
- Cada colaborador tem **um setor principal** e zero ou mais **setores extras**.
- O gestor muda setores direto na planilha (abas `Pessoas` e `Setores extras`).
- Setor com `Ativo = Não` é ignorado em todas as regras.

## Perfis
- **Colaborador:** lança e edita os próprios registros; propõe e aceita trocas.
- **Gestor:** vê e edita tudo, aprova férias, vê o painel de pendências e recebe o resumo semanal.

## Sábado
- Dois turnos: **8h às 11h** e **9h às 12h**.
- Aviso se o sábado tiver **menos de 6 ou mais de 8 pessoas** (somando os dois turnos).
- Aviso se algum **setor ativo** ficar sem ninguém. A pessoa cobre o setor principal **e** os extras.
- Aviso se a pessoa escalada estiver de férias no dia.
- Sábados com bloqueio (ex.: treinamento da equipe) geram aviso para quem tentar se escalar.
- Relatório: quantidade de sábados por pessoa no ano.

## Meio-dia
- Quem fica no meio-dia trabalha até **12:30** e sai **17:30**. Segunda a sexta.
- Voluntário. **Exatamente 2 pessoas por dia**; diferente disso gera aviso.
- Intervalos de almoço de referência: 11:00–12:30 e 12:30–14:00.
- Organizado na daily de segunda: a tela precisa de "copiar semana anterior".

## Plantão
- Fica até as **20h**. Segunda a sexta, exceto feriados cadastrados.
- Voluntário. **Exatamente 1 pessoa por dia**; diferente disso gera aviso.
- Relatório: quantidade de plantões por pessoa no mês.

## Home office
- A pessoa reserva **uma semana inteira** (segunda a sexta).
- **1 pessoa da equipe inteira por semana.** Vale quem reservou primeiro (data e hora da gravação, com `LockService`). Uma segunda reserva na mesma semana gera aviso mostrando quem reservou e quando.
- **Fila por setor principal:** depois de usar sua semana, a pessoa só volta a ter vez quando todos do setor tiverem tido a deles. Reservar antes disso gera aviso.
  - **Pular:** a pessoa pode marcar "pular minha vez" e vai para o fim da fila.
  - **Férias:** quem está de férias quando chega sua vez fica com a vez guardada até voltar.
  - **Novatos:** entram no fim da fila do setor (pela `Data de entrada na equipe`).
  - **Ponto de partida:** os home offices importados da planilha antiga (2026) contam como "já usou a vez".
- Sem limite de semanas por ano.
- Semanas marcadas pelo gestor como presenciais geram aviso ao reservar.
- Home office **pode** coincidir com plantão ou sábado (sem aviso).

## Férias
- Cada pessoa tem saldo, prazo limite para gozo e até dois ou três períodos.
- Fluxo: **Rascunho → Solicitada → Aprovada (gestor) → Encaminhada ao RH**.
- Avisos:
  - sobreposição com **qualquer pessoa da equipe** (a regra vale para a equipe inteira, não por setor);
  - menos de **35 dias** de antecedência entre a solicitação e o início;
  - saldo insuficiente;
  - prazo limite para gozo se aproximando;
  - regras de fracionamento da CLT (até 3 períodos, um com pelo menos 14 dias e os demais com pelo menos 5; não começar nos 2 dias antes de feriado ou folga). **Confirmar com o RH antes de implementar.**
- Férias coletivas são cadastradas pelo gestor e aparecem para todos.

## Trocas entre colegas
- A pessoa A propõe trocar um lançamento seu (sábado, meio-dia ou plantão) com um de B.
- B recebe e-mail e aceita ou recusa no app.
- Ao aceitar: escala e agenda são atualizadas e o gestor é notificado.
- Se a troca criar uma situação com aviso, os dois veem o aviso antes de confirmar.

## Notificações (e-mail e Google Agenda)
- Cada pessoa controla, no próprio app, se quer **receber e-mails** e se quer **convites na agenda** (dois sinalizadores, padrão Sim).
- Quem desligou não recebe e não é convidado; o sistema continua funcionando igual (o lançamento existe, só não notifica).
- Eventos de sábado, meio-dia, plantão e home office: um evento por pessoa, convidando-a, no calendário "Escala Suporte".
- Sábado: horário do turno (8–11 ou 9–12). Meio-dia: 12:30–14:00 como referência do intervalo deslocado. Plantão: 17:30–20:00. Home office: dia inteiro, segunda a sexta.

## Como os avisos aparecem
1. Na hora de salvar: janela com o aviso e os botões "Cancelar" e "Salvar mesmo assim".
2. No calendário: dia/semana marcado até a situação se resolver.
3. No painel de pendências do gestor e num e-mail semanal de resumo.
4. Todo aviso ignorado fica registrado (quem, quando, qual aviso).
