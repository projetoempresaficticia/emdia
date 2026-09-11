// EmDia — dashboard (Início).

const elAVerificar = document.getElementById('a-verificar');
const elEntrada = document.getElementById('entrada');
const elPainel = document.getElementById('painel');

function mostrarPainel() { elAVerificar.hidden = true; elEntrada.hidden = true; elPainel.hidden = false; }
function mostrarEntrada() { elAVerificar.hidden = true; elPainel.hidden = true; elEntrada.hidden = false; }

function saudacaoDaHora() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia!';
  if (h < 19) return 'Boa tarde!';
  return 'Boa noite!';
}

async function carregar() {
  const r = await carregarContas();
  if (!r.ok) {
    document.getElementById('lista-recente').innerHTML = `<p class="ed-vazio">${esc(r.erro)}</p>`;
    return;
  }
  const contas = r.dados;
  const porPagar = contas.filter((c) => c.chaveEstado !== 'pago');
  const total = porPagar.reduce((soma, c) => soma + c.valor, 0);
  document.getElementById('total-a-pagar').textContent = formatarDinheiro(total);
  document.getElementById('resumo-contagem').textContent =
    porPagar.length === 0 ? 'Tudo em dia — nenhuma conta pendente.'
      : (porPagar.length === 1 ? '1 conta por pagar' : `${porPagar.length} contas por pagar`);

  const proxima = porPagar.slice().sort((a, b) => new Date(a.prazo) - new Date(b.prazo))[0];
  const elProxima = document.getElementById('proxima-conta');
  if (proxima) {
    elProxima.innerHTML = `
      <p class="bib-tipo-rotulo" style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ed-texto-suave);margin-bottom:10px">Próxima conta</p>
      <div class="ed-cartao">${linhaConta(proxima, true)}</div>`;
    ligarBotoesPagar(elProxima, () => carregar());
  } else {
    elProxima.innerHTML = '';
  }

  const recentes = contas.slice(0, 4);
  const elLista = document.getElementById('lista-recente');
  elLista.innerHTML = recentes.length
    ? recentes.map((c) => linhaConta(c, false)).join('')
    : '<p class="ed-vazio">Ainda não há contas.</p>';
}

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
  document.getElementById('saudacao-nome').textContent = saudacaoDaHora();
  document.getElementById('saudacao-hora').textContent = 'Olá, ' + ctx.empresa.nome;
  await carregar();
});

(async function arrancar() {
  const ctx = await quemSou();
  if (seProfessorRedirecionar(ctx)) return;
  if (!ctx || !ctx.empresa) { mostrarEntrada(); return; }
  mostrarPainel();
  montarTopo(ctx);
  document.getElementById('saudacao-nome').textContent = saudacaoDaHora();
  document.getElementById('saudacao-hora').textContent = 'Olá, ' + ctx.empresa.nome;
  await carregar();
})();
