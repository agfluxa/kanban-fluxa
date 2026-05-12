// ── SUPABASE CLIENT ───────────────────────────────────────
// Cliente único — importado por todos os módulos que precisam de DB
// NUNCA instanciar createClient em outro lugar

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { URL_SB, KEY_SB } from './config.js'

export const sb = createClient(URL_SB, KEY_SB)
