import { state } from './state.js'
import { sb } from './supabase.js'
import { showToast, initials } from './utils.js'

// ── EQUIPE ────────────────────────────────────────────────
function getCargoNome(cargoId) {
  if (!cargoId) return null
  return state.cargos.find(c => c.id === cargoId)?.nome || null
}

export function renderEquipe() {
  const wrap = document.getElementById('view-equipe')?.querySelector('.equipe-wrap')
  if (!wrap) return

  const isAdmin = state.currentProfile?.papel === 'admin'

  const inviteBtn = isAdmin
    ? '<button class="btn-primary" onclick="openInviteModal()">＋ Convidar membro</button>'
    : ''

  const memberCards = state.members.length
    ? state.members.map(m => {
        const taskCount = state.tasks.filter(t => t.responsavel_id === m.id).length
        const cargoNome = getCargoNome(m.cargo_id)

        const cargoEl = isAdmin
          ? '<div class="member-cargo-row">' +
              '<select class="cargo-select" onchange="saveMemberCargo(\'' + m.id + '\',this.value)">' +
                '<option value="">— Sem cargo —</option>' +
                state.cargos.map(c =>
                  '<option value="' + c.id + '"' + (m.cargo_id === c.id ? ' selected' : '') + '>' + c.nome + '</option>'
                ).join('') +
              '</select>' +
            '</div>'
          : (cargoNome ? '<div class="member-cargo">' + cargoNome + '</div>' : '')

        return '<div class="member-card">' +
          '<div class="member-avatar">' + initials(m.nome) + '</div>' +
          '<div class="member-info">' +
            '<div class="member-name">' + m.nome + '</div>' +
            '<div class="member-email">' + m.email + '</div>' +
            '<span class="member-papel papel-' + m.papel + '">' + m.papel + '</span>' +
            cargoEl +
            '<div class="member-tasks">' + taskCount + ' tarefa' + (taskCount !== 1 ? 's' : '') + ' ativa' + (taskCount !== 1 ? 's' : '') + '</div>' +
          '</div>' +
        '</div>'
      }).join('')
    : '<div style="color:var(--text3);font-size:13px">Nenhum membro ainda.</div>'

  const cargosSection = isAdmin ? renderCargosSection() : ''

  wrap.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">' +
      '<div>' +
        '<div style="font-family:var(--font-display);font-weight:700;font-size:15px">Equipe</div>' +
        '<div style="font-size:12px;color:var(--text2);margin-top:3px">Gerencie membros e convites</div>' +
      '</div>' +
      inviteBtn +
    '</div>' +
    cargosSection +
    '<div class="equipe-grid">' + memberCards + '</div>'
}

function renderCargosSection() {
  const cargosHtml = state.cargos.length
    ? state.cargos.map(c =>
        '<div class="cargo-item">' +
          '<span class="cargo-nome">' + c.nome + '</span>' +
          '<button class="cargo-del" onclick="deleteCargo(\'' + c.id + '\')">✕</button>' +
        '</div>'
      ).join('')
    : '<span style="color:var(--text3);font-size:12px">Nenhum cargo criado ainda.</span>'

  return '<div class="cargos-section">' +
    '<div class="cargos-header">Cargos</div>' +
    '<div class="cargos-list">' + cargosHtml + '</div>' +
    '<div class="cargos-new">' +
      '<input type="text" id="novoCargoInput" placeholder="Ex: Social Media, Gestor de Conta...">' +
      '<button class="btn-primary" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="addCargo()">+ Cargo</button>' +
    '</div>' +
  '</div>'
}

window.addCargo = async function() {
  const input = document.getElementById('novoCargoInput')
  const nome = input?.value.trim()
  if (!nome) { showToast('Digite o nome do cargo', 'error'); return }
  const { error } = await sb.from('cargos').insert({ nome })
  if (error) { showToast('Erro: ' + error.message, 'error'); return }
  showToast('✅ Cargo criado!')
  await window._loadAll()
}

window.deleteCargo = async function(id) {
  if (!confirm('Excluir este cargo? Membros com ele ficarão sem cargo.')) return
  const { error } = await sb.from('cargos').delete().eq('id', id)
  if (error) { showToast('Erro: ' + error.message, 'error'); return }
  showToast('Cargo excluído')
  await window._loadAll()
}

window.saveMemberCargo = async function(memberId, cargoId) {
  const { error } = await sb.from('profiles').update({ cargo_id: cargoId || null }).eq('id', memberId)
  if (error) { showToast('Erro: ' + error.message, 'error'); return }
  showToast('✅ Cargo atribuído!')
  await window._loadAll()
}

window.openInviteModal  = function() { document.getElementById('inviteOverlay').classList.add('open') }
window.closeInviteModal = function() { document.getElementById('inviteOverlay').classList.remove('open') }
window.sendInvite = async function() {
  const email = document.getElementById('inviteEmail').value.trim()
  const nome  = document.getElementById('inviteNome').value.trim() || email.split('@')[0]
  if (!email) { showToast('Preencha o e-mail', 'error'); return }

  const senha = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'A1!'
  const { data: signUpData, error: e1 } = await sb.auth.signUp({
    email, password: senha, options: { data: { nome } }
  })
  if (e1 && !e1.message?.includes('already')) {
    showToast('Erro ao criar usuário: ' + e1.message, 'error'); return
  }

  if (signUpData?.user) {
    await sb.from('profiles').upsert({
      id: signUpData.user.id, email, nome, papel: 'membro'
    }, { onConflict: 'id' })
  }

  showToast('✅ Membro convidado! Peça para ele definir a senha via "Esqueci minha senha".')
  window.closeInviteModal(); await window._loadAll()
}
