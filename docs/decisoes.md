# Decisões e motivos

## Apps Script + Google Planilhas (em vez de Supabase + Next.js + Vercel)
- Requisito: **100% gratuito**. O plano gratuito da Vercel não permite uso comercial, e o Supabase gratuito pausa projetos inativos.
- Apps Script já vem no Workspace da empresa: sem conta nova, sem hospedagem, login pelo Google.
- A primeira proposta usava Supabase para o banco impedir violações de regra. Como nada pode ser bloqueado (só avisar), esse motivo deixou de existir.
- Integração nativa com Google Agenda e Gmail, sem credenciais extras.
- Dados ficam dentro do Workspace (facilita LGPD e aprovação do TI).
- Limitações aceitas: interface um pouco mais lenta (1–2 s por ação) e cotas diárias (longe do limite para ~20 pessoas).

## Avisos em vez de bloqueios
Pedido explícito do usuário. Para que os avisos não sejam ignorados, eles aparecem em vários lugares e todo "salvar mesmo assim" fica registrado.

## E-mail como identificador
Na planilha antiga os nomes variam entre abas ("Pedro D" e "Pedro D.", três Felipes). O e-mail é único e é o que o login do Google entrega.

## Setor principal separado dos setores extras
- (A fila do home office era por setor principal; em 21/09/2026 passou a ser uma fila única da equipe, sem o gestor. O setor principal continua útil para a cobertura do sábado e para a exibição.)
- A cobertura do sábado se beneficia de pessoas que cobrem mais de um setor → setores extras.
- O gestor edita os dois direto na planilha.

## Uma linha por lançamento na planilha-banco
A planilha antiga usa grade pessoas × datas, com cores e fórmulas frágeis. O banco guarda uma linha por lançamento; a grade é gerada pelo app.

## Sistema na conta do criador
Decisão do usuário: o projeto fica vinculado à conta dele. Consequências aceitas: e-mails saem do endereço dele, ele aparece como organizador dos eventos, e o sistema para se a conta for desativada. Mitigação: gestor recebe acesso de editor na apresentação e o passo a passo de reimplantação fica documentado.

## Modo teste
O projeto está sendo feito em segredo, como surpresa para o gestor. O modo teste garante que nenhum colega receba e-mail ou convite durante o desenvolvimento.

## Notificação é opcional por pessoa
Pedido do usuário (21/09/2026): cada colaborador liga/desliga e-mails e eventos de agenda para si. Fica na aba `Preferencias` e é aplicado dentro de `Notificacoes.gs`, então nenhum módulo precisa se preocupar com isso. Padrão: **desligados** (decisão do usuário, mesma data). Eventos vão como compromisso já aceito, sem convite (Calendar API v3, `responseStatus: accepted`, `sendUpdates: none`), porque a escala é fato, não convite.

## Sem calendário "Escala Suporte"
Pedido do usuário (22/09/2026): em vez de um calendário próprio da equipe, o evento sai da agenda da conta que roda o sistema e cada pessoa entra como participante — assim ele aparece direto na agenda dela, sem ninguém precisar assinar um calendário novo. `Config > ID_CALENDARIO_PRODUCAO` fica vazio (se um dia quiserem um calendário separado, basta preencher). O usuário aceitou que, se o Google exigir convite, o evento chegue como convite.

## Fluidez: cache por tela, pré-carga e barra de atividade
Pedido do usuário (22/09/2026). Três mudanças no cliente:
- **Invalidação seletiva:** cada gravação diz quais leituras ficaram velhas (mapa `INVALIDA` em `Script.html`). Antes, qualquer gravação limpava tudo e todas as telas recarregavam. Gravação que não está no mapa continua limpando tudo (padrão seguro).
- **Pré-carga em segundo plano:** 1,5 s depois de a primeira tela aparecer, as demais são buscadas uma de cada vez (cada tela declara `precarregar`). Sequencial de propósito: o Apps Script enfileira chamadas do mesmo usuário, e disparar tudo junto atrasaria a tela que a pessoa está olhando. Trocar de aba passa a ser instantâneo.
- **Barra fina no topo** enquanto o servidor responde, com progresso real durante a pré-carga. Preferida a uma tela de espera bloqueante: mostra atividade sem impedir o uso.

## Agenda em sentido único
O sistema é a fonte da verdade e envia para o Google Agenda. Mudanças feitas direto na agenda não voltam para o sistema (evita conflitos). O ID de cada evento criado é guardado para atualizar ou apagar depois.

## Tirar-se de um sábado não pede confirmação de aviso
Pedido do usuário (21/09/2026): a segunda janela ("fica abaixo do mínimo, tirar mesmo assim?") atrapalhava. O servidor continua registrando o aviso em `AvisosIgnorados`, então a regra "todo aviso ignorado fica registrado" segue valendo; só a janela deixou de existir. Entrar num sábado continua pedindo confirmação.
