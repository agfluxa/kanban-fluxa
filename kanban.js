import { state } from './state.js'
import { SERVICOS, DIAS, CAP_MIN } from './config.js'
import { minsToH, prazoInfo, fmtDt, todayStr, showToast, initials } from './utils.js'
import { sb } from './supabase.js'

// ── CARGA ─────────────────────────────────────────────────
export function renderCarga(){
  const today=todayStr()
  const todayTasks=state.tasks.filter(t=>t.data_inicio&&dateStr(new Date(t.data_inicio))===today)
  const totalMin=todayTasks.reduce((s,t)=>s+(t.tempo_estimado_min||60),0)
  const rawPct=Math.round(totalMin/CAP_MIN*100)
  const pct=Math.min(100,rawPct)
  const fill=document.getElementById('cargaFill')
  fill.style.width=pct+'%'
  fill.className='carga-fill '+(rawPct>100?'over':rawPct>75?'warn':'ok')
  document.getElementById('cargaLabel').textContent='Hoje: '+minsToH(totalMin)+' / 24h'
  document.getElementById('cargaInfo').textContent=rawPct+'% alocado'+(rawPct>100?' ⚠ Sobrecarregado':'')
}

// ── COLLISION ─────────────────────────────────────────────
function getInterval(t){
  if(!t.data_inicio||!t.tempo_estimado_min) return null
  const s=new Date(t.data_inicio)
  return {start:s,end:new Date(s.getTime()+t.tempo_estimado_min*60000)}
}
function hasOverlap(a,b){
  const ia=getInterval(a),ib=getInterval(b)
  if(!ia||!ib) return false
  return ia.start<ib.end&&ib.start<ia.end
}
export function isColliding(t){
  if(!t.data_inicio) return false
  return state.tasks.some(o=>o.id!==t.id&&hasOverlap(t,o))
}
export function checkCollisions(){
  const conflicts=[]
  for(let i=0;i<state.tasks.length;i++){
    for(let j=i+1;j<state.tasks.length;j++){
      if(hasOverlap(state.tasks[i],state.tasks[j])){
        conflicts.push('"'+state.tasks[i].titulo+'" e "'+state.tasks[j].titulo+'" se sobrepõem em '+fmtDt(state.tasks[i].data_inicio))
      }
    }
  }
  const banner=document.getElementById('alertBanner')
  const list=document.getElementById('alertList')
  const pill=document.getElementById('conflictPill')
  if(conflicts.length){
    banner.classList.add('visible')
    list.innerHTML=conflicts.slice(0,3).map(c=>'<span>• '+c+'</span>').join('')
    pill.style.display=''; pill.textContent='⚠ '+conflicts.length+' conflito'+(conflicts.length>1?'s':'')
  } else {
    banner.classList.remove('visible'); pill.style.display='none'
  }
}

// ── RENDER KANBAN ─────────────────────────────────────────
export function renderAll(){
  ;['programada','bloqueada','urgente'].forEach(esteira=>{
    const list=state.tasks.filter(t=>t.esteira===esteira)
    document.getElementById('count-'+esteira).textContent=list.length
    const body=document.getElementById('body-'+esteira)
    if(!list.length){
      const msgs={programada:'Nenhuma tarefa programada',bloqueada:'Nenhuma tarefa bloqueada',urgente:'Tudo tranquilo'}
      body.innerHTML='<div class="empty-col">'+msgs[esteira]+'</div>'; return
    }
    const groups={}
    list.forEach(t=>{
      const k=(t.cliente||'Sem cliente')+'|||'+(t.servico||'outro')
      if(!groups[k]) groups[k]=[]
      groups[k].push(t)
    })
    body.innerHTML=Object.entries(groups).map(([k,gt])=>{
      const [cli,svc]=k.split('|||')
      const s=SERVICOS[svc]||SERVICOS.outro
      return '<div class="group">'+
        '<div class="group-header"><span class="group-client">'+cli+'</span><span class="group-service '+s.cls+'">'+s.label+'</span></div>'+
        '<div class="group-body">'+gt.map(t=>renderCard(t,esteira)).join('')+'</div>'+
      '</div>'
    }).join('')
  })
}

function getMemberName(id){
  const m=state.members.find(m=>m.id===id)
  return m?m.nome:null
}
function getMemberCargo(id){
  const m=state.members.find(m=>m.id===id)
  if(!m?.cargo_id) return null
  return state.cargos.find(c=>c.id===m.cargo_id)?.nome||null
}

