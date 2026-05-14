import { state } from './state.js'
import { SERVICOS, DIAS, CAP_MIN } from './config.js'
import { sb } from './supabase.js'
import { showToast, fmtDt, sendWhatsApp, minsToH, dateStr, todayStr } from './utils.js'

let openMenuId = null

// ── TASK MODAL ────────────────────────────────────────────
window.updateResponsavelCargo=function(id){
  const el=document.getElementById('fResponsavelCargo')
  if(!el) return
  if(!id){ el.textContent=''; return }
  const m=state.members.find(m=>m.id===id)
  const cargo=m?.cargo_id?state.cargos.find(c=>c.id===m.cargo_id)?.nome:null
  el.textContent=cargo||''
}
window.openModal=function(){
  document.getElementById('editId').value=''
  document.getElementById('fTitulo').value=''
  document.getElementById('fCliente').value=''
  document.getElementById('fServico').value='trafego'
  document.getElementById('fEsteira').value='programada'
  document.getElementById('fTempo').value=60
  document.getElementById('fInicio').value=''
  document.getElementById('fPrazo').value=''
  document.getElementById('fBloq').value=''
  document.getElementById('fObs').value=''
  document.getElementById('fResponsavel').value=''
  document.getElementById('fTemplate').value=''
  document.getElementById('etapasEditor').innerHTML=''
  document.getElementById('checklistEditor').style.display='none'
  document.getElementById('tplSelector').style.display='block'
  document.getElementById('modalTitle').textContent='Nova tarefa'
  updateResponsavelCargo('')
  toggleBloqField()
  document.getElementById('modalOverlay').classList.add('open')
}
window.openEditModal=function(id){
  closeMenu()
  const t=state.tasks.find(x=>x.id===id); if(!t) return
  document.getElementById('editId').value=t.id
  document.getElementById('fTitulo').value=t.titulo||''
  document.getElementById('fCliente').value=t.cliente||''
  document.getElementById('fServico').value=t.servico||'outro'
  document.getElementById('fEsteira').value=t.esteira
  document.getElementById('fTempo').value=t.tempo_estimado_min||60
  document.getElementById('fInicio').value=t.data_inicio?t.data_inicio.slice(0,16):''
  document.getElementById('fPrazo').value=t.prazo?t.prazo.slice(0,16):''
  document.getElementById('fBloq').value=t.motivo_bloqueio||''
  document.getElementById('fObs').value=t.obs||''
  document.getElementById('fResponsavel').value=t.responsavel_id||''
  updateResponsavelCargo(t.responsavel_id||'')
  document.getElementById('tplSelector').style.display='none'
  document.getElementById('modalTitle').textContent='Editar tarefa'
  const etapas=t.etapas_progresso||[]
  if(etapas.length){ renderEtapasEditor(etapas); document.getElementById('checklistEditor').style.display='flex' }
  else { document.getElementById('etapasEditor').innerHTML=''; document.getElementById('checklistEditor').style.display='none' }
  toggleBloqField()
  document.getElementById('modalOverlay').classList.add('open')
}
window.closeModal=function(){ document.getElementById('modalOverlay').classList.remove('open') }
window.toggleBloqField=function(){
  document.getElementById('bloqField').style.display=
    document.getElementById('fEsteira').value==='bloqueada'?'flex':'none'
}
function renderEtapasEditor(etapas){
  const ed=document.getElementById('etapasEditor'); ed.innerHTML=''
  etapas.forEach(e=>{
    const div=document.createElement('div'); div.className='etapa-row'
    div.innerHTML='<input type="text" value="'+e.titulo+'" style="flex:1"><button class="etapa-rm" onclick="this.closest(\'.etapa-row\').remove()">✕</button>'
    ed.appendChild(div)
  })
}
window.addEtapaField=function(){
  const ed=document.getElementById('etapasEditor')
  const div=document.createElement('div'); div.className='etapa-row'
  div.innerHTML='<input type="text" placeholder="Nova etapa" style="flex:1"><button class="etapa-rm" onclick="this.closest(\'.etapa-row\').remove()">✕</button>'
  ed.appendChild(div)
  document.getElementById('checklistEditor').style.display='flex'
}
window.saveTask=async function(){
  const titulo=document.getElementById('fTitulo').value.trim()
  const cliente=document.getElementById('fCliente').value.trim()
  if(!titulo){  showToast('Preencha a tarefa','error');  return }
  if(!cliente){ showToast('Preencha o cliente','error'); return }
  const esteira=document.getElementById('fEsteira').value
  const inicioVal=document.getElementById('fInicio').value
  const prazoVal=document.getElementById('fPrazo').value
  const responsavelId=document.getElementById('fResponsavel').value||null
  const id=document.getElementById('editId').value

  const etapaRows=document.getElementById('etapasEditor').querySelectorAll('.etapa-row')
  const etapas=[]
  etapaRows.forEach((r,i)=>{
    const v=r.querySelector('input')?.value.trim()
    if(v) etapas.push({id:i,titulo:v,done:false})
  })
  if(id){
    const orig=state.tasks.find(t=>t.id===id)
    if(orig?.etapas_progresso){
      etapas.forEach(e=>{ const oe=orig.etapas_progresso.find(o=>o.titulo===e.titulo); if(oe) e.done=oe.done })
    }
  }

  const payload={
    titulo,cliente,
    servico:document.getElementById('fServico').value,
    esteira,
    tempo_estimado_min:parseInt(document.getElementById('fTempo').value)||60,
    data_inicio:inicioVal?new Date(inicioVal).toISOString():null,
    prazo:prazoVal?new Date(prazoVal).toISOString():null,
    obs:document.getElementById('fObs').value.trim()||null,
    motivo_bloqueio:esteira==='bloqueada'?document.getElementById('fBloq').value.trim()||null:null,
    etapas_progresso:etapas.length?etapas:null,
    responsavel_id:responsavelId,
    atribuido_por:responsavelId?state.currentUser.id:null,
    status:'ativo',
  }

  let res
  const isNew=!id
  const oldResponsavel=id?state.tasks.find(t=>t.id===id)?.responsavel_id:null

  if(id){ res=await sb.from('kanban_tasks').update(payload).eq('id',id) }
  else   { res=await sb.from('kanban_tasks').insert(payload) }
  if(res.error){ showToast('Erro: '+res.error.message,'error'); return }

  // ZAPI — notifica responsável se mudou ou é novo
  if(responsavelId&&responsavelId!==state.currentUser?.id&&(isNew||responsavelId!==oldResponsavel)){
    const responsavel=state.members.find(m=>m.id===responsavelId)
    if(responsavel?.telefone){
      const svc=SERVICOS[document.getElementById('fServico').value]||SERVICOS.outro
      const prazoTxt=prazoVal?'\n⏰ Prazo: '+fmtDt(new Date(prazoVal).toISOString()):''
      const msg='🔔 *Nova tarefa atribuída a você!*\n\n'+
        '📋 *'+titulo+'*\n'+
        '👤 Cliente: '+cliente+'\n'+
        '🏷 Serviço: '+svc.label+
        prazoTxt+'\n\n'+
        'Atribuída por: '+(state.currentProfile?.nome||'Admin')+'\n'+
        'Acesse o Kanban para ver os detalhes.'
      await sendWhatsApp(responsavel.telefone,msg)
    }
  }

  showToast(id?'✏️ Atualizado!':'✅ Tarefa criada!')
  window.closeModal(); await window._loadAll()
}

