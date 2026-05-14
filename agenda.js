import { state } from './state.js'
import { DIAS, MESES, CAP_MIN, SERVICOS } from './config.js'
import { dateStrSP, minsToH } from './utils.js'
import { isColliding } from './kanban.js'

const TZ = 'America/Sao_Paulo'
let agendaZoom = 1  // 0=2cols, 1=3cols, 2=4cols (visão anual)

// ── HELPERS ──────────────────────────────────────────────
function todaySP() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date())
}

function timeLblSP(iso) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso))
}

function fmtShort(ds) {
  const [,m,d] = ds.split('-')
  return d + '/' + m
}

function getTasksForDay(ds) {
  return state.tasks.filter(t => t.data_inicio && dateStrSP(t.data_inicio) === ds)
}

function dsFromYMD(y, m, d) {
  return y + '-' + String(m + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0')
}

// ── VIEW CONTROLS ─────────────────────────────────────────
window.setAgendaView = function(v, btn) {
  state.agendaView = v
  state.agendaOffset = 0
  document.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  const zoomEl = document.getElementById('agendaZoomBtns')
  if (zoomEl) zoomEl.style.display = v === 'anual' ? 'flex' : 'none'
  renderAgenda()
}
window.navAgenda  = function(dir){ state.agendaOffset += dir; renderAgenda() }
window.goToToday  = function()   { state.agendaOffset = 0;   renderAgenda() }
window.zoomAgenda = function(dir){
  agendaZoom = Math.max(0, Math.min(2, agendaZoom + dir))
  renderAgenda()
}

// ── RENDER ENTRY ──────────────────────────────────────────
export function renderAgenda() {
  window.renderAgenda = renderAgenda  // expõe como global
  const grid  = document.getElementById('agendaGrid')
  const title = document.getElementById('agendaTitle')
  if (!grid || !title) return

  const todayDs = todaySP()

  if      (state.agendaView === 'semana') renderSemana(grid, title, todayDs)
  else if (state.agendaView === 'anual')  renderAnual(grid, title, todayDs)
  else                                    renderMensal(grid, title, todayDs)
}

// ── SEMANAL ───────────────────────────────────────────────
function renderSemana(grid, title, todayDs) {
  const [ty, tm, td] = todayDs.split('-').map(Number)
  const base = new Date(ty, tm - 1, td)   // meia-noite local
  const dow  = base.getDay()              // 0=Dom
  const toMon = dow === 0 ? -6 : 1 - dow

  const monday = new Date(base)
  monday.setDate(base.getDate() + toMon + state.agendaOffset * 7)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const ds0 = dsFromYMD(days[0].getFullYear(), days[0].getMonth(), days[0].getDate())
  const ds6 = dsFromYMD(days[6].getFullYear(), days[6].getMonth(), days[6].getDate())
  title.textContent = fmtShort(ds0) + ' – ' + fmtShort(ds6)

  grid.innerHTML = '<div class="week-grid">' + days.map(d => {
    const ds = dsFromYMD(d.getFullYear(), d.getMonth(), d.getDate())
    const isToday   = ds === todayDs
    const dayTasks  = getTasksForDay(ds)
    const totalMin  = dayTasks.reduce((s, t) => s + (t.tempo_estimado_min || 60), 0)
    const pct       = Math.round(totalMin / CAP_MIN * 100)
    const loadCls   = pct > 100 ? 'over' : pct > 75 ? 'warn' : ''

    const chips = dayTasks.map(t => {
      const conflict = isColliding(t) ? ' chip-conflict' : ''
      const mine     = t.responsavel_id === state.currentUser?.id ? ' chip-mine' : ''
      const svc      = SERVICOS[t.servico] || SERVICOS.outro
      const timePfx  = t.data_inicio ? timeLblSP(t.data_inicio) + ' ' : ''
      return '<div class="agenda-chip ' + svc.cls + conflict + mine + '"' +
        ' onclick="openEditModal(\'' + t.id + '\')" title="' + t.titulo + '">' +
        timePfx + t.titulo +
        '</div>'
    }).join('')

    return '<div class="day-col' + (isToday ? ' today' : '') + '">' +
      '<div class="day-header">' +
        '<div><div class="day-name">' + DIAS[d.getDay()] + '</div>' +
        '<div class="day-num">' + d.getDate() + '</div></div>' +
        '<div class="day-load ' + loadCls + '">' + minsToH(totalMin) + '</div>' +
      '</div>' +
      '<div class="day-body">' + chips + '</div>' +
      '</div>'
  }).join('') + '</div>'
}

// ── MENSAL ────────────────────────────────────────────────
function renderMensal(grid, title, todayDs) {
  const [ty, tm] = todayDs.split('-').map(Number)
  const rawMonth  = tm - 1 + state.agendaOffset   // 0-indexed
  const ref        = new Date(ty, rawMonth, 1)
  const y          = ref.getFullYear()
  const m          = ref.getMonth()                // 0-indexed

  title.textContent = MESES[m] + ' ' + y

  const firstDow    = new Date(y, m, 1).getDay()
  const leadOffset  = firstDow === 0 ? 6 : firstDow - 1  // Monday=0
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  // header row
  let cells = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
    .map(n => '<div class="month-head-cell">' + n + '</div>').join('')

  // leading empty cells
  for (let i = 0; i < leadOffset; i++) cells += '<div></div>'

  // days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const ds      = dsFromYMD(y, m, d)
    const isToday = ds === todayDs
    const tasks   = getTasksForDay(ds)
    const chips   = tasks.slice(0, 3).map(t => {
      const svc = SERVICOS[t.servico] || SERVICOS.outro
      return '<div class="month-chip ' + svc.cls + '" onclick="openEditModal(\'' + t.id + '\')" title="' + t.titulo + '">' + t.titulo + '</div>'
    }).join('')
    const more = tasks.length > 3 ? '<div class="month-chip">+' + (tasks.length - 3) + ' mais</div>' : ''
    cells += '<div class="month-day' + (isToday ? ' today' : '') + '">' +
      '<div class="month-day-num">' + d + '</div>' + chips + more + '</div>'
  }

  // first week of next month (muted)
  const cellsSoFar = leadOffset + daysInMonth
  const remainder  = cellsSoFar % 7
  const nextCount  = remainder === 0 ? 0 : 7 - remainder
  const nextY      = m === 11 ? y + 1 : y
  const nextM      = m === 11 ? 0     : m + 1
  for (let d = 1; d <= nextCount; d++) {
    const ds    = dsFromYMD(nextY, nextM, d)
    const tasks = getTasksForDay(ds)
    const chips = tasks.slice(0, 2).map(t =>
      '<div class="month-chip muted" onclick="openEditModal(\'' + t.id + '\')" title="' + t.titulo + '">' + t.titulo + '</div>'
    ).join('')
    cells += '<div class="month-day muted"><div class="month-day-num">' + d + '</div>' + chips + '</div>'
  }

  grid.innerHTML = '<div class="month-grid">' + cells + '</div>'
}

