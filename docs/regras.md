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
- A tela mostra o **mês atual + 11 meses** à frente. Cartões "Meses anteriores" (topo) e "Próximos meses" (fim) carregam mais 12 meses por clique, para ajustes em anos passados/futuros.
- Ao se escalar, a pessoa pode marcar **"em treinamento"**: ela vai no sábado, mas não atende. Aparece no cartão (etiqueta azul) e **não conta** para o mínimo/máximo nem cobre setor. Na importação, células com texto contendo "treinamento" viram esse tipo de escala; o sábado só é bloqueado (treinamento da equipe) quando pelo menos `TREINAMENTO_EQUIPE_MIN` pessoas (Config, padrão 5) estão em treinamento nele.
- A pessoa marca várias mudanças (entrar em X, sair de Y) e **salva tudo de uma vez**; o gestor faz o mesmo para qualquer pessoa.
- **Só o gestor** marca um sábado como treinamento da equipe, pelo próprio cartão (botão "Marcar treinamento"). O sábado fica cinza, deixa de cobrar mínimo/máximo e cobertura, e quem se escalar nele recebe aviso. Treinamentos de vários dias (vindos da importação) só são ajustados na aba `Bloqueios`.
- **Sair de um sábado não pede confirmação de aviso** (decisão do usuário, 21/09/2026): o aviso (abaixo do mínimo, setor descoberto) é registrado em `AvisosIgnorados` mesmo assim. Entrar num sábado segue o fluxo normal de "Salvar mesmo assim".

## Meio-dia
- Quem fica no meio-dia trabalha até **12:30** e sai **17:30**. Segunda a sexta, exceto feriados.
- Voluntário. **Exatamente 2 pessoas por dia** (`VAGAS_MEIO_DIA`); diferente disso gera aviso — **só na semana atual**, porque a organização é feita na segunda de cada semana (semanas futuras não viram pendência).
- Intervalos de almoço de referência: 11:00–12:30 e 12:30–14:00.
- Organizado na daily de segunda: a tela tem "Copiar semana anterior" (marca as mesmas pessoas da semana passada como pendentes; gestor copia todo mundo, colaborador só a si mesmo).
- Tela própria ("Meio-dia"): um cartão por semana, semana atual + 8; "Semanas anteriores"/"Próximas semanas" carregam mais. Seleção em lote e painel "Mudanças", como nos sábados.

## Plantão
- **Segunda a sexta: 18h às 20h.** **Sábado: 13h às 17h.** Nunca em feriado cadastrado.
- **Feriados (só o gestor):** no dia da grade de Meio-dia ou Plantão, marca **Feriado** ou **Feriado facultativo** (usado quando a empresa trabalha no ponto facultativo). Os dois deixam o dia sem cobrança de vagas; muda só a etiqueta. "Não é feriado" remove. Sábado com TREINAMENTO da equipe gera aviso.
- Voluntário. **1 pessoa por dia** (`VAGAS_PLANTAO` em dia útil, `VAGAS_PLANTAO_SABADO` no sábado); diferente disso gera aviso.
- O lançamento guarda o turno (`18h-20h` ou `13h-17h`).
- Relatório: quantidade de plantões por pessoa no mês (cartão lateral) e os seus.
- Tela própria ("Plantão"), mesma estrutura da tela Meio-dia, com a linha do sábado.

## Home office
- A pessoa reserva **uma semana inteira** (segunda a sexta).
- **1 pessoa da equipe inteira por semana.** Vale quem reservou primeiro (data e hora da gravação, com `LockService`). Uma segunda reserva na mesma semana gera aviso mostrando quem reservou e quando.
- **Fila única da equipe, sem ordem fixa** (todos os colaboradores ativos; o gestor e os e-mails em `Config > HO_FORA_DA_FILA` — quem já trabalha em home office — não entram) — mudança de 21/09/2026, antes era por setor com ordem. Cada pessoa está em **Reservado**, **Já usou nesta rodada** ou **Ainda não usou**. Rodada = número de usos (semanas usadas/reservadas + "pular"); quem tem o maior número já usou nesta rodada. Reservar de novo enquanto outros ainda não usaram gera aviso ("Ainda faltam usar: …").
  - **Pular:** a pessoa pode marcar "pular minha vez": conta como uso nesta rodada, sem reservar semana.
  - **Férias:** quem está de férias quando chega sua vez fica com a vez guardada até voltar.
  - **Novatos:** aparecem em "Ainda não usou".
  - **Ponto de partida:** os home offices importados da planilha antiga (2026) contam como "já usou a vez".