// ── REAGENDAR ────────────────────────────────────────────
window.openReschedule=function(id){
  closeMenu(); state.rescheduleId=id; state.rescheduleSelectedDate=null
  const t=state.tasks.find(x=>x.id===id); if(!t) return
  document.getElementById('rescheduleTaskName').textContent='"'+t.titulo+'" — '+minsToH(t.tempo_estimado_min||60)
  const days=document.getElementById('rescheduleDays'); days.innerHTML=''
  const today=new Date(); today.setHours(0,0,0,0)
  for(let i=1;i<=8;i++){
    const d=new Date(today); d.setDate(today.getDate()+i)
    const ds=dateStr(d)
    const totalMin=state.tasks.filter(t=>t.data_inicio&&dateStr(new Date(t.data_inicio))===ds).reduce((s,t)=>s+(t.tempo_estimado_min||60),0)
    const pct=Math.round(totalMin/CAP_MIN*100)
    const loadCls=pct>100?'over':pct>75?'warn':''
    const btn=document.createElement('div'); btn.className='reschedule-day'
    btn.dataset.date=ds
    btn.innerHTML='<div class="reschedule-day-name">'+DIAS[d.getDay()]+'</div>'+
      '<div class="reschedule-day-num">'+d.getDate()+'</div>'+
      '<div class="reschedule-day-load '+loadCls+'">'+minsToH(totalMin)+'</div>'
    btn.onclick=function(){
      document.querySelectorAll('.reschedule-day').forEach(b=>b.classList.remove('selected'))
      btn.classList.add('selected'); state.rescheduleSelectedDate=ds
    }
    days.appendChild(btn)
  }
  document.getElementById('rescheduleTime').value='09:00'
  document.getElementById('rescheduleOverlay').classList.add('open')
}
window.closeReschedule=function(){ document.getElementById('rescheduleOverlay').classList.remove('open') }
window.confirmReschedule=async function(){
  if(!state.rescheduleSelectedDate){ showToast('Escolha um dia','error'); return }
  const time=document.getElementById('rescheduleTime').value||'09:00'
  const iso=new Date(state.rescheduleSelectedDate+'T'+time+':00').toISOString()
  const res=await sb.from('kanban_tasks').update({data_inicio:iso,reagendado_de:todayStr()}).eq('id',state.rescheduleId)
  if(res.error){ showToast('Erro ao reagendar','error'); return }
  showToast('📅 Reagendado!'); closeReschedule(); await window._loadAll()
}

