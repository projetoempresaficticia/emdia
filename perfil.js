// EmDia — perfil da empresa.

const elAVerificar = document.getElementById('a-verificar');
const elEntrada = document.getElementById('entrada');
const elPainel = document.getElementById('painel');

function mostrarPainel() { elAVerificar.hidden = true; elEntrada.hidden = true; elPainel.hidden = false; }
function mostrarEntrada() { elAVerificar.hidden = true; elPainel.hidden = true; elEntrada.hidden = false; }

async function preencher(ctx) {
  document.getElementById('perfil-nome').textContent = ctx.empresa.nome;
  document.getElementById('perfil-cedula').textContent = ctx.empresa.cedula;
  const r = await carregarContas();
  if (r.ok) {
    const totalPago = r.dados.filter((c) => c.chaveEstado === 'pago').reduce((s, c) => s + c.valor, 0);
    document.getElementById('perfil-total-pago').textContent = formatarDinheiro(totalPago);
  }
}

document.getElementById('btn-sair-perfil').addEventListener('click', async () => {
  try { await sb.auth.signOut(); } catch (e) { /* sai de qualquer forma */ }
  window.location.href = 'entrar.html';
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
  await preencher(ctx);
});

(async function arrancar() {
  const ctx = await quemSou();
  if (seProfessorRedirecionar(ctx)) return;
  if (!ctx || !ctx.empresa) { mostrarEntrada(); return; }
  mostrarPainel();
  montarTopo(ctx);
  await preencher(ctx);
})();
