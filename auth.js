// ── AUTH ──────────────────────────────────────────────────
// MÓDULO CONGELADO — só editar em última necessidade
// Responsável por: login, logout, sessão, refresh de token
// NÃO importa state, kanban, tarefas ou qualquer módulo de app
// Comunica com o app via evento customizado 'fluxa:sessao'

import { sb } from './supabase.js'

// Dispara evento para o app reagir à sessão (sem acoplamento direto)
function emitSessao(session) {
  window.dispatchEvent(new CustomEvent('fluxa:sessao', { detail: { session } }))
}

// ── LOGIN / LOGOUT ────────────────────────────────────────
window.setLoginTab = function(tab, btn) {
  document.querySelectorAll('.login-tab').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById('loginFormWrap').style.display  = tab === 'login'  ? '' : 'none'
  document.getElementById('signupFormWrap').style.display = tab === 'signup' ? '' : 'none'
}

window.doLogin = async function() {
  const email = document.getElementById('lEmail').value.trim()
  const senha = document.getElementById('lSenha').value
  if (!email || !senha) { document.getElementById('loginErr').textContent = 'Preencha todos os campos'; return }
  const btnL = document.getElementById('btnLogin')
  btnL.disabled = true; btnL.textContent = 'Entrando...'
  const { error } = await sb.auth.signInWithPassword({ email, password: senha })
  if (error) {
    document.getElementById('loginErr').textContent = error.message
    btnL.disabled = false; btnL.textContent = 'Entrar'
  }
  // Sucesso: onAuthStateChange dispara emitSessao automaticamente
}

window.doSignup = async function() {
  const nome  = document.getElementById('sNome').value.trim()
  const email = document.getElementById('sEmail').value.trim()
  const senha = document.getElementById('sSenha').value
  if (!nome || !email || !senha) { document.getElementById('loginErr').textContent = 'Preencha todos os campos'; return }
  if (senha.length < 6) { document.getElementById('loginErr').textContent = 'Senha mínimo 6 caracteres'; return }
  const { error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome } } })
  if (error) { document.getElementById('loginErr').textContent = error.message; return }
  document.getElementById('loginErr').textContent = 'Verifique seu e-mail para confirmar o cadastro.'
}

window.doLogout = async function() {
  if (window.closeUserMenu) window.closeUserMenu()
  try { await sb.auth.signOut() } catch(_) {}
  // Limpa dados do Supabase do localStorage — sem isso próximo login pode travar
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k))
  // App reage via evento
  emitSessao(null)
}

// ── SESSÃO ────────────────────────────────────────────────
sb.auth.onAuthStateChange((event, session) => {
  // TOKEN_REFRESHED: só atualiza silenciosamente, sem recarregar o app
  if (event === 'TOKEN_REFRESHED') {
    window.dispatchEvent(new CustomEvent('fluxa:tokenRefresh', { detail: { session } }))
    return
  }
  emitSessao(session)
})

// getSession captura sessão existente no carregamento
// (onAuthStateChange pode disparar antes do listener estar pronto)
try {
  const { data: { session }, error } = await sb.auth.getSession()
  if (error) throw error
  emitSessao(session)
} catch(e) {
  // Sessão inválida — limpa e mostra login
  try { await sb.auth.signOut() } catch(_) {}
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k))
  emitSessao(null)
}

// ── REFRESH PROATIVO ──────────────────────────────────────
// JWT expira em 1h — renova a cada 45min para nunca desconectar durante o uso
setInterval(async () => {
  const { data, error } = await sb.auth.refreshSession()
  if (error || !data?.session) {
    const { data: sd } = await sb.auth.getSession()
    if (!sd?.session) {
      window.showToast?.('Sessão expirada. Faça login novamente.', 'error')
      setTimeout(() => emitSessao(null), 2000)
    }
  }
}, 45 * 60 * 1000)
