# pp-utilities — EmDia

Cobranças recorrentes — água, energia, internet, telecom, renda (Prepara Portugal)

**Status:** backend pronto e testado com SQL real. Identidade visual e
biblioteca (`biblioteca.html`) prontas. Frontend da app por fazer.
**Depende de:** pp-base, pp-identidade, pp-banco, pp-correio, pp-orgaos

Documentação completa (PRDs e decisões) em
[prepara-portugal-docs](https://github.com/projetoempresaficticia/prepara-portugal-docs).

## Nome e desenho

**EmDia** — uma única empresa emite os cinco tipos de fatura recorrente
(não cinco empresas separadas). Decisão do Germano: "são vários serviços de
criação de boletos, então vai ter tudo num único local."

Reaproveita o motor de fatura+boleto já usado por AT/Segurança Social
(`banco_emitir_fatura_interna` + `banco_pagar_referencia`) — nenhum
mecanismo de pagamento novo. Ver `sql/001_emdia_setup.sql` e
`sql/002_ciclo_faturacao.sql`, e a skill `pp-utilities` (secção
`references/emissao-ciclo.md`) para os detalhes técnicos e o porquê da
correção em cima do desenho original.

Testado com SQL real: emissão de ciclo (idempotente), multa por atraso,
pagamento por referência de ponta a ponta com dinheiro a mover-se de
verdade, aviso por Correio.

## Identidade visual

Tema escuro, Sora (títulos) + Inter (texto/interface), a partir dos
ficheiros enviados pelo Germano (ícone, fundo, kit de UI). Ver
`biblioteca.html` — cores, tipografia, foundations, botões, campos,
selos, cartões de conta, dados financeiros, navegação, feedback e
templates. Duas correções de contraste medidas (WCAG real) documentadas
na própria página: `--ed-primario-botao` (texto branco sobre botão
sólido) e `--ed-texto-em-selo` (selos cheios).

## Por fazer

- Frontend da app (dashboard, lista de contas, calendário, perfil) — a
  biblioteca já tem os componentes prontos para compor.
- Agendamento automático do ciclo (Supabase scheduled function / GitHub
  Action) — por agora, `util_emitir_ciclo`/`util_aplicar_multas` chamam-se
  à mão pela professora.
