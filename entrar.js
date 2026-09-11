// EmDia — página de login. Depois de entrar, volta para onde se estava
// (`voltar`), ou para o dashboard por omissão.

const params = new URLSearchParams(window.location.search);
const voltar = params.get('voltar') || 'index.html';

ligarVerSenha();
ligarFormularioLogin('form-login', async () => {
  window.location.href = comVersao(voltar);
});

// Quem já tem sessão e chega aqui não precisa de ver o formulário outra vez.
(async function arrancar() {
  const ctx = await quemSou();
  if (ctx) window.location.replace(comVersao(voltar));
})();
