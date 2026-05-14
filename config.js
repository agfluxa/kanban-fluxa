// ── CONFIG ────────────────────────────────────────────────
// Único arquivo que contém credenciais — trocar aqui reflete em todo o app
export const URL_SB = 'https://iruyblqjkcokonfuiwsu.supabase.co'
export const KEY_SB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydXlibHFqa2Nva29uZnVpd3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Njg2NTAsImV4cCI6MjA5MjU0NDY1MH0.SHxQn5Iukk41JsaObkrkNxv5LLFsk_zAc4mCD_IS-zQ'

// ZAPI — WhatsApp
export const ZAPI_ACTIVE = true
export const ZAPI_ID     = '3F2C4E3E3A2300AD2DF5EAAA29470FA9'
export const ZAPI_TOKEN  = '9875C28ABE4BDF0EEBC993DA' // TODO: trocar antes do deploy final
export const ZAPI_URL    = 'https://api.z-api.io/instances/'+ZAPI_ID+'/token/'+ZAPI_TOKEN+'/send-text'

// App
export const REMINDER_MS = 30 * 60 * 1000
export const CAP_MIN     = 24 * 60

export const SERVICOS = {
  trafego:     { label: 'Tráfego Pago',       cls: 'svc-trafego'     },
  social:      { label: 'Social Media',        cls: 'svc-social'      },
  identidade:  { label: 'Identidade Visual',   cls: 'svc-identidade'  },
  site:        { label: 'Site / Landing Page', cls: 'svc-site'        },
  video:       { label: 'Edição de Vídeo',     cls: 'svc-video'       },
  consultoria: { label: 'Consultoria',         cls: 'svc-consultoria' },
  outro:       { label: 'Outro',               cls: 'svc-outro'       },
}

export const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
export const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
