let openMenuId = null
import { state } from './state.js'
import { SERVICOS, DIAS, CAP_MIN } from './config.js'
import { minsToH, prazoInfo, fmtDt, todayStr, showToast } from './utils.js'
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
function isColliding(t){
  if(!t.data_inicio) return false
  return state.tasks.some(o=>o.id!==t.id&&hasOverlap(t,o))
}
export function checkCollisions(){
  const conflicts=[]
  for(let i=0;i<state.tasks.length;i++){
    for(let j=i+1;j<state.tasks.length;j++){
      if(hasOverlap(tasks[i],tasks[j])){
        conflicts.push('"'+tasks[i].titulo+'" e "'+tasks[j].titulo+'" se sobrepõem em '+fmtDt(tasks[i].data_inicio))
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
    const isMe=t.responsavel_id===currentUser?.id
    assigneeHtml='<div class="card-assignee"><div class="assignee-dot'+(isMe?' assignee-mine':'')+'">'+initials(nome)+'</div><span class="assignee-name">'+nome+(isMe?' (você)':'')+'</span></div>'
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
  await loadAll()
}

// ── AGENDA ───────────────────────────────────────────────
window.setAgendaView=function(v,btn){
  agendaView=v; agendaOffset=0
  document.querySelectorAll('.view-toggle').forEach(b=>b.classList.remove('active'))
  btn.classList.add('active'); renderAgenda()
}
window.navAgenda=function(dir){ agendaOffset+=dir; renderAgenda() }

function renderAgenda(){
  const grid=document.getElementById('agendaGrid')
  const title=document.getElementById('agendaTitle')
  const today=new Date(); today.setHours(0,0,0,0)
  if(agendaView==='semana'){
    const mon=new Date(today)
    mon.setDate(today.getDate()-((today.getDay()+6)%7)+agendaOffset*7)
    const days=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d})
    title.textContent=fmtDate(days[0])+' – '+fmtDate(days[6])
    grid.innerHTML='<div class="week-grid">'+days.map(d=>renderDayCol(d,today)).join('')+'</div>'
  } else {
    const base=new Date(today.getFullYear(),today.getMonth()+agendaOffset,1)
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

// ── TEMPLATES ─────────────────────────────────────────────
function renderTemplates(){
  const grid=document.getElementById('tplGrid')
  if(!templates.length){ grid.innerHTML='<div style="color:var(--text3);font-size:13px;padding:20px">Nenhum template criado ainda.</div>'; return }
  grid.innerHTML=templates.map(tpl=>{
    const svc=SERVICOS[tpl.servico]||SERVICOS.outro
    return '<div class="tpl-card">'+
      '<div class="tpl-card-top"><div class="tpl-name">'+tpl.nome+'</div><button class="tpl-delete" onclick="deleteTpl(\''+tpl.id+'\')">🗑</button></div>'+
      '<div class="tpl-meta"><span class="group-service '+svc.cls+'">'+svc.label+'</span><span class="tpl-time">⏱ '+minsToH(tpl.tempo_estimado_min)+'</span></div>'+
      '<div class="tpl-steps">'+(tpl.etapas||[]).map((e,i)=>'<div class="tpl-step"><span class="tpl-step-num">'+(i+1)+'</span><span>'+e.titulo+'</span></div>').join('')+'</div>'+
      '<button class="tpl-btn" onclick="openModalFromTpl(\''+tpl.id+'\')">Usar este template</button>'+
    '</div>'
  }).join('')
}

function populateTplSelector(){
  const sel=document.getElementById('fTemplate')
  sel.innerHTML='<option value="">— Nenhum —</option>'+
    templates.map(t=>'<option value="'+t.id+'">'+t.nome+'</option>').join('')
}

function populateResponsavelSelector(){
  const sel=document.getElementById('fResponsavel')
  sel.innerHTML='<option value="">— Eu mesmo —</option>'+
    state.members.filter(m=>m.id!==currentUser?.id).map(m=>'<option value="'+m.id+'">'+m.nome+'</option>').join('')
}

window.applyTemplate=function(){
  const id=document.getElementById('fTemplate').value; if(!id) return
  const tpl=templates.find(t=>t.id===id); if(!tpl) return
  document.getElementById('fTitulo').value=tpl.nome
  document.getElementById('fServico').value=tpl.servico
  document.getElementById('fTempo').value=tpl.tempo_estimado_min
  renderEtapasEditor(tpl.etapas||[])
  document.getElementById('checklistEditor').style.display='flex'
}

window.openModalFromTpl=function(tplId){
  showView('kanban',document.querySelector('.tab-btn'))
  openModal()
  document.getElementById('fTemplate').value=tplId
  applyTemplate()
}

// ── EQUIPE ────────────────────────────────────────────────
function renderEquipe(){
  const grid=document.getElementById('equipeGrid')
  if(!state.members.length){ grid.innerHTML='<div style="color:var(--text3);font-size:13px">Nenhum membro ainda.</div>'; return }
  grid.innerHTML=state.members.map(m=>{
    const taskCount=state.tasks.filter(t=>t.responsavel_id===m.id).length
    return '<div class="member-card">'+
      '<div class="member-avatar">'+initials(m.nome)+'</div>'+
      '<div class="member-info">'+
        '<div class="member-name">'+m.nome+'</div>'+
        '<div class="member-email">'+m.email+'</div>'+
        '<span class="member-papel papel-'+m.papel+'">'+m.papel+'</span>'+
        '<div class="member-tasks">'+taskCount+' tarefa'+(taskCount!==1?'s':'')+' ativa'+(taskCount!==1?'s':'')+'</div>'+
      '</div>'+
    '</div>'
  }).join('')
}

window.openInviteModal=function(){ document.getElementById('inviteOverlay').classList.add('open') }
window.closeInviteModal=function(){ document.getElementById('inviteOverlay').classList.remove('open') }
window.sendInvite=async function(){
  const email=document.getElementById('inviteEmail').value.trim()
  const nome=document.getElementById('inviteNome').value.trim()||email.split('@')[0]
  if(!email){ showToast('Preencha o e-mail','error'); return }

  // Cria o usuário via signUp
  const senha=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+'A1!'
  const {data:signUpData, error:e1}=await sb.auth.signUp({
    email, password:senha,
    options:{data:{nome}}
  })
  if(e1&&!e1.message?.includes('already')){
    showToast('Erro ao criar usuário: '+e1.message,'error'); return
  }

  // Insere perfil manualmente (RLS permite insert para autenticados)
  if(signUpData?.user){
    await sb.from('profiles').upsert({
      id: signUpData.user.id,
      email,
      nome,
      papel: 'membro'
    },{onConflict:'id'})
  }

  showToast('✅ Membro convidado! Peça para ele definir a senha via "Esqueci minha senha".')
  closeInviteModal(); await loadAll()
}

// ── TEMPLATE MODAL ────────────────────────────────────────
window.openTplModal=function(){
  document.getElementById('tplEditId').value=''
  document.getElementById('tNome').value=''
  document.getElementById('tServico').value='trafego'
  document.getElementById('tTempo').value=60
  document.getElementById('tplEtapasEditor').innerHTML=''
  document.getElementById('tplModalTitle').textContent='Novo template'
  document.getElementById('tplOverlay').classList.add('open')
}
window.closeTplModal=function(){ document.getElementById('tplOverlay').classList.remove('open') }
window.addTplEtapa=function(){
  const ed=document.getElementById('tplEtapasEditor')
  const div=document.createElement('div'); div.className='etapa-row'
  div.innerHTML='<input type="text" placeholder="Ex: Definir campanha" style="flex:1"><button class="etapa-rm" onclick="this.closest(\'.etapa-row\').remove()">✕</button>'
  ed.appendChild(div)
}
window.saveTpl=async function(){
  const nome=document.getElementById('tNome').value.trim()
  if(!nome){ showToast('Preencha o nome','error'); return }
  const etapas=[]
  document.getElementById('tplEtapasEditor').querySelectorAll('.etapa-row').forEach((r,i)=>{
    const v=r.querySelector('input')?.value.trim()
    if(v) etapas.push({id:i+1,titulo:v,descricao:''})
  })
  const payload={nome,servico:document.getElementById('tServico').value,tempo_estimado_min:parseInt(document.getElementById('tTempo').value)||60,etapas}
  const id=document.getElementById('tplEditId').value
  let err
  if(id){ ({error:err}=await sb.from('task_templates').update(payload).eq('id',id)) }
  else   { ({error:err}=await sb.from('task_templates').insert(payload)) }
  if(err){ showToast('Erro: '+err.message,'error'); return }
  showToast('Template salvo!'); closeTplModal(); await loadAll()
}
window.deleteTpl=async function(id){
  if(!confirm('Excluir este template?')) return
  await sb.from('task_templates').delete().eq('id',id)
  showToast('Template excluído'); await loadAll()
}