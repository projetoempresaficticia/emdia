// EmDia — lista completa de contas, com filtro Todas/Pendentes/Pagas.

const elAVerificar = document.getElementById('a-verificar');
const elEntrada = document.getElementById('entrada');
const elPainel = document.getElementById('painel');
const elLista = document.getElementById('lista-contas');
const elSegmentado = document.getElementById('segmentado');

let filtroAtual = 'todas';

function mostrarPainel() { elAVerificar.hidden = true; elEntrada.hidden = true; elPainel.hidden = false; }
function mostrarEntrada() { elAVerificar.hidden = true; elPainel.hidden = true; elEntrada.hidden = false; }

function aplicarFiltro(contas) {
  if (filtroAtual === 'pendentes') return contas.filter((c) => c.chaveEstado !== 'pago');
  if (filtroAtual === 'pagas') return contas.filter((c) => c.chaveEstado === 'pago');
  return contas;
}

async function renderizar() {
  const r = await carregarContas();
  if (!r.ok) { elLista.innerHTML = `<p class="ed-vazio">${esc(r.erro)}</p>`; return; }
  const visiveis = aplicarFiltro(r.dados);
  elLista.innerHTML = visiveis.length
    ? visiveis.map((c) => linhaConta(c, true)).join('')
    : '<p class="ed-vazio">Nenhuma conta aqui.</p>';
  ligarBotoesPagar(elLista, async () => { await carregarContas(true); await renderizar(); });
}

elSegmentado.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    filtroAtual = btn.dataset.filtro;
    elSegmentado.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b === btn)));
    renderizar();
  });
});

ligarVerSenha();
ligarFormularioLogin('form-login', async () => {
  const ctx = await quemSou();
  if (seProfessorRedirecionar(ctx)) return;
  if (!ctx || !ctx.empresa) {
    mostrarMsg(document.querySelector('#form-login .ed-msg'),
      'Esta conta não está associada a nenhuma empresa.', 'erro');
    await sb.auth.signOut();
    return;
  }
  mostrarPainel();
  montarTopo(ctx);
  await renderizar();
});

(async function arrancar() {
  const ctx = await quemSou();
  if (seProfessorRedirecionar(ctx)) return;
  if (!ctx || !ctx.empresa) { mostrarEntrada(); return; }
  mostrarPainel();
  montarTopo(ctx);
  await renderizar();
})();
