# Modelo de dados (planilha-banco)

Implementado em `src/Constantes.gs` (cabeçalhos) e `src/Setup.gs` (cria as abas). Se mudar aqui, mude lá.

## Abas de cadastro (já existem em `referencia/Cadastro_Pessoas_Setores.xlsx`)
- **Pessoas:** E-mail corporativo | Nome completo | Nome de exibição | Setor principal | Perfil (Colaborador/Gestor) | Ativo (Sim/Não) | Data de entrada na equipe | Qtd. setores extras (fórmula)
- **Setores:** Setor | Ativo | contagens (fórmulas)
- **Setores extras:** E-mail corporativo | Nome (fórmula) | Setor extra | Observação

## Abas novas
- **Config:** Chave | Valor | Descrição. Chaves: `MODO_TESTE` (Sim/Não), `EMAIL_TESTE`, `ID_CALENDARIO_TESTE`, `ID_CALENDARIO_PRODUCAO`, `DOMINIO`, `SABADO_MIN` (6), `SABADO_MAX` (8), `VAGAS_MEIO_DIA` (2), `VAGAS_PLANTAO` (1), `VAGAS_PLANTAO_SABADO` (1), `VAGAS_HOME_OFFICE` (1), `HO_FORA_DA_FILA` (e-mails fora da fila de home office), `ANTECEDENCIA_FERIAS_DIAS` (35), `FERIAS_AVISO_PRAZO_DIAS` (60), `FERIAS_SOBREPOSICAO_MIN_DIAS` (6), `FERIAS_REGRAS_CLT` (Não), `TREINAMENTO_EQUIPE_MIN` (5, só importação). Lidas por `obterConfig()` com cache de 5 min.
- **Lancamentos:** ID | Tipo (SABADO, MEIO_DIA, PLANTAO, HOME_OFFICE, FERIAS) | E-mail | Data início | Data fim | Turno (`8h-11h` / `9h-12h` na escala de sábado; `18h-20h` / `13h-17h` no plantão; com "h" porque o Planilhas converteria "8-11" em data) | Status (ativo, cancelado; férias: rascunho, solicitada, aprovada, encaminhada, devolvida) | Criado por | Criado em | Atualizado em | ID evento agenda | Observação | Em treinamento (Sim/Não; só sábado: a pessoa vai, mas está em treinamento e não atende — não conta para mínimo/máximo nem cobre setor)
- **Bloqueios:** ID | Tipo (FERIADO, FERIADO_FACULTATIVO, TREINAMENTO, SEMANA_PRESENCIAL, FERIAS_COLETIVAS) | Data início | Data fim | Descrição — os dois tipos de feriado dispensam escala (`ehTipoFeriado_`); o gestor cria e remove os de um dia só pelas telas, os de vários dias continuam sendo editados aqui.
- **FilaHO:** E-mail | Setor | Tipo (PULOU) | Semana | Registrado em — só os "pular minha vez"; os usos vêm dos próprios lançamentos de HOME_OFFICE.
- **SaldoFerias:** E-mail | Saldo inicial | Prazo limite para gozo | Período aquisitivo
- **Trocas:** ID | Proponente | Lançamento do proponente | Destinatário | Lançamento do destinatário | Status (pendente, aceita, recusada, cancelada, expirada) | Criada em | Respondida em
- **AvisosIgnorados:** Quando | E-mail | Lançamento | Código do aviso | Texto do aviso
- **Preferencias:** E-mail | Receber e-mails (Sim/Não) | Convites na agenda (Sim/Não) | Atualizado em | Avisos sábados | Avisos meio-dia | Avisos plantão | Avisos home office | Avisos férias — editada pela própria pessoa no app ("Configurações"); quem não tem linha (ou célula vazia) usa o padrão: e-mails Não, agenda Não, avisos Sim exceto plantão.
- **MapaNomes:** Nome na planilha antiga | E-mail | Observação — só para a importação.
- **LogNotificacoes:** Quando | Tipo (EMAIL, EVENTO) | Origem | Destinatários originais | Destinatário real | Assunto/título | Resultado — registro de tudo que saiu do sistema (permite conferir que o modo teste desviou os envios).
