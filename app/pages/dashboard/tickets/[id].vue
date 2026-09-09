<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Ticket support' })

type TicketComment = {
  id: string
  authorUserId: string | null
  body: string
  internal: boolean
  createdAt: string
  author: { id: string; firstName: string; lastName: string; email: string } | null
}

type TicketProgress = {
  progressPercent: number
  nextAction: string | null
  resolutionSummary: string | null
  updatedByUserId: string | null
  updatedAt: string
}

type Ticket = {
  id: string
  number: string
  category: string
  priority: string
  status: string
  subject: string
  description: string
  requesterUserId: string | null
  requesterEmail: string | null
  projectId: string | null
  assigneeUserId: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
  comments: TicketComment[]
  progress: TicketProgress
}

type Assignee = { id: string; firstName: string; lastName: string; email: string; role: { code: string; name: string } }

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Ticket>>(() => `/api/tickets/${id.value}`)
const ticket = computed(() => data.value?.data ?? null)
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('ticket:write'))
const canManage = computed(() => permissions.value.includes('*') || permissions.value.includes('ticket:manage'))
const { data: assigneesData } = await useFetch<ApiSuccess<Assignee[]>>('/api/tickets/assignees', { immediate: canManage.value })
const assignees = computed(() => assigneesData.value?.data ?? [])

const comment = ref('')
const internal = ref(false)
const posting = ref(false)
const managing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const manageForm = reactive({
  status: '',
  priority: '',
  assigneeUserId: '',
  progressPercent: 0,
  nextAction: '',
  resolutionSummary: '',
})

watch(ticket, (value) => {
  if (!value) return
  manageForm.status = value.status
  manageForm.priority = value.priority
  manageForm.assigneeUserId = value.assigneeUserId || ''
  manageForm.progressPercent = value.progress.progressPercent
  manageForm.nextAction = value.progress.nextAction || ''
  manageForm.resolutionSummary = value.progress.resolutionSummary || ''
}, { immediate: true })

watch(() => manageForm.status, (status) => {
  if (status === 'RESOLVED' || status === 'CLOSED') manageForm.progressPercent = 100
})

const fmt = (value: string | null) => value ? new Date(value).toLocaleString('fr-FR') : '—'

const statusSteps = [
  { value: 'NEW', label: 'Nouveau' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'WAITING_REQUESTER', label: 'En attente' },
  { value: 'RESOLVED', label: 'Résolu' },
  { value: 'CLOSED', label: 'Fermé' },
]

function statusLabel(value: string) {
  return statusSteps.find(step => step.value === value)?.label || value
}

function priorityLabel(value: string) {
  return ({ LOW: 'Basse', NORMAL: 'Normale', HIGH: 'Haute', URGENT: 'Urgente' } as Record<string, string>)[value] || value
}

function categoryLabel(value: string) {
  return ({ ADMIN: 'Administratif', BILLING: 'Facturation', CONTRACT: 'Contrat', PROJECT: 'Projet / mission', PLATFORM: 'Plateforme', DOCUMENT: 'Document', IT: 'IT', HR: 'RH', SECURITY: 'Sécurité', OTHER: 'Autre' } as Record<string, string>)[value] || value
}

