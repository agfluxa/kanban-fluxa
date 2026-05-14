# CLAUDE.md — Kanban Fluxa

Projeto: kanban de gestão de tarefas para agência digital.
Stack: HTML + CSS + JS vanilla (ES modules), backend Supabase (PostgreSQL + Auth + Realtime).
Sem build step — arquivos servidos diretamente via navegador ou servidor estático.

---

## Estrutura de arquivos

```
kanban_final/
├── index.html      HTML completo: login, nav, views (kanban/agenda/templates/equipe), todos os modais
├── style.css       CSS completo: dark theme, variáveis CSS, todos os componentes
├── config.js       Credenciais (Supabase, ZAPI), constantes, SERVICOS, DIAS, MESES
├── state.js        Estado global compartilhado entre módulos
├── supabase.js     Cliente Supabase singleton — nunca instanciar createClient em outro lugar
├── utils.js        Funções puras sem side effects (showToast, fmtDt, dateStrSP, minsToH, etc.)
├── auth.js         Login, logout, sessão, refresh de token — MÓDULO CONGELADO
├── app.js          Orquestrador: loadAll, loadProfile, showView, realtime subscription
├── kanban.js       Board kanban: renderAll, renderCarga, checkCollisions, renderCard, toggleEtapa
├── tarefas.js      Modal de tarefa (novo/editar), reagendar, mover, excluir, drag & drop, menu
├── templates.js    CRUD de templates, seletor de template no modal, populate de selects
├── equipe.js       View de equipe (admin), convite de membro via Supabase Auth
├── lembretes.js    Sistema de lembretes automáticos (prazo vencido, bloqueada > 24h, prazo < 3h)
├── massa.js        Entrada em massa de tarefas (vídeo/estático/misto) — visível só para admin
└── agenda.js       View de agenda: modos Semanal, Mensal e Anual, fuso America/Sao_Paulo
```

---

## O que cada arquivo faz

### index.html
Contém toda a estrutura HTML estática. Os modais (tarefa, template, convite, perfil, massa, reagendar, lembrete) ficam aqui. A view `#view-equipe` tem apenas `<div class="equipe-wrap"></div>` — o conteúdo é gerado por `equipe.js`.

### config.js
Única fonte de verdade para:
- Credenciais Supabase (`URL_SB`, `KEY_SB`)
- Credenciais ZAPI WhatsApp (`ZAPI_ID`, `ZAPI_TOKEN`, `ZAPI_URL`, `ZAPI_ACTIVE`)
- `REMINDER_MS` (30 min), `CAP_MIN` (capacidade diária em minutos = 24h)
- `SERVICOS` — mapa completo de serviços com label e classe CSS
- `DIAS` e `MESES` em português

### state.js
Objeto singleton exportado. Campos:
```js
{ currentUser, currentProfile, tasks, members, templates,
  dragId, agendaView, agendaOffset, rescheduleId, rescheduleSelectedDate, reminderTimer }
```
Nunca importar `state` em `auth.js`.

### auth.js
Responsável exclusivamente por autenticação. Comunica com o resto do app via `CustomEvent 'fluxa:sessao'` (sem acoplamento direto). Faz refresh proativo do JWT a cada 45 min. Não importar `state`, `kanban`, `tarefas` ou qualquer módulo de app aqui.

### app.js
- `loadAll()`: busca `kanban_tasks`, `profiles`, `task_templates` em paralelo, popula state, aciona todos os renders
- `loadProfile()`: carrega perfil do usuário logado, exibe aba Equipe e botão Massa só para admin
- `showView(id, btn)`: troca de view com `display:'block'`
- Realtime: escuta `kanban_tasks` com debounce de 1500ms
- Expõe `window._loadAll = loadAll` para chamadas cross-módulo

### kanban.js
Exports: `renderAll`, `renderCarga`, `checkCollisions`, `isColliding`
- Agrupa cards por cliente+serviço dentro de cada esteira
- `renderCarga`: barra de capacidade diária (ok/warn/over)
- `checkCollisions`: detecta sobreposições de horário entre tarefas
- `isColliding`: usado também por `agenda.js`

