// EmDia — calendário: em que dias há contas a vencer.

const elAVerificar = document.getElementById('a-verificar');
const elEntrada = document.getElementById('entrada');
const elPainel = document.getElementById('painel');

function mostrarPainel() { elAVerificar.hidden = true; elEntrada.hidden = true; elPainel.hidden = false; }
function mostrarEntrada() { elAVerificar.hidden = true; elPainel.hidden = true; elEntrada.hidden = false; }

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

let mesAtual = new Date(); mesAtual.setDate(1); mesAtual.setHours(0, 0, 0, 0);
let diaSelecionado = new Date(); diaSelecionado.setHours(0, 0, 0, 0);
let contasPorDia = {};

// Componentes locais, nunca toISOString() — o dia-a-dia do calendário é o
// que a pessoa vê no seu próprio fuso, e misturar UTC com local aqui
// desloca contas para a célula errada (apanhado a testar: uma fatura com
// prazo 10 apareceu marcada no dia 11).
function chaveDia(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function agruparContasPorDia(contas) {
  const mapa = {};
  contas.forEach((c) => {
    const k = chaveDia(new Date(c.prazo));
    (mapa[k] = mapa[k] || []).push(c);
  });
  return mapa;
}

document.getElementById('cal-cabecas').innerHTML = DIAS_SEMANA.map((d) => `<div class="cal-cabeca">${d}</div>`).join('');

function renderizarGrelha() {
  document.getElementById('mes-titulo').textContent =
    `${NOMES_MES[mesAtual.getMonth()]} ${mesAtual.getFullYear()}`;

  const primeiroDiaSemana = mesAtual.getDay();
  const diasNoMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i += 1) celulas.push('<div class="cal-dia vazio"></div>');
  for (let dia = 1; dia <= diasNoMes; dia += 1) {
    const d = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), dia);
    const k = chaveDia(d);
    const temContas = !!contasPorDia[k];
    const classes = ['cal-dia'];
    if (d.getTime() === hoje.getTime()) classes.push('hoje');
    if (d.getTime() === diaSelecionado.getTime()) classes.push('selecionado');
    celulas.push(`<button type="button" class="${classes.join(' ')}" data-dia="${k}">
      ${dia}${temContas ? '<span class="marca"></span>' : ''}
    </button>`);
  }
  document.getElementById('cal-grelha').innerHTML = celulas.join('');
  document.querySelectorAll('.cal-dia[data-dia]').forEach((el) => {
    el.addEventListener('click', () => {
      diaSelecionado = new Date(el.dataset.dia + 'T00:00:00');
      renderizarGrelha();
      renderizarDia();
    });
  });
}

function renderizarDia() {
  const k = chaveDia(diaSelecionado);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  document.getElementById('dia-titulo').textContent =
    diaSelecionado.getTime() === hoje.getTime() ? 'Hoje' : formatarData(diaSelecionado.toISOString());
  const contasDoDia = contasPorDia[k] || [];
  const elDia = document.getElementById('dia-contas');
  elDia.innerHTML = contasDoDia.length
    ? contasDoDia.map((c) => linhaConta(c, true)).join('')
    : '<p class="ed-vazio">Sem contas neste dia.</p>';
  ligarBotoesPagar(elDia, async () => {
    await carregarContas(true);
    contasPorDia = agruparContasPorDia((await carregarContas()).dados);
    renderizarGrelha();
    renderizarDia();
  });
  ligarBotoesBoleto(elDia);
}

document.getElementById('mes-anterior').addEventListener('click', () => {
  mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1);
  renderizarGrelha();
});
document.getElementById('mes-seguinte').addEventListener('click', () => {
  mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1);
  renderizarGrelha();
});

async function carregar() {
  const r = await carregarContas();
  if (!r.ok) return;
  contasPorDia = agruparContasPorDia(r.dados);
  renderizarGrelha();
  renderizarDia();
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
  await carregar();
});

(async function arrancar() {
  const ctx = await quemSou();
  if (seProfessorRedirecionar(ctx)) return;
  if (!ctx || !ctx.empresa) { mostrarEntrada(); return; }
  mostrarPainel();
  montarTopo(ctx);
  await carregar();
})();