async function addComment() {
  if (!canWrite.value || posting.value || !comment.value.trim()) return
  posting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/tickets/${id.value}/comment`, {
      method: 'POST',
      body: { body: comment.value, internal: internal.value },
    })
    comment.value = ''
    internal.value = false
    await refresh()
    successMessage.value = 'Commentaire ajouté.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Le commentaire n’a pas pu être ajouté.')
  }
  finally {
    posting.value = false
  }
}

async function manage() {
  if (!canManage.value || managing.value) return
  managing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/tickets/${id.value}/manage`, {
      method: 'POST',
      body: {
        status: manageForm.status,
        priority: manageForm.priority,
        assigneeUserId: manageForm.assigneeUserId || null,
        progressPercent: manageForm.progressPercent,
        nextAction: manageForm.nextAction,
        resolutionSummary: manageForm.resolutionSummary,
      },
    })
    await refresh()
    successMessage.value = 'Ticket et progression mis à jour.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Le ticket n’a pas pu être mis à jour.')
  }
  finally {
    managing.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>{{ ticket?.number || 'Ticket' }}</h1><p>{{ ticket?.subject || 'Support IFICS' }}</p></div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/tickets">Retour aux tickets</NuxtLink>
    </div>

    <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>
    <div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">Impossible de charger ce ticket.</div>

    <template v-else-if="ticket">
      <section class="card card-pad ticket-summary">
        <div class="actions">
          <span class="badge">{{ statusLabel(ticket.status) }}</span>
          <span class="badge" :class="ticket.priority === 'URGENT' ? 'badge-danger' : ticket.priority === 'HIGH' ? 'badge-warning' : ''">{{ priorityLabel(ticket.priority) }}</span>
          <span class="badge badge-muted">{{ categoryLabel(ticket.category) }}</span>
        </div>
        <h2>{{ ticket.subject }}</h2>
        <p style="white-space:pre-wrap">{{ ticket.description }}</p>

        <div class="progress-header">
          <strong>Progression</strong>
          <strong>{{ ticket.progress.progressPercent }} %</strong>
        </div>
        <div class="progress-track" role="progressbar" :aria-valuenow="ticket.progress.progressPercent" aria-valuemin="0" aria-valuemax="100" aria-label="Progression du ticket">
          <span :style="{ width: `${ticket.progress.progressPercent}%` }" />
        </div>
        <div class="status-steps">
          <div v-for="step in statusSteps" :key="step.value" class="status-step" :class="{ active: step.value === ticket.status }">{{ step.label }}</div>
        </div>

        <div v-if="ticket.progress.nextAction" class="info-box"><strong>Prochaine action</strong><p>{{ ticket.progress.nextAction }}</p></div>
        <div v-if="ticket.progress.resolutionSummary" class="info-box resolution"><strong>Résolution</strong><p>{{ ticket.progress.resolutionSummary }}</p></div>
        <p class="muted">Créé le {{ fmt(ticket.createdAt) }} · Dernière mise à jour {{ fmt(ticket.updatedAt) }}<span v-if="ticket.resolvedAt"> · Résolu le {{ fmt(ticket.resolvedAt) }}</span><span v-if="ticket.closedAt"> · Fermé le {{ fmt(ticket.closedAt) }}</span></p>
      </section>

      <section v-if="canManage" class="card card-pad section-gap">
        <h2>Gestion du ticket</h2>
        <div class="form-grid">
          <div class="field">
            <label for="ticket-status">Statut</label>
            <select id="ticket-status" v-model="manageForm.status" class="select">
              <option value="NEW">Nouveau</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="WAITING_REQUESTER">En attente du demandeur</option>
              <option value="RESOLVED">Résolu</option>
              <option value="CLOSED">Fermé</option>
            </select>
          </div>
          <div class="field">
            <label for="ticket-priority">Priorité</label>
            <select id="ticket-priority" v-model="manageForm.priority" class="select">
              <option value="LOW">Basse</option>
              <option value="NORMAL">Normale</option>
              <option value="HIGH">Haute</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>
          <div class="field field-full">
            <label for="ticket-assignee">Assigné à</label>
            <select id="ticket-assignee" v-model="manageForm.assigneeUserId" class="select">
              <option value="">Non assigné</option>
              <option v-for="user in assignees" :key="user.id" :value="user.id">{{ user.firstName }} {{ user.lastName }} — {{ user.role.name }}</option>
            </select>
          </div>
          <div class="field field-full">
            <div class="progress-header"><label for="ticket-progress">Progression</label><strong>{{ manageForm.progressPercent }} %</strong></div>
            <input id="ticket-progress" v-model.number="manageForm.progressPercent" class="progress-range" type="range" min="0" max="100" step="5" :disabled="manageForm.status === 'RESOLVED' || manageForm.status === 'CLOSED'">
            <span class="help">Le passage à Résolu ou Fermé fixe automatiquement la progression à 100 %.</span>
          </div>
          <div class="field field-full">
            <label for="ticket-next-action">Prochaine action</label>
            <textarea id="ticket-next-action" v-model="manageForm.nextAction" class="textarea" rows="3" maxlength="5000" placeholder="Ex. Attente du document signé, relance prévue vendredi…" />
          </div>
          <div class="field field-full">
            <label for="ticket-resolution">Résumé de résolution</label>
            <textarea id="ticket-resolution" v-model="manageForm.resolutionSummary" class="textarea" rows="4" maxlength="10000" placeholder="Décrire la solution appliquée et les vérifications effectuées." />
          </div>
        </div>
        <button class="btn btn-primary" type="button" :disabled="managing" @click="manage">{{ managing ? 'Enregistrement…' : 'Enregistrer la gestion' }}</button>
      </section>

      <section class="card card-pad section-gap">
        <h2>Conversation</h2>
        <div v-if="!ticket.comments.length" class="empty-state">Aucun commentaire.</div>
        <div v-else class="conversation-list">
          <article v-for="item in ticket.comments" :key="item.id" class="comment-card">
            <div class="comment-head">
              <div>
                <strong>{{ item.author ? `${item.author.firstName} ${item.author.lastName}` : 'Système / utilisateur externe' }}</strong>
                <small v-if="item.author" class="muted">{{ item.author.email }}</small>
              </div>
              <div class="actions"><span v-if="item.internal" class="badge badge-warning">Interne</span><small class="muted">{{ fmt(item.createdAt) }}</small></div>
            </div>
            <p style="white-space:pre-wrap;margin-bottom:0">{{ item.body }}</p>
          </article>
        </div>
      </section>

      <form v-if="canWrite" class="card card-pad section-gap" @submit.prevent="addComment">
        <h2>Ajouter un commentaire</h2>
        <div class="field"><label for="ticket-comment">Message *</label><textarea id="ticket-comment" v-model="comment" class="textarea" rows="5" required maxlength="20000" /></div>
        <label v-if="canManage" class="internal-toggle"><input v-model="internal" type="checkbox"> Commentaire interne (invisible au demandeur externe)</label>
        <div class="actions" style="margin-top:18px"><button class="btn btn-primary" type="submit" :disabled="posting || !comment.trim()">{{ posting ? 'Envoi…' : 'Ajouter le commentaire' }}</button></div>
      </form>
    </template>
  </div>
</template>

<style scoped>
h2{margin-top:0}.ticket-summary{margin-bottom:18px}.section-gap{margin-bottom:18px}.progress-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 8px}.progress-header label{margin:0}.progress-track{height:12px;border-radius:999px;background:#e4ebe6;overflow:hidden}.progress-track span{display:block;height:100%;background:var(--ifics-green-700);border-radius:inherit;transition:width .2s ease}.progress-range{width:100%;accent-color:var(--ifics-green-800)}.status-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}.status-step{font-size:.78rem;text-align:center;padding:7px;border-radius:999px;background:#f0f3f1;color:var(--ifics-muted);font-weight:700}.status-step.active{background:#dceee3;color:#164d35}.info-box{margin-top:16px;padding:14px;border-radius:12px;background:#f5f7f5}.info-box p{margin:5px 0 0;white-space:pre-wrap}.info-box.resolution{background:#eef8f1}.conversation-list{display:grid;gap:12px}.comment-card{padding:16px;border:1px solid var(--ifics-border);border-radius:14px;background:#fff}.comment-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.comment-head>div:first-child{display:flex;flex-direction:column}.internal-toggle{display:flex;gap:8px;align-items:center;margin-top:12px}@media(max-width:700px){.status-steps{grid-template-columns:1fr}.comment-head{flex-direction:column}}
</style>