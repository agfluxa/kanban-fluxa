// ── STATE ─────────────────────────────────────────────────
// Estado global do app — importado por quem precisar ler/escrever
// Nunca importar state em auth.js (auth não conhece o app)

export const state = {
  currentUser:    null,
  currentProfile: null,
  tasks:          [],
  members:        [],
  templates:      [],
  dragId:         null,
  agendaView:     'semana',
  agendaOffset:   0,
  rescheduleId:   null,
  rescheduleSelectedDate: null,
  reminderTimer:  null,
}
