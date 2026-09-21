# Modelo de dados (planilha-banco)

Implementado em `src/Constantes.gs` (cabeçalhos) e `src/Setup.gs` (cria as abas). Se mudar aqui, mude lá.

## Abas de cadastro (já existem em `referencia/Cadastro_Pessoas_Setores.xlsx`)
- **Pessoas:** E-mail corporativo | Nome completo | Nome de exibição | Setor principal | Perfil (Colaborador/Gestor) | Ativo (Sim/Não) | Data de entrada na equipe | Qtd. setores extras (fórmula)
- **Setores:** Setor | Ativo | contagens (fórmulas)
- **Setores extras:** E-mail corporativo | Nome (fórmula) | Setor extra | Observação

## Abas novas
- **Config:** Chave | Valor | Descrição. Chaves: `MODO_TESTE` (Sim/Não), `EMAIL_TESTE`, `ID_CALENDARIO_TESTE`, `ID_CALENDARIO_PRODUCAO`, `DOMINIO`, `SABADO_MIN` (6), `SABADO_MAX` (8), `VAGAS_MEIO_DIA` (2), `VAGAS_PLANTAO` (1), `VAGAS_HOME_OFFICE` (1), `ANTECEDENCIA_FERIAS_DIAS` (35), `FERIAS_AVISO_PRAZO_DIAS` (60). Lidas por `obterConfig()` com cache de 5 min.
- **Lancamentos:** ID | Tipo (SABADO, MEIO_DIA, PLANTAO, HOME_OFFICE, FERIAS) | E-mail | Data início | Data fim | Turno (8-11 / 9-12, só sábado) | Status (ativo, cancelado; férias: rascunho, solicitada, aprovada, encaminhada) | Criado por | Criado em | Atualizado em | ID evento agenda | Observação
- **Bloqueios:** ID | Tipo (FERIADO, TREINAMENTO, SEMANA_PRESENCIAL, FERIAS_COLETIVAS) | Data início | Data fim | Descrição
- **FilaHO:** E-mail | Setor | Tipo (USOU, PULOU) | Semana | Registrado em — histórico usado para calcular a fila.
- **SaldoFerias:** E-mail | Saldo inicial | Prazo limite para gozo | Período aquisitivo
- **Trocas:** ID | Proponente | Lançamento do proponente | Destinatário | Lançamento do destinatário | Status (pendente, aceita, recusada) | Criada em | Respondida em
- **AvisosIgnorados:** Quando | E-mail | Lançamento | Código do aviso | Texto do aviso
- **Preferencias:** E-mail | Receber e-mails (Sim/Não) | Convites na agenda (Sim/Não) | Atualizado em — editada pela própria pessoa no app; quem não tem linha = Sim/Sim.
- **MapaNomes:** Nome na planilha antiga | E-mail | Observação — só para a importação.
- **LogNotificacoes:** Quando | Tipo (EMAIL, EVENTO) | Origem | Destinatários originais | Destinatário real | Assunto/título | Resultado — registro de tudo que saiu do sistema (permite conferir que o modo teste desviou os envios).
