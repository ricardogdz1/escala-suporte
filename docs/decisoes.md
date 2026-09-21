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
- A fila do home office precisa de um único setor por pessoa → setor principal.
- A cobertura do sábado se beneficia de pessoas que cobrem mais de um setor → setores extras.
- O gestor edita os dois direto na planilha.

## Uma linha por lançamento na planilha-banco
A planilha antiga usa grade pessoas × datas, com cores e fórmulas frágeis. O banco guarda uma linha por lançamento; a grade é gerada pelo app.

## Sistema na conta do criador
Decisão do usuário: o projeto fica vinculado à conta dele. Consequências aceitas: e-mails saem do endereço dele, ele aparece como organizador dos eventos, e o sistema para se a conta for desativada. Mitigação: gestor recebe acesso de editor na apresentação e o passo a passo de reimplantação fica documentado.

## Modo teste
O projeto está sendo feito em segredo, como surpresa para o gestor. O modo teste garante que nenhum colega receba e-mail ou convite durante o desenvolvimento.

## Agenda em sentido único
O sistema é a fonte da verdade e envia para o Google Agenda. Mudanças feitas direto na agenda não voltam para o sistema (evita conflitos). O ID de cada evento criado é guardado para atualizar ou apagar depois.
