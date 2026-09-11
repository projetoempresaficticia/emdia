// EmDia — painel da professora: emitir ciclo, aplicar multas, acompanhar
// quem já pagou.

const elAVerificar = document.getElementById('a-verificar');
const elEntrada = document.getElementById('entrada');
const elPainel = document.getElementById('painel');
const elListaResumo = document.getElementById('lista-resumo');

function mostrarPainel() { elAVerificar.hidden = true; elEntrada.hidden = true; elPainel.hidden = false; }
function mostrarEntrada() { elAVerificar.hidden = true; elPainel.hidden = true; elEntrada.hidden = false; }

function linhaEmpresaResumo(e) {
  const chave = e.estado === 'paga' ? 'pago'
    : (new Date(e.prazo) < new Date() ? 'atrasado' : 'pendente');
  return `
    <tr>
      <td>${esc(e.empresa_nome)}</td>
      <td>${esc(formatarDinheiro(e.valor))}</td>
      <td><span class="ed-selo ed-selo-${chave}"><span class="ponto"></span>${esc(rotuloEstado(chave))}</span></td>
      <td>${esc(formatarData(e.prazo))}</td>
    </tr>`;
}

function cartaoResumo(grupo, indice) {
  const total = grupo.empresas.length;
  const pagas = grupo.empresas.filter((e) => e.estado === 'paga').length;
  const pct = total ? Math.round((pagas / total) * 100) : 0;
  const nomeServico = NOMES_SERVICO[grupo.servico] || grupo.servico;
  return `
    <article class="ed-cartao" style="margin-bottom:var(--ed-e4)">
      <div class="ed-fila" style="justify-content:space-between">
        <h3 class="ed-label" style="font-size:15px">${esc(nomeServico)} · ${esc(grupo.ciclo)}</h3>
        <span class="ed-suave" style="font-size:13px">${pagas} de ${total}</span>
      </div>
      <div class="ed-progresso" style="margin-top:var(--ed-e3)"><b style="width:${pct}%"></b></div>
      <p class="ed-caption" style="margin-top:4px">${pct}%</p>
      <button type="button" class="ed-botao ed-botao-secundario ed-botao-pequeno"
              style="margin-top:var(--ed-e3)" data-alternar="resumo-${indice}">Ver empresas</button>
      <div class="ed-tabela-envolt" id="resumo-${indice}" hidden style="margin-top:var(--ed-e3)">
        <table class="ed-tabela">
          <thead><tr><th>Empresa</th><th>Valor</th><th>Estado</th><th>Prazo</th></tr></thead>
          <tbody>${grupo.empresas.map(linhaEmpresaResumo).join('')}</tbody>
        </table>
      </div>
    </article>`;
}

async function carregarResumo() {
  const r = await api('emdia_professor_resumo');
  if (!r.ok) { elListaResumo.innerHTML = `<p class="ed-vazio">${esc(r.erro)}</p>`; return; }
  if (!r.dados.length) { elListaResumo.innerHTML = '<p class="ed-vazio">Ainda não emitiu nenhum ciclo.</p>'; return; }
  elListaResumo.innerHTML = r.dados.map(cartaoResumo).join('');
  elListaResumo.querySelectorAll('[data-alternar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabela = document.getElementById(btn.dataset.alternar);
      const aberta = !tabela.hidden;
      tabela.hidden = aberta;
      btn.textContent = aberta ? 'Ver empresas' : 'Ocultar empresas';
    });
  });
}

document.getElementById('form-emitir').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = document.getElementById('msg-emitir');
  const btn = ev.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  mostrarMsg(msg, 'A emitir…');
  const r = await api('util_emitir_ciclo', {
    p_servico: document.getElementById('e-servico').value,
    p_ciclo: document.getElementById('e-ciclo').value,
    p_prazo_dias: Number(document.getElementById('e-prazo').value),
  });
  btn.disabled = false;
  if (!r.ok) { mostrarMsg(msg, r.erro, 'erro'); return; }
  mostrarMsg(msg, `${r.dados.faturas_emitidas} fatura(s) emitida(s).`, 'ok');
  await carregarResumo();
});

document.getElementById('form-multas').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = document.getElementById('msg-multas');
  const btn = ev.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  mostrarMsg(msg, 'A aplicar…');
  const valorCentavos = Math.round(Number(document.getElementById('m-valor').value) * 100);
  const r = await api('util_aplicar_multas', {
    p_servico: document.getElementById('m-servico').value,
    p_ciclo: document.getElementById('m-ciclo').value,
    p_valor_multa: valorCentavos,
  });
  btn.disabled = false;
  if (!r.ok) { mostrarMsg(msg, r.erro, 'erro'); return; }
  mostrarMsg(msg, `${r.dados.multas_geradas} multa(s) gerada(s).`, 'ok');
  await carregarResumo();
});

ligarVerSenha();
ligarFormularioLogin('form-login', async () => {
  const ctx = await quemSou();
  if (!ctx || !ctx.pessoa || ctx.pessoa.papel !== 'professor') {
    mostrarMsg(document.querySelector('#form-login .ed-msg'),
      'Esta conta não tem acesso à área da professora.', 'erro');
    await sb.auth.signOut();
    return;
  }
  mostrarPainel();
  montarTopo(ctx);
  await carregarResumo();
});

(async function arrancar() {
  const ctx = await quemSou();
  if (!ctx || !ctx.pessoa || ctx.pessoa.papel !== 'professor') { mostrarEntrada(); return; }
  mostrarPainel();
  montarTopo(ctx);
  await carregarResumo();
})();
