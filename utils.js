// ── UTILS ─────────────────────────────────────────────────
// Funções puras — sem dependência de state, supabase ou auth
// Pode ser importado por qualquer módulo

import { SERVICOS, ZAPI_URL, ZAPI_ACTIVE } from './config.js'

export function setStatus(ok) {
  const dot = document.getElementById('statusDot')
  const lbl = document.getElementById('statusLbl')
  if (!dot || !lbl) return
  dot.className = 'status-dot ' + (ok ? 'ok' : 'err')
  lbl.textContent = ok ? 'Conectado' : 'Sem conexão'
}

export function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.className = 'toast show ' + type
  setTimeout(() => t.classList.remove('show'), 3000)
}

export function fmtDt(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
}

export function todayStr() { return new Date().toISOString().slice(0, 10) }
export function dateStr(d) { return d.toISOString().slice(0, 10) }

export function minsToH(m) {
  const h = Math.floor(m / 60), min = m % 60
  return h > 0 ? (min > 0 ? h + 'h' + min + 'm' : h + 'h') : min + 'min'
}

export function prazoInfo(prazo) {
  if (!prazo) return { label: '', cls: '' }
  const diff = Math.ceil((new Date(prazo) - Date.now()) / 86400000)
  if (diff < 0)  return { label: 'Atrasado ' + Math.abs(diff) + 'd', cls: 'prazo-late' }
  if (diff === 0) return { label: 'Hoje',    cls: 'prazo-today' }
  if (diff <= 2)  return { label: diff + 'd', cls: 'prazo-soon' }
  return { label: diff + 'd', cls: 'prazo-ok' }
}

export function initials(nome) {
  return nome ? nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'
}

export async function sendWhatsApp(telefone, mensagem) {
  if (!telefone || !ZAPI_ACTIVE) return
  try {
    await fetch(ZAPI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: telefone, message: mensagem })
    })
  } catch (e) { console.warn('ZAPI erro:', e) }
}
