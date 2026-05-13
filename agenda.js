import { state } from './state.js'
import { DIAS, MESES } from './config.js'
import { fmtDt, todayStr, dateStr } from './utils.js'

// ── AGENDA ───────────────────────────────────────────────
window.setAgendaView=function(v,btn){
  state.agendaView=v; state.agendaOffset=0
  document.querySelectorAll('.view-toggle').forEach(b=>b.classList.remove('active'))
  btn.classList.add('active'); renderAgenda()
}
window.navAgenda=function(dir){ state.agendaOffset+=dir; renderAgenda() }

export function renderAgenda(){
  const grid=document.getElementById('agendaGrid')
  const title=document.getElementById('agendaTitle')
  const today=new Date(); today.setHours(0,0,0,0)
  if(state.agendaView==='semana'){
    const mon=new Date(today)
    mon.setDate(today.getDate()-((today.getDay()+6)%7)+state.agendaOffset*7)
    const days=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d})
    title.textContent=fmtDate(days[0])+' – '+fmtDate(days[6])
    grid.innerHTML='<div class="week-grid">'+days.map(d=>renderDayCol(d,today)).join('')+'</div>'
  } else {
    const base=new Date(today.getFullYear(),today.getMonth()+state.agendaOffset,1)
    title.textContent=MESES[base.getMonth()]+' '+base.getFullYear()
    const firstDay=(base.getDay()+6)%7
    const daysInMonth=new Date(base.getFullYear(),base.getMonth()+1,0).getDate()
    let cells=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=>'<div style="font-size:10px;color:var(--text3);text-align:center;padding:4px 0">'+d+'</div>').join('')
    for(let i=0;i<firstDay;i++) cells+='<div></div>'
    for(let d=1;d<=daysInMonth;d++){
      cells+=renderMonthDay(new Date(base.getFullYear(),base.getMonth(),d),today)
    }
    grid.innerHTML='<div class="month-grid">'+cells+'</div>'
  }
}

function fmtDate(d){ return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) }

function getTasksForDay(date){
  const ds=dateStr(date)
  return state.tasks.filter(t=>t.data_inicio&&dateStr(new Date(t.data_inicio))===ds)
}

function renderDayCol(date,today){
  const isToday=dateStr(date)===dateStr(today)
  const dayTasks=getTasksForDay(date)
  const totalMin=dayTasks.reduce((s,t)=>s+(t.tempo_estimado_min||60),0)
  const pct=Math.round(totalMin/CAP_MIN*100)
  const loadCls=pct>100?'over':pct>75?'warn':''
  const chips=dayTasks.map(t=>{
    const conflict=isColliding(t)?' chip-conflict':''
    const mine=t.responsavel_id===currentUser?.id?' chip-mine':''
    return '<div class="agenda-chip'+conflict+mine+'" onclick="openEditModal(\''+t.id+'\')" title="'+t.titulo+'">'+
      (t.data_inicio?new Date(t.data_inicio).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' ':'')+t.titulo+'</div>'
  }).join('')
  return '<div class="day-col'+(isToday?' today':'')+'">'+
    '<div class="day-header">'+
      '<div><div class="day-name">'+DIAS[date.getDay()]+'</div><div class="day-num">'+date.getDate()+'</div></div>'+
      '<div class="day-load '+loadCls+'">'+minsToH(totalMin)+'</div>'+
    '</div>'+
    '<div class="day-body">'+chips+'</div>'+
  '</div>'
}

function renderMonthDay(date,today){
  const isToday=dateStr(date)===dateStr(today)
  const dayTasks=getTasksForDay(date)
  const chips=dayTasks.slice(0,2).map(t=>'<div class="month-chip">'+t.titulo+'</div>').join('')
  const more=dayTasks.length>2?'<div class="month-chip">+'+(dayTasks.length-2)+' mais</div>':''
  return '<div class="month-day'+(isToday?' today':'')+'">'+
    '<div class="month-day-num">'+date.getDate()+'</div>'+chips+more+'</div>'
}