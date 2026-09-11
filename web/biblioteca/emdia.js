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

// Só a professora tem professor.html; se uma conta de professor entrar
// numa página da empresa (a de teste até tem empresa ligada — ver
// [[project-estado-pp-utilities-emdia]]), manda sempre para o painel
// dela em vez de mostrar um portão sem saída ou o painel errado.
function seProfessorRedirecionar(ctx) {
  if (ctx && ctx.pessoa && ctx.pessoa.papel === 'professor') {
    window.location.replace(comVersao('professor.html'));
    return true;
  }
  return false;
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

// ── topo (menu sempre em cima — mesmo padrão do resto do ecossistema,
// nunca uma barra fixa no fundo) ─────────────────────────────────────
// A professora e a empresa veem menus diferentes: a professora só tem o
// seu próprio painel (mesmo que a conta de teste tenha por acaso uma
// empresa ligada — ver [[project-estado-pp-utilities-emdia]]).
function montarTopo(ctx) {
  const el = document.getElementById('topo');
  if (!el) return;
  el.className = 'ed-topo';
  const ehProfessor = ctx.pessoa.papel === 'professor';
  const paginaAtual = window.location.pathname.split('/').pop();

  const links = ehProfessor
    ? [{ href: 'professor.html', rotulo: 'Painel da professora' }]
    : [
        { href: 'index.html', rotulo: 'Início' },
        { href: 'contas.html', rotulo: 'Contas' },
        { href: 'calendario.html', rotulo: 'Calendário' },
        { href: 'perfil.html', rotulo: 'Perfil' },
      ];

  el.innerHTML = `
    <div class="ed-topo-int">
      <a class="ed-marca" href="${comVersao(ehProfessor ? 'professor.html' : 'index.html')}">
        <img src="web/marca/emdia-marca.png" alt="" />EmDia</a>
      <nav aria-label="Navegação principal">
        ${links.map((l) => `<a href="${comVersao(l.href)}"
             ${l.href === paginaAtual ? 'aria-current="page"' : ''}>${esc(l.rotulo)}</a>`).join('')}
      </nav>
      <span style="flex:1"></span>
      <span class="ed-suave ed-topo-nome" style="font-size:13px">${esc(ehProfessor || !ctx.empresa ? ctx.pessoa.nome : ctx.empresa.nome)}</span>
      <button type="button" class="ed-botao-icone" style="background:transparent;color:var(--ed-texto)" id="btn-sair" aria-label="Sair">
        <span class="ed-icone i-fechar" aria-hidden="true"></span>
      </button>
    </div>`;
  document.getElementById('btn-sair').addEventListener('click', async () => {
    try { await sb.auth.signOut(); } catch (e) { /* sai de qualquer forma */ }
    window.location.href = 'entrar.html';
  });
}

// ── boleto (popup com o documento real, reaproveitando
// banco_boleto_documento — o mesmo que Prepacoin já usa, nada de
// mecanismo novo) ─────────────────────────────────────────────────────
function janelaBoleto() {
  let d = document.getElementById('janela-boleto');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'janela-boleto';
  d.className = 'ed-modal-boleto';
  document.body.appendChild(d);
  d.addEventListener('click', (ev) => { if (ev.target === d) d.close(); });
  return d;
}

function linhaBoletoItem(l) {
  return `<tr><td>${esc(l.descricao)}</td><td>${l.quantidade}</td>
    <td>${esc(formatarDinheiro(l.valor_unitario))}</td><td>${esc(formatarDinheiro(l.total))}</td></tr>`;
}

async function abrirBoleto(entidade, referencia) {
  const d = janelaBoleto();
  d.innerHTML = '<div class="ed-janela-cabeca"><h2>Boleto</h2></div><p class="ed-vazio">A carregar…</p>';
  if (!d.open) d.showModal();

  const r = await api('banco_boleto_documento', { p_entidade: entidade, p_referencia: referencia });
  if (!r.ok) {
    d.innerHTML = `
      <div class="ed-janela-cabeca"><h2>Boleto</h2>
        <button type="button" class="ed-icone-botao" id="boleto-fechar" aria-label="Fechar">
          <span class="ed-icone i-fechar" aria-hidden="true"></span></button></div>
      <p class="ed-vazio">${esc(r.erro)}</p>`;
    d.querySelector('#boleto-fechar').addEventListener('click', () => d.close());
    return;
  }
  const b = r.dados;
  const chaveEstado = b.estado === 'pago' ? 'pago' : (b.vencido ? 'atrasado' : 'pendente');
  const refEspacada = b.referencia.replace(/(\d{3})(?=\d)/g, '$1 ');

  d.innerHTML = `
    <div class="ed-janela-cabeca">
      <h2>Boleto · ${esc(b.fatura)}</h2>
      <button type="button" class="ed-icone-botao" id="boleto-fechar" aria-label="Fechar">
        <span class="ed-icone i-fechar" aria-hidden="true"></span></button>
    </div>
    <div class="ed-boleto-corpo">
      <div class="ed-fila" style="justify-content:space-between;align-items:flex-start">
        <div>
          <p class="ed-caption">${esc(b.emitente)} → ${esc(b.devedor)}</p>
          <p class="ed-label" style="margin-top:2px">${esc(b.descricao)}</p>
        </div>
        <span class="ed-selo ed-selo-${chaveEstado}"><span class="ponto"></span>${esc(rotuloEstado(chaveEstado))}</span>
      </div>

      <p class="ed-display" style="margin-top:var(--ed-e4)">${esc(formatarDinheiro(b.valor))}</p>

      <div class="ed-boleto-linha-digitavel">
        <span class="ed-caption">Entidade</span>
        <span class="mono">${esc(b.entidade)}</span>
        <span class="ed-caption" style="margin-top:8px">Referência</span>
        <span class="mono">${esc(refEspacada)}</span>
      </div>

      <div class="ed-fila" style="justify-content:space-between;margin-top:var(--ed-e3)">
        <span class="ed-caption">Prazo: ${esc(formatarData(b.prazo))}</span>
        <span class="ed-caption">${b.pago_em ? 'Pago em ' + esc(formatarData(b.pago_em)) : 'Emitido em ' + esc(formatarData(b.emitido_em))}</span>
      </div>

      ${b.linhas.length ? `
        <div class="ed-tabela-envolt" style="margin-top:var(--ed-e4)">
          <table class="ed-tabela">
            <thead><tr><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th></tr></thead>
            <tbody>${b.linhas.map(linhaBoletoItem).join('')}</tbody>
          </table>
        </div>` : ''}
    </div>`;
  d.querySelector('#boleto-fechar').addEventListener('click', () => d.close());
}

function botaoVerBoleto(entidade, referencia) {
  return `<button type="button" class="ed-botao ed-botao-secundario ed-botao-pequeno"
            data-ver-boleto="${esc(entidade)}|${esc(referencia)}">
    <span class="ed-icone ed-icone-16 i-recibo" aria-hidden="true"></span>Ver boleto</button>`;
}

function ligarBotoesBoleto(raiz) {
  (raiz || document).querySelectorAll('[data-ver-boleto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [entidade, referencia] = btn.dataset.verBoleto.split('|');
      abrirBoleto(entidade, referencia);
    });
  });
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
