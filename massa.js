import { state } from './state.js'
import { SERVICOS } from './config.js'
import { sb } from './supabase.js'
import { showToast } from './utils.js'

// ── ENTRADA EM MASSA ─────────────────────────────────────
let massaTipoAtual = 'video'

window.openMassaModal = function(){
  // Popular responsáveis
  const sel = document.getElementById('mResponsavel')
  sel.innerHTML = '<option value="">— Nenhum —</option>'
  state.members.forEach(m => {
    const o = document.createElement('option')
    o.value = m.id; o.textContent = m.nome
    sel.appendChild(o)
  })
  // Reset campos
  document.getElementById('mCliente').value = ''
  document.getElementById('mQtd').value = 12
  document.getElementById('mQtdVideo').value = 0
  document.getElementById('mQtdEstatico').value = 0
  document.getElementById('mInicio').value = ''
  document.getElementById('mFim').value = ''
  document.getElementById('mHorario').value = '09:00'
  document.querySelectorAll('.dia-chip').forEach(c => c.classList.remove('sel'))
  massaTipoAtual = 'video'
  document.getElementById('tipoVideo').classList.add('sel')
  document.getElementById('tipoEstatico').classList.remove('sel')
  document.getElementById('tipoMisto').classList.remove('sel')
  document.getElementById('mistoFields').style.display = 'none'
  document.getElementById('simplesQtd').style.display = ''
  document.getElementById('massaPreviewBox').textContent = 'Preencha os campos acima para ver a prévia.'
  document.getElementById('massaOverlay').classList.add('open')
}

window.closeMassaModal = function(){
  document.getElementById('massaOverlay').classList.remove('open')
}

window.toggleTipo = function(tipo){
  massaTipoAtual = tipo
  document.getElementById('tipoVideo').classList.toggle('sel', tipo==='video')
  document.getElementById('tipoEstatico').classList.toggle('sel', tipo==='estatico')
  document.getElementById('tipoMisto').classList.toggle('sel', tipo==='misto')
  document.getElementById('mistoFields').style.display = tipo==='misto' ? 'grid' : 'none'
  document.getElementById('simplesQtd').style.display = tipo==='misto' ? 'none' : ''
  massaPreview()
}

window.toggleDia = function(el){
  el.classList.toggle('sel')
  massaPreview()
}

function calcDatas(){
  const inicioVal = document.getElementById('mInicio').value
  const fimVal    = document.getElementById('mFim').value
  const horario   = document.getElementById('mHorario').value || '09:00'
  const dias      = [...document.querySelectorAll('.dia-chip.sel')].map(c => parseInt(c.dataset.dia))
  if(!inicioVal || !fimVal || dias.length === 0) return []

  const [hh, mm] = horario.split(':').map(Number)
  const datas = []
  const fim   = new Date(fimVal + 'T23:59:59')
  let cur     = new Date(inicioVal + 'T00:00:00')

  while(cur <= fim){
    if(dias.includes(cur.getDay())){
      const d = new Date(cur)
      d.setHours(hh, mm, 0, 0)
      datas.push(new Date(d))
    }
    cur.setDate(cur.getDate() + 1)
  }
  return datas
}