- Sem limite de semanas por ano.
- Semanas marcadas pelo gestor como presenciais (aba `Bloqueios`, tipo `SEMANA_PRESENCIAL`) geram aviso ao reservar.
- Home office **pode** coincidir com plantão ou sábado (sem aviso).
- Tela própria ("Home office"): cartão por semana (semana atual + 12; "Semanas anteriores"/"Próximas semanas"), faixa "Esta semana: X está em home office", seleção em lote com painel "Mudanças" (como nos sábados), cartão lateral "Seus home offices" (semanas da pessoa, de 6 meses atrás até o futuro, por mês). A fila não é exibida (decisão de 21/09/2026); o aviso "já usou nesta rodada" continua ao reservar. Gestor reserva para qualquer pessoa.

## Férias
- Cada pessoa tem saldo, prazo limite para gozo e até dois ou três períodos.
- Fluxo: **Rascunho → Solicitada → Aprovada (gestor) → Encaminhada ao RH**.
- Avisos:
  - sobreposição com **qualquer pessoa da equipe** (a regra vale para a equipe inteira, não por setor), **só quando coincidem por 6 dias ou mais** (`FERIAS_SOBREPOSICAO_MIN_DIAS`);
  - menos de **35 dias** de antecedência entre a solicitação e o início;
  - saldo insuficiente;
  - prazo limite para gozo se aproximando;
  - regras de fracionamento da CLT (até 3 períodos, um com pelo menos 14 dias e os demais com pelo menos 5; não começar nos 2 dias antes de feriado ou folga). Implementadas, mas **desligadas** (`Config > FERIAS_REGRAS_CLT = Não`) até o RH confirmar.
- Férias coletivas são cadastradas pelo gestor (aba `Bloqueios`, tipo `FERIAS_COLETIVAS`) e aparecem para todos na linha do tempo; solicitar férias por cima gera aviso.
- Implementação (21/09/2026): saldo = `Saldo inicial` − dias corridos dos períodos solicitados/aprovados/encaminhados (rascunho não conta). O gestor pode **devolver** (status `devolvida`, motivo na observação) e a pessoa reenvia; pode lançar/editar para qualquer pessoa. Rascunho não pede confirmação de aviso; solicitar e aprovar pedem. Ao aprovar, evento de dia inteiro na agenda. E-mails: solicitar → gestores; aprovar/devolver/encaminhar/cancelar → pessoa. Painel: solicitações aguardando (gestor), sobreposições até o fim do mês seguinte e "seu prazo está chegando" (grupo Férias).

## Trocas entre colegas
- A pessoa A propõe trocar um lançamento seu (sábado, meio-dia ou plantão) com um de B.
- B recebe e-mail e aceita ou recusa no app.
- Ao aceitar: escala e agenda são atualizadas e o gestor é notificado.
- Se a troca criar uma situação com aviso, os dois veem o aviso antes de confirmar.
- Implementação (21/09/2026): só entre lançamentos do **mesmo tipo**; cada um assume a data **e o turno** do outro. Ao aceitar, os dois lançamentos originais são cancelados e dois novos criados (observação "troca com …"); eventos da agenda refeitos; gestores avisados por e-mail. Quem propôs pode cancelar enquanto pendente; se um lançamento mudar antes da resposta, a troca expira. Botão ⇄ na etiqueta "Você" das telas Sábados, Meio-dia e Plantão; respostas no cartão "Trocas" do Painel.

## Notificações (e-mail e Google Agenda)
- Cada pessoa controla, no próprio app (botão "Configurações"), se quer **receber e-mails** e se quer **eventos na agenda** (dois sinalizadores, **padrão Não** desde 21/09/2026).
- Quem não ligou não recebe e não entra no evento; o sistema continua funcionando igual (o lançamento existe, só não notifica).
- Os eventos entram na agenda da pessoa como **compromisso confirmado** (participante com presença aceita), **sem e-mail de convite** — serviço avançado do Calendar; se ele falhar, CalendarApp sem convite.
- **Avisos do Painel por módulo:** cada pessoa liga/desliga os avisos de Sábados, Meio-dia, Plantão, Home office e Férias (padrão: todos ligados, **menos Plantão**, porque plantões são ocasionais). O gestor tem um botão para ativar/desativar o aviso de plantão para toda a equipe de uma vez; depois cada um pode mudar o seu.
- Eventos de sábado, meio-dia, plantão e home office: um evento por pessoa, convidando-a, no calendário "Escala Suporte".
- Sábado: horário do turno (8–11 ou 9–12). Meio-dia: 12:30–14:00 como referência do intervalo deslocado. Plantão: 18:00–20:00 (dia útil) ou 13:00–17:00 (sábado). Home office: dia inteiro, segunda a sexta.

## Como os avisos aparecem
1. Na hora de salvar: janela com o aviso e os botões "Cancelar" e "Salvar mesmo assim".
2. No calendário: dia/semana marcado até a situação se resolver.
3. No painel de pendências do gestor e num e-mail semanal de resumo.
4. Todo aviso ignorado fica registrado (quem, quando, qual aviso).