// ── AÇÕES ─────────────────────────────────────────────────
window.moveCard=async function(id,esteira){
  closeMenu()
  const r=await sb.from('kanban_tasks').update({esteira}).eq('id',id)
  if(r.error){ showToast('Erro ao mover','error'); return }
  showToast('Tarefa movida!'); await window._loadAll()
}
window.actionCard=async function(id,status){
  closeMenu()
  // GANCHO CRM: status==='concluido' → futuramente atualiza cliente/pagamento
  const r=await sb.from('kanban_tasks').update({status}).eq('id',id)
  if(r.error){ showToast('Erro','error'); return }
  showToast(status==='concluido'?'✅ Concluído!':'⏭ Reagendado')
  await window._loadAll()
}
window.deleteTask=async function(id){
  closeMenu(); if(!confirm('Excluir esta tarefa?')) return
  await sb.from('kanban_tasks').delete().eq('id',id)
  showToast('Excluída'); await window._loadAll()
}

// ── DRAG ─────────────────────────────────────────────────
window.onDragStart=function(e,id){ state.dragId=id; setTimeout(()=>document.getElementById('card-'+id)?.classList.add('dragging'),0) }
window.onDragEnd=function(){ document.querySelectorAll('.card').forEach(c=>c.classList.remove('dragging')) }
window.onDragOver=function(e,est){ e.preventDefault(); document.getElementById('body-'+est)?.classList.add('drag-over') }
window.onDragLeave=function(){ document.querySelectorAll('.col-body').forEach(b=>b.classList.remove('drag-over')) }
window.onDrop=async function(e,est){
  e.preventDefault(); document.querySelectorAll('.col-body').forEach(b=>b.classList.remove('drag-over'))
  if(!state.dragId) return; await moveCard(state.dragId,est); state.dragId=null
}

// ── MENU ─────────────────────────────────────────────────
window.toggleMenu=function(id,e){
  e.stopPropagation()
  const menu=document.getElementById('menu-'+id)
  if(openMenuId&&openMenuId!==id) closeMenu()
  menu.classList.toggle('open')
  openMenuId=menu.classList.contains('open')?id:null
}
function closeMenu(){
  if(openMenuId){ document.getElementById('menu-'+openMenuId)?.classList.remove('open') }
  openMenuId=null
}
document.addEventListener('click',closeMenu)