### tarefas.js
Globals: `openModal`, `openEditModal`, `closeModal`, `saveTask`, `openReschedule`, `confirmReschedule`, `moveCard`, `actionCard`, `deleteTask`, `onDragStart/End/Over/Leave/Drop`, `toggleMenu`
- `saveTask`: envia notificação ZAPI via WhatsApp ao responsável se atribuição mudou

### templates.js
Exports: `renderTemplates`, `populateTplSelector`, `populateResponsavelSelector`
Globals: `openTplModal`, `closeTplModal`, `addTplEtapa`, `saveTpl`, `deleteTpl`, `applyTemplate`, `openModalFromTpl`

### equipe.js
Export: `renderEquipe`
- `renderEquipe()` gera o header + lista de membros. Botão "+ Convidar membro" aparece **somente se** `state.currentProfile?.papel === 'admin'`
- `sendInvite`: cria usuário via `sb.auth.signUp` com senha aleatória; membro define senha via "Esqueci minha senha"

### lembretes.js
Export: `scheduleReminder`
Três tipos de alerta: tarefas com prazo vencido, bloqueadas há mais de 24h, tarefas com prazo em menos de 3h.

### massa.js
Globals: `openMassaModal`, `closeMassaModal`, `toggleTipo`, `toggleDia`, `massaPreview`, `saveMassa`
- Tipos: vídeo (nasce Bloqueada), estático (nasce Programada), misto
- Distribui tarefas ciclicamente nas datas selecionadas
- Data de início = 7 dias antes da data de postagem (prazo de aprovação)

### agenda.js
Globals: `setAgendaView`, `navAgenda`, `goToToday`, `zoomAgenda`, `renderAgenda`
Export: `renderAgenda`
Três modos:
- **Semanal**: 7 colunas, chips coloridas por serviço, horário em fuso SP
- **Mensal**: grid 7 colunas com cabeçalho de dias, primeira semana do mês seguinte em tom suave (opacity 35%)
- **Anual**: 12 meses em grid, zoom − / + controla 2/3/4 colunas, dias com tarefas destacados em negrito

---

## Schema do Supabase

### kanban_tasks
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| titulo | text | obrigatório |
| descricao | text | |
| cliente | text | obrigatório |
| servico | text | um dos 7 valores de SERVICOS |
| esteira | text | `programada` / `bloqueada` / `urgente` |
| status | text | `ativo` / `concluido` — loadAll filtra por `ativo` |
| prazo | timestamptz | |
| data_inicio | timestamptz | |
| tempo_estimado_min | int | default 60 |
| responsavel_id | uuid FK → profiles.id | |
| atribuido_por | uuid FK → profiles.id | |
| template_id | uuid FK → task_templates.id | |
| etapas_progresso | jsonb | array de `{id, titulo, done}` |
| reagendado_de | date | data original antes de reagendar |
| motivo_bloqueio | text | usado quando esteira = bloqueada |
| tags | text[] | |
| obs | text | |
| workspace_id | uuid | |
| criado_em | timestamptz | |
| atualizado_em | timestamptz | |

### task_templates
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| nome | text |
| servico | text |
| tempo_estimado_min | int |
| etapas | jsonb — array de `{id, titulo, descricao}` |
| criado_em | timestamptz |

### profiles
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK = auth.users.id | |
| nome | text | |
| email | text | |
| telefone | text | formato: 55 + DDD + número (ZAPI) |
| papel | text | `admin` / `membro` |
| avatar_url | text | |
| criado_em | timestamptz | |

---

## Serviços disponíveis (SERVICOS em config.js)

| Chave | Label | Classe CSS |
|---|---|---|
| `trafego` | Tráfego Pago | `svc-trafego` |
| `social` | Social Media | `svc-social` |
| `identidade` | Identidade Visual | `svc-identidade` |
| `site` | Site / Landing Page | `svc-site` |
| `video` | Edição de Vídeo | `svc-video` |
| `consultoria` | Consultoria | `svc-consultoria` |
| `outro` | Outro | `svc-outro` |

Hierarquia de dados: **Cliente → Serviço → Tarefa → Descrição → Obs**

