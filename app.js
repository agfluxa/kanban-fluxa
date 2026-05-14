// ── APP ───────────────────────────────────────────────────
// Orquestra os módulos do app
// Escuta eventos do auth e inicializa tudo após login

import { sb } from './supabase.js'
import { state } from './state.js'
import { showToast, setStatus, initials } from './utils.js'
import { renderAll, renderCarga, checkCollisions } from './kanban.js'
import { renderAgenda } from './agenda.js'
import { renderTemplates, populateTplSelector, populateResponsavelSelector } from './templates.js'
import { renderEquipe } from './equipe.js'
import { scheduleReminder } from './lembretes.js'

// ── SESSÃO ────────────────────────────────────────────────
window.addEventListener('fluxa:sessao', async (e) => {
  const session = e.detail.session
  if (session) {
    state.currentUser = session.user
    await loadProfile()
    document.getElementById('loginWrap').style.display = 'none'
    document.getElementById('appWrap').style.display = 'block'
    // Resetar botão de login se estava travado
    const btnL = document.getElementById('btnLogin')
    if (btnL) { btnL.disabled = false; btnL.textContent = 'Entrar' }
    await loadAll()
  } else {
    state.currentUser = null
    state.currentProfile = null
    document.getElementById('loginWrap').style.display = 'flex'
    document.getElementById('appWrap').style.display = 'none'
  }
})

window.addEventListener('fluxa:tokenRefresh', (e) => {
  if (e.detail.session) state.currentUser = e.detail.session.user
})

// ── LOAD ──────────────────────────────────────────────────
export async function loadAll() {
  try {
    const [{ data: tasks, error: e1 }, { data: members }, { data: templates }] = await Promise.all([
      sb.from('kanban_tasks').select('*').eq('status', 'ativo').order('data_inicio', { ascending: true, nullsFirst: false }),
      sb.from('profiles').select('*'),
      sb.from('task_templates').select('*').order('nome'),
    ])
    if (e1) { setStatus(false); return }
    state.tasks     = tasks     || []
    state.members   = members   || []
    state.templates = templates || []
    setStatus(true)
    renderAll()
    renderCarga()
    checkCollisions()
    renderAgenda()
    renderTemplates()
    renderEquipe()
    populateTplSelector()
    populateResponsavelSelector()
    scheduleReminder()
  } catch(e) {
    setStatus(false)
    console.error('loadAll erro:', e)
  }
}

async function loadProfile() {
  try {
    const { data } = await sb.from('profiles').select('*').eq('id', state.currentUser.id).single()
    state.currentProfile = data
    if (!data) return
    const ini = initials(data.nome)
    document.getElementById('navAvatar').textContent = ini
    document.getElementById('navName').textContent   = data.nome.split(' ')[0]
    document.getElementById('ddName').textContent    = data.nome
    document.getElementById('ddEmail').textContent   = data.email
    if (data.papel === 'admin') {
      document.getElementById('navBadge').style.display  = ''
      document.getElementById('equipeTab').style.display = ''
      document.getElementById('btnMassa').style.display  = ''
    }
  } catch(e) { console.error('loadProfile erro:', e) }
}

// ── USER MENU ─────────────────────────────────────────────
window.toggleUserMenu = function() {
  document.getElementById('userDropdown').classList.toggle('open')
}
window.closeUserMenu = function() {
  document.getElementById('userDropdown').classList.remove('open')
}
window.openPerfilModal = function() {
  const p = state.currentProfile
  if (!p) return
  document.getElementById('pNome').value     = p.nome     || ''
  document.getElementById('pTelefone').value = p.telefone || ''
  document.getElementById('perfilOverlay').classList.add('open')
}
window.closePerfilModal = function() {
  document.getElementById('perfilOverlay').classList.remove('open')
}
window.savePerfil = async function() {
  const nome     = document.getElementById('pNome').value.trim()
  const telefone = document.getElementById('pTelefone').value.trim()
  if (!nome) { showToast('Preencha o nome', 'error'); return }
  const { error } = await sb.from('profiles').update({ nome, telefone }).eq('id', state.currentUser.id)
  if (error) { showToast('Erro: ' + error.message, 'error'); return }
  showToast('✅ Perfil salvo!')
  window.closePerfilModal()
  await loadProfile()
}

// ── VIEWS ─────────────────────────────────────────────────
window.showView = function(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none')
  document.getElementById('view-' + id).style.display = 'block'
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
}

// ── REALTIME ──────────────────────────────────────────────
let reloadTimer = null
function debouncedLoad() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(loadAll, 1500)
}
sb.channel('kanban')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_tasks' }, debouncedLoad)
  .subscribe((status) => setStatus(status === 'SUBSCRIBED'))

// Expor loadAll globalmente para outros módulos usarem
window._loadAll = loadAll
