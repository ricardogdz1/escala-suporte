# Arquivos de referência

Coloque aqui (NÃO commitar, contêm dados pessoais):
- `Agenda_Suporte.xlsx` – planilha antiga do gestor. Usar só as abas: Sábados, Plantão Meio dia, Plantões 2026, HomeOffice, Férias. Ignorar as demais.
- `Cadastro_Pessoas_Setores.xlsx` – cadastro novo (Pessoas, Setores, Setores extras).
- Prints do esboço visual (opcional).

## Particularidades da planilha antiga (para a importação)
- Grade pessoas × datas marcada com "x"/"X". Setor não existe como dado (só cores, inconsistentes entre abas).
- Nomes variam entre abas: "Pedro D"/"Pedro D.", "Victor " (espaço), "Felipe", "Felipe R.", "Felipe N.", "Athur" (= Arthur). Mapear para os e-mails do cadastro.
- **Sábados:** duas colunas por sábado, "(11:00)" = turno 8h–11h e "(12:00)" = turno 9h–12h. Células podem ter "Férias" ou "TREINAMENTO". O contador "Qtd. Op." só soma as linhas 2 a 13 (bug).
- **Plantão Meio dia:** grade semanal fixa (segunda a sexta). Nota: "organização sempre na daily de segunda". Intervalos 11:00–12:30 e 12:30–14:00.
- **Plantões 2026:** uma coluna por dia útil; "FERIADO" em dias de feriado; coluna TOTAL.
- **HomeOffice:** uma coluna por dia útil; "X" = home office; "PRESENCIAL" = semana presencial obrigatória.
- **Férias:** Saldo inicial, Limite, até 2 períodos (Data ini/fim), dias, saldo. Cores: verde = encaminhada, amarelo = para encaminhar, vermelho = próximas. Coletivas em M3:N3. Pessoas que aparecem aqui mas não no cadastro novo (Carlos, Victor) devem ser ignoradas ou confirmadas com o usuário.