function renderCard(t,esteira){
  const p=prazoInfo(t.prazo)
  const prazoHtml=p?'<div class="card-prazo '+p.cls+'">'+p.label+'</div>':''
  const obsHtml=t.obs?'<div class="card-obs">'+t.obs+'</div>':''
  const bloqHtml=t.motivo_bloqueio?'<div class="card-bloq-info">🔒 '+t.motivo_bloqueio+'</div>':''
  const collision=isColliding(t)?' collision':''
  const timeHtml=t.data_inicio?'<div class="card-time'+(isColliding(t)?' conflict':'')+'">🕐 '+fmtDt(t.data_inicio)+(t.tempo_estimado_min?' · '+minsToH(t.tempo_estimado_min):'')+'</div>':''

  // assignee
  let assigneeHtml=''
  if(t.responsavel_id){
    const nome=getMemberName(t.responsavel_id)||'...'
    const cargo=getMemberCargo(t.responsavel_id)
    const isMe=t.responsavel_id===state.currentUser?.id
    assigneeHtml='<div class="card-assignee">'+
      '<div class="assignee-dot'+(isMe?' assignee-mine':'')+'">'+initials(nome)+'</div>'+
      '<div class="assignee-info">'+
        '<span class="assignee-name">'+nome+(isMe?' (você)':'')+'</span>'+
        (cargo?'<span class="assignee-cargo">'+cargo+'</span>':'')+
      '</div>'+
    '</div>'
  }

  // checklist
  let checkHtml='',progressHtml=''
  const etapas=t.etapas_progresso||[]
  if(etapas.length){
    const done=etapas.filter(e=>e.done).length
    const pct=Math.round(done/etapas.length*100)
    progressHtml='<div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="progress-label">'+done+'/'+etapas.length+' etapas · '+pct+'%</div>'
    checkHtml='<div class="checklist">'+etapas.map((e,i)=>
      '<div class="check-item" onclick="toggleEtapa(\''+t.id+'\','+i+')">'+
        '<input type="checkbox" '+(e.done?'checked':'')+' onclick="event.stopPropagation();toggleEtapa(\''+t.id+'\','+i+')">'+
        '<span class="check-item-text'+(e.done?' done':'')+'">'+e.titulo+'</span>'+
      '</div>'
    ).join('')+'</div>'
  }

  let actions=''
  if(esteira==='bloqueada'){
    actions='<button class="action-btn concluir" onclick="actionCard(\''+t.id+'\',\'concluido\')">✅ Concluída</button>'+
            '<button class="action-btn esteira"  onclick="moveCard(\''+t.id+'\',\'programada\')">→ Esteira</button>'
  } else {
    actions='<button class="action-btn concluir" onclick="actionCard(\''+t.id+'\',\'concluido\')">✅ Concluído</button>'+
            '<button class="action-btn depois"   onclick="openReschedule(\''+t.id+'\')">📅 Reagendar</button>'
  }

  return '<div class="card'+collision+'" id="card-'+t.id+'" draggable="true"'+
    ' ondragstart="onDragStart(event,\''+t.id+'\')" ondragend="onDragEnd()">'+
    '<div class="card-top">'+
      '<div class="card-title">'+t.titulo+'</div>'+
      '<button class="card-menu-btn" onclick="toggleMenu(\''+t.id+'\',event)">⋯</button>'+
      '<div class="card-menu" id="menu-'+t.id+'">'+
        '<div class="menu-item" onclick="openEditModal(\''+t.id+'\')">✏️ Editar</div>'+
        '<div class="menu-item" onclick="openReschedule(\''+t.id+'\')">📅 Reagendar</div>'+
        '<div class="menu-item" onclick="moveCard(\''+t.id+'\',\'programada\')">📅 → Programada</div>'+
        '<div class="menu-item" onclick="moveCard(\''+t.id+'\',\'bloqueada\')">🔒 → Bloqueada</div>'+
        '<div class="menu-item" onclick="moveCard(\''+t.id+'\',\'urgente\')">🔥 → Urgente</div>'+
        '<div class="menu-item danger" onclick="deleteTask(\''+t.id+'\')">🗑 Excluir</div>'+
      '</div>'+
    '</div>'+
    assigneeHtml+timeHtml+obsHtml+bloqHtml+prazoHtml+progressHtml+checkHtml+
    '<div class="card-actions">'+actions+'</div>'+
  '</div>'
}

// ── CHECKLIST ─────────────────────────────────────────────
window.toggleEtapa=async function(id,idx){
  const t=state.tasks.find(x=>x.id===id); if(!t) return
  const etapas=JSON.parse(JSON.stringify(t.etapas_progresso||[]))
  etapas[idx].done=!etapas[idx].done
  await sb.from('kanban_tasks').update({etapas_progresso:etapas}).eq('id',id)
  await window._loadAll()
}
