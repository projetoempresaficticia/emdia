-- 002_ciclo_faturacao.sql — o coração da automação: emitir uma fatura
-- por empresa a cada ciclo, reaproveitando o motor de fatura+boleto já
-- usado por toda a gente (banco_emitir_fatura_interna) em vez de um
-- mecanismo de pagamento novo. Substitui as duas funções quebradas que
-- aqui estavam (ver sql/001 para o porquê).

drop function if exists public.util_emitir_ciclo(text, text, timestamptz);
drop function if exists public.util_aplicar_multas(text, text, bigint);

-- Só a professora dispara um ciclo — qualquer empresa autenticada podendo
-- chamar isto geraria faturas falsas para todas as outras.
create or replace function public.util_emitir_ciclo(
  p_servico text, p_ciclo text, p_prazo_dias int default 15)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_emdia text;
  r_serv record;
  r_emp record;
  v_valor bigint;
  v_res jsonb;
  v_n int := 0;
begin
  if not public.fn_e_professor() then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão.');
  end if;

  select cedula into v_emdia from public.empresas where nome = 'EmDia';
  if v_emdia is null then
    return jsonb_build_object('ok', false, 'erro', 'EmDia não está registada.');
  end if;

  select * into r_serv from public.servicos where servico = p_servico;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Serviço desconhecido: ' || p_servico);
  end if;

  for r_emp in
    select cedula from public.empresas where estado = 'ativa' and cedula <> v_emdia
  loop
    -- idempotência: não repetir fatura deste serviço/empresa/ciclo
    if exists (select 1 from public.faturas
                where servico = p_servico and devedor_cedula = r_emp.cedula and ciclo = p_ciclo) then
      continue;
    end if;
    -- só fatura quem já tem conta no Prepacoin — banco_emitir_fatura_interna
    -- recusaria sem conta; filtrar aqui poupa uma chamada destinada a falhar
    if not exists (select 1 from public.contas where cedula = r_emp.cedula) then
      continue;
    end if;

    v_valor := r_serv.piso + floor(random() * (r_serv.teto - r_serv.piso + 1));

    v_res := public.banco_emitir_fatura_interna(
      v_emdia, r_emp.cedula,
      r_serv.nome || ' — ' || p_ciclo,
      jsonb_build_array(jsonb_build_object(
        'descricao', r_serv.nome || ' (' || p_ciclo || ')',
        'valor_unitario', v_valor, 'quantidade', 1)),
      p_prazo_dias, p_servico, p_ciclo);

    if (v_res->>'ok')::boolean then
      v_n := v_n + 1;
      -- banco_emitir_fatura_interna é o primitivo genérico de faturação
      -- (usado por qualquer empresa a faturar outra) e não avisa por
      -- Correio sozinho -- isso é uma decisão desta automação, não do
      -- banco. Remetente é a EmDia a sério, nunca uma cédula inventada.
      insert into public.correio(de_cedula, para_cedula, assunto, corpo)
      values (v_emdia, r_emp.cedula,
        'Fatura ' || r_serv.nome || ' — ' || p_ciclo,
        'Valor a pagar: ' || to_char((v_res->'dados'->>'valor_total')::bigint / 100.0, 'FM999999990.00')
          || ' P$. Referência: ' || (v_res->'dados'->>'entidade') || ' ' || (v_res->'dados'->>'referencia')
          || '. Prazo: ' || to_char((v_res->'dados'->>'prazo')::timestamptz, 'DD/MM/YYYY') || '.');
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object('faturas_emitidas', v_n));
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Falha ao emitir ciclo: ' || sqlerrm);
end;
$function$;

revoke all on function public.util_emitir_ciclo(text, text, int) from public, anon;
grant execute on function public.util_emitir_ciclo(text, text, int) to authenticated;

-- Multa por fatura ainda por pagar depois do prazo do boleto — mesmo
-- mecanismo já usado por orgao_aplicar_multas (linha 'pendente' em
-- public.multas); "em_atraso" é um estado novo em faturas.estado (texto
-- livre, sem CHECK a restringir os valores).
create or replace function public.util_aplicar_multas(
  p_servico text, p_ciclo text, p_valor_multa bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  r record;
  v_n int := 0;
begin
  if not public.fn_e_professor() then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão.');
  end if;

  for r in
    select f.id, f.devedor_cedula
      from public.faturas f
      join public.boletos b on b.fatura_id = f.id
     where f.servico = p_servico and f.ciclo = p_ciclo
       and f.estado = 'emitida' and b.prazo < now()
  loop
    update public.faturas set estado = 'em_atraso' where id = r.id;
    insert into public.multas(id, empresa_cedula, tipo, valor, estado)
    values (gen_random_uuid(), r.devedor_cedula, 'fatura_' || p_servico, p_valor_multa, 'pendente');
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object('multas_geradas', v_n));
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Falha ao aplicar multas: ' || sqlerrm);
end;
$function$;

revoke all on function public.util_aplicar_multas(text, text, bigint) from public, anon;
grant execute on function public.util_aplicar_multas(text, text, bigint) to authenticated;
