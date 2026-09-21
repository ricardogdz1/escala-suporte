# Modelo de dados (planilha-banco)

Proposta inicial. Validar e ajustar na Fase 1.

## Abas de cadastro (já existem em `referencia/Cadastro_Pessoas_Setores.xlsx`)
- **Pessoas:** E-mail corporativo | Nome completo | Nome de exibição | Setor principal | Perfil (Colaborador/Gestor) | Ativo (Sim/Não) | Data de entrada na equipe | Qtd. setores extras (fórmula)
- **Setores:** Setor | Ativo | contagens (fórmulas)
- **Setores extras:** E-mail corporativo | Nome (fórmula) | Setor extra | Observação

## Abas novas
- **Config:** Chave | Valor. Ex.: Modo teste, E-mail de teste, ID calendário teste, ID calendário produção, Sábado mínimo (6), Sábado máximo (8), Vagas meio-dia (2), Vagas plantão (1), Antecedência férias (35).
- **Lancamentos:** ID | Tipo (SABADO, MEIO_DIA, PLANTAO, HOME_OFFICE, FERIAS) | E-mail | Data início | Data fim | Turno (8-11 / 9-12, só sábado) | Status (ativo, cancelado; férias: rascunho, solicitada, aprovada, encaminhada) | Criado por | Criado em | Atualizado em | ID evento agenda
- **Bloqueios:** ID | Tipo (FERIADO, TREINAMENTO, SEMANA_PRESENCIAL, FERIAS_COLETIVAS) | Data início | Data fim | Descrição
- **FilaHO:** E-mail | Setor | Tipo (USOU, PULOU) | Semana | Registrado em — histórico usado para calcular a fila.
- **SaldoFerias:** E-mail | Saldo inicial | Prazo limite para gozo | Período aquisitivo
- **Trocas:** ID | Proponente | Lançamento do proponente | Destinatário | Lançamento do destinatário | Status (pendente, aceita, recusada) | Criada em | Respondida em
- **AvisosIgnorados:** Quando | E-mail | Lançamento | Código do aviso | Texto do aviso
