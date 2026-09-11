-- 003_frontend_rpcs.sql — as duas RPCs que a app precisa: a empresa vê e
-- paga as suas próprias contas; a professora dispara o ciclo e acompanha
-- quem já pagou. Nenhuma delas inventa mecanismo de pagamento — pagar
-- continua a ser `banco_pagar_referencia(entidade, referencia_mb)`, o
-- mesmo botão que já usam para AT/Segurança Social.

create or replace function public.emdia_minhas_contas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_empresa text := public.fn_minha_empresa_cedula();
  v_emdia text;
  v_linhas jsonb;
begin
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'erro', 'Sem empresa associada.');
  end if;

  select cedula into v_emdia from public.empresas where nome = 'EmDia';

  select coalesce(jsonb_agg(jsonb_build_object(
           'fatura_id', f.id, 'numero', f.numero, 'servico', f.servico, 'ciclo', f.ciclo,
           'valor', f.valor_total, 'estado', f.estado,
           'entidade', b.entidade, 'referencia', b.referencia_mb, 'prazo', b.prazo,
           'emitida_em', f.emitida_em, 'paga_em', f.paga_em
         ) order by b.prazo asc), '[]'::jsonb)
    into v_linhas
    from public.faturas f
    join public.boletos b on b.fatura_id = f.id
   where f.emitente_cedula = v_emdia and f.devedor_cedula = v_empresa;

  return jsonb_build_object('ok', true, 'dados', v_linhas);
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Não foi possível listar as contas.');
end;
$function$;

revoke all on function public.emdia_minhas_contas() from public, anon;
grant execute on function public.emdia_minhas_contas() to authenticated;

-- ── painel da professora: um grupo por servico+ciclo já emitido ────────
create or replace function public.emdia_professor_resumo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_emdia text;
  v_linhas jsonb := '[]'::jsonb;
  r record;
  v_empresas jsonb;
begin
  if not public.fn_e_professor() then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão.');
  end if;

  select cedula into v_emdia from public.empresas where nome = 'EmDia';

  for r in
    select distinct servico, ciclo
      from public.faturas
     where emitente_cedula = v_emdia
     order by ciclo desc, servico
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
             'empresa_cedula', f.devedor_cedula, 'empresa_nome', e.nome,
             'valor', f.valor_total, 'estado', f.estado, 'prazo', b.prazo,
             'entidade', b.entidade, 'referencia', b.referencia_mb
           ) order by e.nome), '[]'::jsonb)
      into v_empresas
      from public.faturas f
      join public.boletos b on b.fatura_id = f.id
      join public.empresas e on e.cedula = f.devedor_cedula
     where f.emitente_cedula = v_emdia and f.servico = r.servico and f.ciclo = r.ciclo;

    v_linhas := v_linhas || jsonb_build_object(
      'servico', r.servico, 'ciclo', r.ciclo, 'empresas', v_empresas);
  end loop;

  return jsonb_build_object('ok', true, 'dados', v_linhas);
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Não foi possível carregar o resumo.');
end;
$function$;

revoke all on function public.emdia_professor_resumo() from public, anon;
grant execute on function public.emdia_professor_resumo() to authenticated;
