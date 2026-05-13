import { state } from './state.js'
import { sb } from './supabase.js'
import { showToast, initials } from './utils.js'

// ── EQUIPE ────────────────────────────────────────────────
export function renderEquipe(){
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
  window.closeInviteModal(); await window._loadAll()
}
