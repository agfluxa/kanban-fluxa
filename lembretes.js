import { state } from './state.js'
import { REMINDER_MS, SERVICOS } from './config.js'
import { fmtDt } from './utils.js'

const TZ = 'America/Sao_Paulo'

// Intervalos configuráveis — adicione mais entradas para suportar novos alertas
const ALERT_DAYS = [1, 2, 3]

function todaySP() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date())
}

function daysUntilSP(prazo) {
  const todayMs = new Date(todaySP()).getTime()
  const prazoDs = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(prazo))
  return Math.round((new Date(prazoDs).getTime() - todayMs) / 86400000)
}

function fmtPrazoPopup(prazo) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: TZ
  }).format(new Date(prazo))
}

// Retorna lista de tarefas pendentes, cada tarefa contada no máximo 1 vez
function buildBellTasks() {
  const seen = new Set()
  const result = []
  for (const t of state.tasks) {
    if (!t.prazo || seen.has(t.id)) continue
    const d = daysUntilSP(t.prazo)
    if (ALERT_DAYS.includes(d)) {
      seen.add(t.id)
      result.push({ t, d })
    }
  }
  return result.sort((a, b) => a.d - b.d || new Date(a.t.prazo) - new Date(b.t.prazo))
}

// ── BADGE ─────────────────────────────────────────────────
export function updateBellBadge() {
  const badge = document.getElementById('bellBadge')
  if (!badge) return
  const count = buildBellTasks().length
  badge.textContent = count
  badge.style.display = count > 0 ? 'inline-flex' : 'none'
}

// ── POPUP (clique no sininho) ──────────────────────────────
window.openReminder = function() {
  const tasks = buildBellTasks()
  const body  = document.getElementById('reminderBody')
  if (!body) return

  body.innerHTML = !tasks.length
    ? '<div class="reminder-empty">✅ Nenhum prazo próximo nos próximos 3 dias!</div>'
    : tasks.map(({ t, d }) => {
        const dLabel = d === 1 ? 'Amanhã' : 'Em ' + d + ' dias'
        return '<div class="reminder-item">' +
          '<div class="reminder-item-top">' +
            '<span class="bell-days-badge bell-day-' + d + '">' + dLabel + '</span>' +
            '<span class="reminder-item-title">' + t.titulo + '</span>' +
          '</div>' +
          '<div class="reminder-item-sub">' + (t.cliente || '—') + ' · Prazo: ' + fmtPrazoPopup(t.prazo) + '</div>' +
        '</div>'
      }).join('')

  document.getElementById('reminderOverlay').classList.add('open')
}

window.closeReminder = function() {
  document.getElementById('reminderOverlay').classList.remove('open')
  scheduleReminder()
}

// ── AUTO-LEMBRETE (alertas urgentes, disparo automático) ──
function buildUrgentItems() {
  const now = new Date(), items = []
  state.tasks.filter(t => t.prazo && new Date(t.prazo) < now && t.esteira !== 'bloqueada').forEach(t => {
    const svc = SERVICOS[t.servico] || SERVICOS.outro
    items.push({ type: 'overdue', title: t.titulo, sub: (t.cliente || '—') + ' · ' + svc.label + ' · Venceu ' + fmtDt(t.prazo) })
  })
  state.tasks.filter(t => t.esteira === 'bloqueada').forEach(t => {
    const hIdle = (now - new Date(t.atualizado_em)) / 3600000
    if (hIdle > 24) {
      const svc = SERVICOS[t.servico] || SERVICOS.outro
      items.push({ type: 'bloq', title: t.titulo, sub: (t.cliente || '—') + ' · ' + svc.label + ' · Bloqueada há ' + Math.floor(hIdle) + 'h' })
    }
  })
  state.tasks.filter(t => t.esteira === 'programada' && t.prazo).forEach(t => {
    const h = (new Date(t.prazo) - now) / 3600000
    if (h >= 0 && h < 3) {
      const svc = SERVICOS[t.servico] || SERVICOS.outro
      items.push({ type: 'overdue', title: t.titulo, sub: (t.cliente || '—') + ' · ' + svc.label + ' · Prazo em ' + Math.round(h * 60) + 'min' })
    }
  })
  return items
}

export function scheduleReminder() {
  clearTimeout(state.reminderTimer)
  state.reminderTimer = setTimeout(() => {
    if (buildUrgentItems().length) openReminder()
  }, REMINDER_MS)
  const next = new Date(Date.now() + REMINDER_MS)
  const el = document.getElementById('reminderNext')
  if (el) el.textContent = 'Próximo: ' + next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
