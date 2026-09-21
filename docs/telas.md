# Telas (design de referência)

Fonte da verdade visual: `Design.pdf` (5 páginas, na área de trabalho do usuário; não está no repositório porque usa nomes de exemplo). Este arquivo descreve o que está lá.

## Sistema visual
- Fundo `#F5F3EC`; cartões brancos com borda `#E5E1D6`, raio 12px, sombra leve.
- Menu lateral fixo `#1F2B23`, 348px no design (≈ 232px no app). Topo: ícone de calendário verde + "Escala Suporte" / "Agro1". Item ativo: pílula `#2F6B3A` com texto branco. Contador de avisos: pílula amarela `#E9B44C` com texto escuro. Rodapé: avatar redondo com iniciais (fundo verde-claro, texto verde-escuro), nome em negrito, "Setor · Perfil".
- Cabeçalho de tela: linha pequena em caixa alta e espaçada (ex.: data de hoje), título grande em Bricolage Grotesque, subtítulo cinza. Ações à direita (alternador ou botões de navegação "‹ Setembro" / "Novembro ›" em caixas brancas com borda).
- Etiquetas: verde-claro `#E4EFE6` + texto `#2F6B3A` (pessoa/setor coberto); cinza-claro `#F0EEE6` (pessoa em grade); âmbar tracejada (setor sem ninguém); pílula de contagem verde ("7 pessoas") ou âmbar ("5 de 6 mín.").
- Avisos: caixa âmbar `#FBEFD9` borda `#F0D9B0`, ícone ⚠, **título em negrito** + linha de explicação. Texto fixo: "Avisos não impedem lançamentos."
- Botões: primário escuro `#1F2B23` (Salvar mesmo assim, Ver sábado, Copiar semana anterior); verde `#2F6B3A` (Reservar esta semana, Aceitar troca, Escolher semana); contorno verde (Me escalar); contorno neutro (Cancelar, Recusar, Pular minha vez). Altura ≥ 44px.
- Fontes: Bricolage Grotesque (títulos), IBM Plex Sans (texto).

## 1. Painel – Quem está onde
- Linha superior: data por extenso em caixa alta; título "Quem está onde"; alternador Hoje / Semana / Mês à direita.
- 4 cartões: Férias ("até 06/10"), Home office ("semana toda"), Meio-dia ("até 12:30"), Plantão ("até 20h"), com nomes em etiquetas verdes.
- Cartão "Semana de 21 a 26 de setembro": tabela Dia | Meio-dia | Plantão | Home office | Férias. Nomes em texto simples; problema em célula âmbar ("Guilherme · 1 vaga", "Sem ninguém", "5 pessoas (mín. 6)" na linha do sábado, com "—" nas colunas que não se aplicam).
- Coluna direita "Avisos abertos" com contador, lista de caixas âmbar (título + explicação), texto "Avisos não impedem lançamentos." e botão escuro "Ver sábado 26/09" (leva para o primeiro aviso).
- Hoje = cartões + tabela da semana; Semana/Mês = tabela do período.

## 2. Sábados
- Título "Sábados de outubro"; subtítulo "De 6 a 8 pessoas por sábado, somando os dois turnos, com pelo menos 1 pessoa de cada setor."; navegação por mês.
- Um cartão por sábado: dia grande à esquerda ("03" / "OUT"); linhas "8h–11h" e "9h–12h" com etiquetas cinza dos nomes ("Ninguém ainda" em itálico); linha de setores (verde = coberto, âmbar tracejada = sem ninguém); à direita pílula de contagem ("7 pessoas" verde / "5 de 6 mín." âmbar) e botão "Me escalar". Cartão com problema tem borda âmbar.
- Sábado bloqueado: cartão cinza "Treinamento com toda a equipe – Escalas neste dia geram aviso."
- Coluna direita: painel "Confirmar escala" (data · turno, aviso âmbar, Cancelar / Salvar mesmo assim); "Seus sábados em 2026" (número grande, "Último em 05/09 · nenhum agendado"); "Legenda dos setores".

## 3. Meio-dia e plantão
- Título; subtítulo "Semana de 21 a 25 de setembro · organizada na daily de segunda"; botões "‹ Anterior", "Próxima ›" e escuro "Copiar semana anterior".
- Grade: colunas Seg 21/09 … Sex 25/09; linhas "Meio-dia (Fica até 12:30, sai 17:30 · 2 vagas por dia)" e "Plantão (Fica até as 20h · 1 vaga por dia)". Ocupado = etiqueta cinza com nome; "Você" em verde com link "Propor troca"; vaga livre = botão tracejado "+ Ocupar vaga"; dia com vaga aberta = célula com fundo âmbar e "⚠ 1 vaga aberta".
- Cartões abaixo: "Proposta de troca" (texto, Recusar / Aceitar troca, nota "Ao aceitar, escala e agenda são atualizadas e o gestor é avisado."), "Intervalos de almoço" (1º turno 11:00 às 12:30, 2º turno 12:30 às 14:00), "Plantões em setembro" (barras por pessoa com total).

## 4. Home office
- Título; subtítulo "Uma pessoa da equipe por semana. Quem reserva primeiro fica com a semana."; navegação por mês.
- Faixa escura: "🏠 Esta semana (21 a 25/09): **Ricardo** está em home office."
- Lista de semanas do mês ("28/09 a 02/10 · semana 1"): reservada (etiqueta verde com nome, "Geral · reservada em 03/09 às 14:22"), livre ("Semana livre" + botão verde "Reservar esta semana"), presencial (cartão cinza "Semana presencial – Definida pelo gestor. Reservar gera aviso.").
- Coluna direita "Fila de Sementes · rodada atual": posições numeradas; "Usou de 03 a 07/08"; "De férias: vez guardada até voltar"; "(você) Sua vez: escolha uma semana ou pule" destacada em verde; "Entrou em 15/09: fim da fila". Botões "Escolher semana" (verde) e "Pular minha vez" (contorno).
- Painel "Reservar 12 a 16/10?" com aviso "Esta semana já é do Guilherme, reservada em 10/09 às 09:05." e Cancelar / Salvar mesmo assim.

## 5. Férias
- Título; subtítulo "Sem sobreposição na equipe e com 35 dias de antecedência. Tudo gera só aviso."
- Cartões "Seu saldo" (número grande "0 de 30 dias", "Prazo limite para gozo: 26/01/2027") e "Seus períodos" (lista com etiqueta de status: "Encaminhada ao RH" verde, "Aprovada" azul-claro).
- Cartão "Equipe · outubro e novembro": linha do tempo por pessoa, barras âmbar (sobreposição) ou azul-escuro (a sua), rótulos "13–28/10". Abaixo, lista de sobreposições em caixas âmbar ("Carlos, Julia, João Vitor e Camila: 4 ao mesmo tempo de 15 a 19/10").
- Painel direito "Solicitar férias": etapas 1 Rascunho · 2 Solicitada · 3 Aprovada · 4 Encaminhada ao RH; campos Início/Fim; "Total: 11 dias"; avisos (Pouca antecedência, Sobreposição na equipe, Saldo insuficiente); botões "Enviar mesmo assim" (escuro) e "Salvar rascunho" (contorno).