---

## Bugs corrigidos (histórico da sessão)

| Bug | Onde | Correção |
|---|---|---|
| `tasks[i]`/`tasks[j]` em `checkCollisions` | kanban.js | → `state.tasks[i]`/`state.tasks[j]` |
| `currentUser?.id` sem `state.` em `renderCard` | kanban.js | → `state.currentUser?.id` |
| `initials()` usada sem import | kanban.js | adicionado ao import de utils.js |
| Funções duplicadas (renderTemplates, renderEquipe, renderAgenda, sendInvite, etc.) | kanban.js | removidas — vivem nos módulos próprios |
| `minsToH` usada sem import | templates.js | adicionado ao import de utils.js |
| `SERVICOS` usada sem import | lembretes.js | adicionado ao import de config.js |
| `tasks.filter` (variável solta) | equipe.js | → `state.tasks.filter` |
| `CAP_MIN`, `minsToH`, `isColliding` sem import | agenda.js | imports corrigidos |
| `currentUser?.id` sem `state.` | agenda.js, templates.js | → `state.currentUser?.id` |
| Null check ausente em `btnL` | auth.js | adicionado `if (btnL)` antes de desabilitar |
| `agendaView: 'week'` vs check `=== 'semana'` | state.js | → `'semana'` |
| `showView` com `display:''` (CSS `.view{display:none}` re-aplicava) | app.js | → `display:'block'` |
| Timezone UTC em `dateStr()` causava datas erradas à noite | utils.js | nova `dateStrSP()` com `America/Sao_Paulo` |
| `agendaOffset=0;renderAgenda()` em onclick HTML (não são globals de módulo) | index.html | → `goToToday()` |
| 4 serviços ausentes em SERVICOS (identidade, site, video, consultoria) | config.js | adicionados todos os 7 |
| Botão "+ Convidar membro" estático sem guard de admin | equipe.js + index.html | botão gerado por `renderEquipe()`, visível só para admin |
| `getTasksForDay` usada em `openReschedule` via import cruzado | tarefas.js | substituída por `state.tasks.filter` inline |

---

## Regras do projeto

### Arquitetura
- **Sem build**: arquivos JS são ES modules carregados diretamente pelo browser via `<script type="module">`
- **Estado único**: sempre ler/escrever via `state` de `state.js` — nunca variáveis globais soltas
- **Cliente Supabase único**: instanciado só em `supabase.js`, importado por quem precisar
- **Chamadas cross-módulo**: usar `window._loadAll()` para recarregar dados de módulos que não importam `app.js`
- **Auth desacoplada**: `auth.js` nunca importa módulos de app — usa CustomEvent `'fluxa:sessao'`

### Banco de dados
- `loadAll` sempre filtra `status = 'ativo'` — concluídas saem do board
- Após `ALTER TABLE` no Supabase, fazer reload do schema cache: Dashboard → Settings → API → Reload
- `etapas_progresso` é JSONB: array de `{id, titulo, done}` — preservar `done` ao editar etapas

### Permissões por papel
- **admin**: vê aba Equipe, botão "+ Convidar membro", botão "⚡ Entrada em massa"
- **membro**: vê apenas Kanban, Agenda, Templates

### Notificações WhatsApp (ZAPI)
- Disparada em `saveTask` quando `responsavel_id` muda ou é atribuído pela primeira vez
- Requer `profiles.telefone` no formato `55DDDNUMERO` (ex: `5544999998888`)
- Controlado por `ZAPI_ACTIVE` em `config.js`

### Agenda e datas
- Toda comparação de data de tarefa usa `dateStrSP()` (fuso `America/Sao_Paulo`)
- Nunca usar `toISOString().slice(0,10)` para comparar datas visíveis ao usuário
- Zoom anual: estado local em `agenda.js` (variável `agendaZoom`), não precisa estar em `state`

### CSS
- Tema dark com variáveis em `:root` — nunca hardcodar cores fora de `config.js`/`:root`
- Classes de serviço (`svc-*`) usadas em cards kanban, chips da agenda e chips mensais
- `.view{display:none}` + `showView` usa `display:'block'` para alternar views
