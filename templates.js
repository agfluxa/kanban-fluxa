import { state } from './state.js'
import { SERVICOS } from './config.js'
import { sb } from './supabase.js'
import { showToast, minsToH } from './utils.js'

// ── TEMPLATES ─────────────────────────────────────────────
export function renderTemplates(){
  const grid=document.getElementById('tplGrid')
  if(!state.templates.length){ grid.innerHTML='<div style="color:var(--text3);font-size:13px;padding:20px">Nenhum template criado ainda.</div>'; return }
  grid.innerHTML=state.templates.map(tpl=>{
    const svc=SERVICOS[tpl.servico]||SERVICOS.outro
    return '<div class="tpl-card">'+
      '<div class="tpl-card-top"><div class="tpl-name">'+tpl.nome+'</div><button class="tpl-delete" onclick="deleteTpl(\''+tpl.id+'\')">🗑</button></div>'+
      '<div class="tpl-meta"><span class="group-service '+svc.cls+'">'+svc.label+'</span><span class="tpl-time">⏱ '+minsToH(tpl.tempo_estimado_min)+'</span></div>'+
      '<div class="tpl-steps">'+(tpl.etapas||[]).map((e,i)=>'<div class="tpl-step"><span class="tpl-step-num">'+(i+1)+'</span><span>'+e.titulo+'</span></div>').join('')+'</div>'+
      '<button class="tpl-btn" onclick="openModalFromTpl(\''+tpl.id+'\')">Usar este template</button>'+
    '</div>'
  }).join('')
}

export function populateTplSelector(){
  const sel=document.getElementById('fTemplate')
  sel.innerHTML='<option value="">— Nenhum —</option>'+
    state.templates.map(t=>'<option value="'+t.id+'">'+t.nome+'</option>').join('')
}

export function populateResponsavelSelector(){
  const sel=document.getElementById('fResponsavel')
  sel.innerHTML='<option value="">— Eu mesmo —</option>'+
    state.members.filter(m=>m.id!==state.currentUser?.id).map(m=>{
      const cargo=state.cargos.find(c=>c.id===m.cargo_id)
      return '<option value="'+m.id+'">'+m.nome+(cargo?' · '+cargo.nome:'')+'</option>'
    }).join('')
}

window.applyTemplate=function(){
  const id=document.getElementById('fTemplate').value; if(!id) return
  const tpl=state.templates.find(t=>t.id===id); if(!tpl) return
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
  showToast('Template salvo!'); closeTplModal(); await window._loadAll()
}
window.deleteTpl=async function(id){
  if(!confirm('Excluir este template?')) return
  await sb.from('task_templates').delete().eq('id',id)
  showToast('Template excluído'); await window._loadAll()
}
