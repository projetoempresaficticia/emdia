// EmDia — helpers partilhados: biblioteca de identidade E a app a sério.
// Mesmo padrão do dr.js (Diário da República): um ficheiro só, todas as
// páginas importam.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Clique num "chip" de cor da biblioteca copia o hex.
function ligarCopiarHex() {
  document.querySelectorAll('[data-copiar]').forEach((el) => {
    el.addEventListener('click', async () => {
      const valor = el.dataset.copiar;
      try {
        await navigator.clipboard.writeText(valor);
        const anterior = el.dataset.rotuloOriginal || el.textContent;
        el.dataset.rotuloOriginal = anterior;
        el.textContent = 'Copiado!';
        setTimeout(() => { el.textContent = anterior; }, 1100);
      } catch (e) { /* sem permissão de clipboard: não é crítico aqui */ }
    });
  });
}

document.addEventListener('DOMContentLoaded', ligarCopiarHex);

// ── dinheiro e datas ─────────────────────────────────────────────────
function formatarDinheiro(centavos) {
  const v = Number(centavos || 0) / 100;
  return '€ ' + v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// "Vence em 5 dias" / "Vence hoje" / "Venceu há 3 dias" — o kit da EmDia
// fala sempre em dias-até-vencer, não em "há quanto tempo" (isso é do
// Diário). Duas frases diferentes de propósito.
function diasPara(prazoIso) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(prazoIso); prazo.setHours(0, 0, 0, 0);
  const dias = Math.round((prazo - hoje) / 86400000);
  if (dias === 0) return 'Vence hoje';
  if (dias > 0) return dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`;
  const atraso = -dias;
  return atraso === 1 ? 'Venceu há 1 dia' : `Venceu há ${atraso} dias`;
}

// Estado da conta a partir de fatura+boleto — os quatro selos do kit
// (Pago / Pendente / Vence hoje / Atrasado), nunca um quinto estado
// inventado.
function estadoConta(conta) {
  if (conta.estado === 'paga') return 'pago';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(conta.prazo); prazo.setHours(0, 0, 0, 0);
  if (prazo < hoje) return 'atrasado';
  if (prazo.getTime() === hoje.getTime()) return 'vence-hoje';
  return 'pendente';
}

function rotuloEstado(chave) {
  return { pago: 'Pago', pendente: 'Pendente', 'vence-hoje': 'Vence hoje', atrasado: 'Atrasado' }[chave] || chave;
}

const NOMES_SERVICO = { agua: 'Água', energia: 'Energia', internet: 'Internet', telecom: 'Telecom', renda: 'Aluguel' };
const ICONES_SERVICO = { agua: 'i-agua', energia: 'i-energia', internet: 'i-internet', telecom: 'i-internet', renda: 'i-casa' };

// ── versão do site nos links internos ───────────────────────────────
function versaoDoSite() {
  const m = document.querySelector('meta[name="emdia-versao"]');
  return (m && m.content) ? m.content : '';
}
function comVersao(href) {
  const v = versaoDoSite();
  if (!v || /^https?:/.test(href)) return href;
  const [caminho, resto] = href.split('?');
  const params = new URLSearchParams(resto || '');
  params.set('v', v);
  return caminho + '?' + params.toString();
}

// ── sessão ───────────────────────────────────────────────────────────
async function quemSou() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  const { data: pessoa } = await sb
    .from('pessoas').select('cedula, nome, papel, empresa_id')
    .eq('id', data.session.user.id).single();
  if (!pessoa) return null;
  let empresa = null;
  if (pessoa.empresa_id) {
    const { data: e } = await sb
      .from('empresas').select('cedula, nome').eq('id', pessoa.empresa_id).single();
    empresa = e || null;
  }
  return { pessoa, empresa };
}

function mostrarMsg(el, texto, tipo) {
  if (!el) return;
  el.textContent = texto || '';
  el.className = 'ed-msg' + (tipo ? ' ed-msg-' + tipo : '');
}

function ligarVerSenha(sufixo) {
  const btn = document.getElementById('btn-ver-senha' + (sufixo || ''));
  const campo = document.getElementById('senha' + (sufixo || ''));
  if (!btn || !campo) return;
  btn.addEventListener('click', () => {
    const aMostrar = campo.type === 'password';
    campo.type = aMostrar ? 'text' : 'password';
    btn.textContent = aMostrar ? 'Esconder' : 'Mostrar';
    btn.setAttribute('aria-pressed', String(aMostrar));
    campo.focus();
  });
}

function ligarFormularioLogin(idForm, aoEntrar) {
  const form = document.getElementById(idForm);
  if (!form) return;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = form.querySelector('.ed-msg');
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    mostrarMsg(msg, 'A entrar…');
    const { error } = await sb.auth.signInWithPassword({
      email: form.querySelector('[name="email"]').value,
      password: form.querySelector('[name="senha"]').value,
    });
    if (btn) btn.disabled = false;
    if (error) {
      mostrarMsg(msg, 'Email ou senha errados.', 'erro');
      return;
    }
    mostrarMsg(msg, '');
    await aoEntrar();
  });
}

// ── topo + navegação inferior ───────────────────────────────────────
function montarTopo(ctx) {
  const el = document.getElementById('topo');
  if (!el) return;
  el.className = 'ed-topo';
  el.innerHTML = `
    <div class="ed-topo-int">
      <a class="ed-marca" href="${comVersao('index.html')}"><img src="web/marca/emdia-marca.png" alt="" />EmDia</a>
      <span style="flex:1"></span>
      <span class="ed-suave" style="font-size:13px">${esc(ctx.pessoa.papel === 'professor' || !ctx.empresa ? ctx.pessoa.nome : ctx.empresa.nome)}</span>
      <button type="button" class="ed-botao-icone" style="background:transparent;color:var(--ed-texto)" id="btn-sair" aria-label="Sair">
        <span class="ed-icone i-fechar" aria-hidden="true"></span>
      </button>
    </div>`;
  document.getElementById('btn-sair').addEventListener('click', async () => {
    try { await sb.auth.signOut(); } catch (e) { /* sai de qualquer forma */ }
    window.location.href = 'entrar.html';
  });
}

function montarNavInferior(paginaAtual) {
  const el = document.getElementById('nav-inferior');
  if (!el) return;
  const itens = [
    { href: 'index.html', icone: 'i-casa', rotulo: 'Início' },
    { href: 'contas.html', icone: 'i-recibo', rotulo: 'Contas' },
    { href: 'calendario.html', icone: 'i-calendario', rotulo: 'Calendário' },
    { href: 'perfil.html', icone: 'i-utilizador', rotulo: 'Perfil' },
  ];
  el.className = 'ed-nav-inferior';
  el.innerHTML = itens.map((it) => `
    <a href="${comVersao(it.href)}" ${it.href === paginaAtual ? 'aria-current="page"' : ''}>
      <span class="ed-icone ${it.icone}" aria-hidden="true"></span>${it.rotulo}
    </a>`).join('');
}

// ── janelas ──────────────────────────────────────────────────────────
function abrirJanela(id) {
  const d = document.getElementById(id);
  if (d && !d.open) d.showModal();
  return d;
}
function ligarFechos() {
  document.querySelectorAll('[data-fechar]').forEach((b) => {
    b.addEventListener('click', () => {
      const d = document.getElementById(b.dataset.fechar);
      if (d) d.close();
    });
  });
}
document.addEventListener('DOMContentLoaded', ligarFechos);
