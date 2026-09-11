-- 001_emdia_setup.sql — regista a EmDia como empresa real (nunca uma
-- cédula de sistema inventada) e corrige o catálogo de serviços.
--
-- Decisão do Germano: um único nome — EmDia — em vez de cinco empresas
-- separadas (uma por água/energia/internet/telecom/renda). É uma só
-- entidade que emite todos os tipos de fatura recorrente.
--
-- `util_emitir_ciclo`/`util_aplicar_multas` já existiam no Supabase,
-- copiadas ao pé da letra do documento da skill — mas inseriam em
-- colunas que a tabela real `public.faturas` não tem (`empresa_cedula`,
-- `valor`, `prazo`: a tabela real é `numero`/`emitente_cedula`/
-- `devedor_cedula`/`valor_total`, partilhada com o sistema de boletos
-- do banco). Nunca tinham corrido com sucesso (faturas/servicos vazias).
-- sql/002 reescreve as duas em cima de `banco_emitir_fatura_interna`,
-- o mesmo motor que AT/Segurança Social já usam.

-- 1. registar a empresa (idempotente — não duplica se já existir)
do $$
declare
  v_cedula text;
begin
  if not exists (select 1 from public.empresas where nome = 'EmDia') then
    v_cedula := public.fn_proxima_cedula('EP');
    insert into public.empresas(cedula, nome, nif_ficticio, email_empresa, regiao, setor, estado)
    values (v_cedula, 'EmDia', regexp_replace(v_cedula, '\D', '', 'g'),
            'emdia@prepara.pt', 'Lisboa', 'utilities', 'ativa');
    perform public.banco_criar_conta_interna(v_cedula, 100000);
  end if;
end $$;

-- 2. catálogo de serviços — a tabela já existia (rascunho anterior);
-- tira a coluna iban_servico, que só fazia sentido com um IBAN por
-- serviço e agora é sempre o mesmo (a conta única da EmDia).
alter table public.servicos drop column if exists iban_servico;

-- RLS — a tabela já tinha rowsecurity ligada mas SEM NENHUMA policy
-- (bloqueada por completo, nem leitura). fn_e_admin() não existe nesta
-- base — o papel mais próximo de "admin" já usado no resto do
-- ecossistema é fn_e_professor() (ex.: catálogo do Diário da República).
drop policy if exists "serviços leitura pública" on public.servicos;
create policy "serviços leitura pública" on public.servicos for select using (true);
drop policy if exists "serviços escrita professor" on public.servicos;
create policy "serviços escrita professor" on public.servicos for all
  using (public.fn_e_professor()) with check (public.fn_e_professor());

-- 3. semear o catálogo (valores em cêntimos de P$, piso/teto do desenho
-- da skill)
insert into public.servicos (servico, nome, piso, teto) values
  ('agua', 'Água', 4000, 8000),
  ('energia', 'Energia', 6000, 12000),
  ('internet', 'Internet', 3000, 6000),
  ('telecom', 'Telecom', 2500, 5000),
  ('renda', 'Renda', 20000, 40000)
on conflict (servico) do update set nome = excluded.nome, piso = excluded.piso, teto = excluded.teto;
