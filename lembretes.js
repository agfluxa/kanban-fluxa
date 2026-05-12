import { state } from './state.js'
import { REMINDER_MS } from './config.js'
import { fmtDt } from './utils.js'

// ── LEMBRETE ─────────────────────────────────────────────
function buildReminderItems(){
  const now=new Date(),items=[]
  state.tasks.filter(t=>t.prazo&&new Date(t.prazo)<now&&t.esteira!=='bloqueada').forEach(t=>{
    const svc=SERVICOS[t.servico]||SERVICOS.outro
    items.push({type:'overdue',title:t.titulo,sub:(t.cliente||'—')+' · '+svc.label+' · Venceu '+fmtDt(t.prazo)})
  })
  state.tasks.filter(t=>t.esteira==='bloqueada').forEach(t=>{
    const hIdle=(now-new Date(t.atualizado_em))/3600000
    if(hIdle>24){
      const svc=SERVICOS[t.servico]||SERVICOS.outro
      items.push({type:'bloq',title:t.titulo,sub:(t.cliente||'—')+' · '+svc.label+' · Bloqueada há '+Math.floor(hIdle)+'h'})
    }
  })
  state.tasks.filter(t=>t.esteira==='programada'&&t.prazo).forEach(t=>{
    const h=(new Date(t.prazo)-now)/3600000
    if(h>=0&&h<3){
      const svc=SERVICOS[t.servico]||SERVICOS.outro
      items.push({type:'overdue',title:t.titulo,sub:(t.cliente||'—')+' · '+svc.label+' · Prazo em '+Math.round(h*60)+'min'})
    }
  })
  return items
}
window.openReminder=function(){
  const items=buildReminderItems()
  document.getElementById('reminderBody').innerHTML=!items.length
    ?'<div class="reminder-empty">✅ Nada pendente!</div>'
    :items.map(i=>'<div class="reminder-item '+i.type+'"><div class="reminder-item-top"><span>'+(i.type==='overdue'?'🔴':'🟡')+'</span><span class="reminder-item-title">'+i.title+'</span></div><div class="reminder-item-sub">'+i.sub+'</div></div>').join('')
  document.getElementById('reminderOverlay').classList.add('open')
}
window.closeReminder=function(){
  document.getElementById('reminderOverlay').classList.remove('open')
  scheduleReminder()
}
function scheduleReminder(){
  clearTimeout(state.reminderTimer)
  state.reminderTimer=setTimeout(()=>{ if(buildReminderItems().length) openReminder() },REMINDER_MS)
  const next=new Date(Date.now()+REMINDER_MS)
  document.getElementById('reminderNext').textContent='Próximo: '+next.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
}