window.massaPreview = function(){
  const box     = document.getElementById('massaPreviewBox')
  const cliente = document.getElementById('mCliente').value.trim()
  const datas   = calcDatas()
  const horario = document.getElementById('mHorario').value || '09:00'

  let qtdVideo    = 0, qtdEstatico = 0
  if(massaTipoAtual === 'video'){
    qtdVideo = parseInt(document.getElementById('mQtd').value) || 0
  } else if(massaTipoAtual === 'estatico'){
    qtdEstatico = parseInt(document.getElementById('mQtd').value) || 0
  } else {
    qtdVideo    = parseInt(document.getElementById('mQtdVideo').value) || 0
    qtdEstatico = parseInt(document.getElementById('mQtdEstatico').value) || 0
  }
  const total = qtdVideo + qtdEstatico

  if(!cliente || datas.length === 0 || total === 0){
    box.textContent = 'Preencha os campos acima para ver a prévia.'
    return
  }

  // Distribuir: primeiro vídeos, depois estáticos
  const itens = []
  for(let i = 0; i < qtdVideo;    i++) itens.push({tipo:'video',    label:'🎬 Vídeo '+(i+1),    esteira:'bloqueada'})
  for(let i = 0; i < qtdEstatico; i++) itens.push({tipo:'estatico', label:'🖼 Estático '+(i+1), esteira:'programada'})

  // Associar datas (cíclico se itens > datas)
  const linhas = itens.map((item, i) => {
    const d = datas[i % datas.length]
    const dtStr = d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})
    return `${item.label} — ${dtStr} ${horario} [${item.esteira}]`
  })

  const aviso = total > datas.length
    ? '\n⚠ ' + total + ' tarefas em ' + datas.length + ' datas — algumas datas vão ter mais de 1 tarefa.'
    : '\n✅ ' + total + ' tarefas em ' + datas.length + ' datas disponíveis.'

  box.textContent = linhas.join('\n') + aviso
}

window.saveMassa = async function(){
  const cliente = document.getElementById('mCliente').value.trim()
  const servico = document.getElementById('mServico').value
  const responsavelId = document.getElementById('mResponsavel').value || null
  const horario = document.getElementById('mHorario').value || '09:00'
  const datas   = calcDatas()

  let qtdVideo = 0, qtdEstatico = 0
  if(massaTipoAtual === 'video'){
    qtdVideo = parseInt(document.getElementById('mQtd').value) || 0
  } else if(massaTipoAtual === 'estatico'){
    qtdEstatico = parseInt(document.getElementById('mQtd').value) || 0
  } else {
    qtdVideo    = parseInt(document.getElementById('mQtdVideo').value) || 0
    qtdEstatico = parseInt(document.getElementById('mQtdEstatico').value) || 0
  }
  const total = qtdVideo + qtdEstatico

  if(!cliente){ showToast('Preencha o cliente','error'); return }
  if(datas.length === 0){ showToast('Escolha data início, fim e pelo menos 1 dia da semana','error'); return }
  if(total === 0){ showToast('Informe a quantidade de tarefas','error'); return }

  const btn = document.getElementById('btnSalvarMassa')
  btn.disabled = true; btn.textContent = 'Criando...'

  const itens = []
  for(let i = 0; i < qtdVideo;    i++) itens.push({tipo:'video',    num:i+1, esteira:'bloqueada',  motivo:'Aguardando gravação'})
  for(let i = 0; i < qtdEstatico; i++) itens.push({tipo:'estatico', num:i+1, esteira:'programada', motivo:null})

  const [hh, mm] = horario.split(':').map(Number)
  const payloads = itens.map((item, i) => {
    const d = new Date(datas[i % datas.length])
    d.setHours(hh, mm, 0, 0)
    // Prazo de aprovação = 7 dias antes da postagem
    const aprovacao = new Date(d)
    aprovacao.setDate(aprovacao.getDate() - 7)
    const tipoLabel = item.tipo === 'video' ? 'Vídeo' : 'Estático'
    return {
      titulo: tipoLabel + ' ' + item.num + ' — ' + cliente,
      cliente,
      servico,
      esteira: item.esteira,
      motivo_bloqueio: item.motivo,
      data_inicio: aprovacao.toISOString(), // início = 7 dias antes (prazo de aprovação)
      prazo: d.toISOString(),               // prazo = data de postagem
      tempo_estimado_min: item.tipo === 'video' ? 120 : 60,
      responsavel_id: responsavelId,
      atribuido_por: responsavelId ? state.currentUser.id : null,
      status: 'ativo',
    }
  })

  const { error } = await sb.from('kanban_tasks').insert(payloads)
  if(error){
    showToast('Erro: ' + error.message, 'error')
    btn.disabled = false; btn.textContent = 'Criar tarefas'
    return
  }

  showToast('✅ ' + total + ' tarefas criadas para ' + cliente + '!')
  closeMassaModal()
  await window._loadAll()
}