// EmDia — lógica partilhada de contas: buscar, renderizar uma linha,
// pagar. Usado por index.html (resumo) e contas.html (lista completa).

let CONTAS_CACHE = null;

async function carregarContas(forcar) {
  if (CONTAS_CACHE && !forcar) return { ok: true, dados: CONTAS_CACHE };
  const r = await api('emdia_minhas_contas');
  if (!r.ok) return { ok: false, erro: r.erro };
  CONTAS_CACHE = r.dados.map((c) => ({ ...c, chaveEstado: estadoConta(c) }));
  return { ok: true, dados: CONTAS_CACHE };
}

function linhaConta(c, comAcao) {
  const servicoNome = NOMES_SERVICO[c.servico] || c.servico;
  const icone = ICONES_SERVICO[c.servico] || 'i-recibo';
  const podePagar = c.chaveEstado !== 'pago';
  const subtitulo = c.chaveEstado === 'pago' ? `Pago em ${formatarData(c.paga_em)}` : diasPara(c.prazo);
  return `
    <div class="ed-conta-linha">
      <span class="ed-conta-icone"><span class="ed-icone ${icone}" aria-hidden="true"></span></span>
      <div class="info">
        <div class="nome">${esc(servicoNome)}</div>
        <div class="venc">${esc(subtitulo)}</div>
      </div>
      <div style="text-align:right">
        <div class="valor">${esc(formatarDinheiro(c.valor))}</div>
        <span class="ed-selo ed-selo-${c.chaveEstado}" style="margin-top:4px">
          <span class="ponto"></span>${esc(rotuloEstado(c.chaveEstado))}</span>
      </div>
      ${comAcao && podePagar
        ? `<button type="button" class="ed-botao ed-botao-primario ed-botao-pequeno"
             style="margin-left:12px" data-pagar="${esc(c.fatura_id)}">Pagar</button>`
        : ''}
    </div>`;
}

// ── modal de pagamento ───────────────────────────────────────────────
function janelaPagar() {
  let d = document.getElementById('janela-pagar');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'janela-pagar';
  d.className = 'ed-modal-dialog';
  d.innerHTML = `
    <p class="ed-h2" style="margin-bottom:8px" id="pagar-titulo">Marcar como paga?</p>
    <p class="ed-caption" style="margin-bottom:var(--ed-e4)" id="pagar-desc"></p>
    <p class="ed-msg" id="pagar-msg" style="margin-bottom:var(--ed-e3)"></p>
    <div class="ed-fila" style="justify-content:flex-end">
      <button type="button" class="ed-botao ed-botao-terciario ed-botao-pequeno" id="pagar-cancelar">Cancelar</button>
      <button type="button" class="ed-botao ed-botao-primario ed-botao-pequeno" id="pagar-confirmar">Confirmar</button>
    </div>`;
  document.body.appendChild(d);
  d.querySelector('#pagar-cancelar').addEventListener('click', () => d.close());
  d.addEventListener('click', (ev) => { if (ev.target === d) d.close(); });
  return d;
}

function abrirPagar(conta, aoPagar) {
  const d = janelaPagar();
  const servicoNome = NOMES_SERVICO[conta.servico] || conta.servico;
  d.querySelector('#pagar-desc').textContent =
    `${servicoNome} · ${formatarDinheiro(conta.valor)} · referência ${conta.entidade} ${conta.referencia}`;
  mostrarMsg(d.querySelector('#pagar-msg'), '');
  const btn = d.querySelector('#pagar-confirmar');
  const novo = btn.cloneNode(true); btn.replaceWith(novo); // limpa listeners de chamadas anteriores
  novo.addEventListener('click', async () => {
    novo.disabled = true;
    mostrarMsg(d.querySelector('#pagar-msg'), 'A processar…');
    const r = await api('banco_pagar_referencia', { p_entidade: conta.entidade, p_referencia: conta.referencia });
    novo.disabled = false;
    if (!r.ok) { mostrarMsg(d.querySelector('#pagar-msg'), r.erro, 'erro'); return; }
    d.close();
    await aoPagar();
  });
  if (!d.open) d.showModal();
}

function ligarBotoesPagar(raiz, aoPagar) {
  (raiz || document).querySelectorAll('[data-pagar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const conta = CONTAS_CACHE.find((c) => c.fatura_id === btn.dataset.pagar);
      if (conta) abrirPagar(conta, aoPagar);
    });
  });
}