// ── ANUAL ─────────────────────────────────────────────────
function renderAnual(grid, title, todayDs) {
  const [ty] = todayDs.split('-').map(Number)
  const y    = ty + state.agendaOffset
  title.textContent = String(y)

  const colsMap = [2, 3, 4]
  const cols    = colsMap[agendaZoom]

  const months = Array.from({ length: 12 }, (_, m) => {
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const firstDow    = new Date(y, m, 1).getDay()
    const leadOffset  = firstDow === 0 ? 6 : firstDow - 1

    let cells = ['S','T','Q','Q','S','S','D']
      .map(n => '<div class="year-head">' + n + '</div>').join('')
    for (let i = 0; i < leadOffset; i++) cells += '<div></div>'

    for (let d = 1; d <= daysInMonth; d++) {
      const ds      = dsFromYMD(y, m, d)
      const isToday = ds === todayDs
      const cnt     = getTasksForDay(ds).length
      cells += '<div class="year-day' +
        (isToday ? ' today' : '') +
        (cnt > 0  ? ' has-tasks' : '') + '"' +
        (cnt > 0  ? ' title="' + cnt + ' tarefa' + (cnt > 1 ? 's' : '') + '"' : '') +
        '>' + d + '</div>'
    }

    return '<div class="year-month">' +
      '<div class="year-month-name">' + MESES[m] + '</div>' +
      '<div class="year-day-grid">' + cells + '</div>' +
      '</div>'
  }).join('')

  grid.innerHTML = '<div class="year-grid cols-' + cols + '">' + months + '</div>'
}
