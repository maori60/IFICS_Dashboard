<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Bilan' })

type ReportVersion = {
  id: string
  version: number
  content: string
  createdAt: string
  createdByUserId: string | null
}

type Report = {
  id: string
  projectId: string
  intervenorId: string | null
  title: string | null
  sessionDate: string
  studentsCount: number | null
  status: string
  currentVersion: number
  comment: string | null
  refusalReason: string | null
  submittedAt: string | null
  validatedAt: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  project: { id: string; title: string; reference: string | null }
  intervenor: { id: string; firstName: string; lastName: string } | null
  versions: ReportVersion[]
}

const route = useRoute()
const reportId = computed(() => String(route.params.id))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Report>>(() => `/api/reports/${reportId.value}`)

const report = computed(() => data.value?.data ?? null)
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('report:write'))
const canReview = computed(() => permissions.value.includes('*') || permissions.value.includes('report:review'))
const created = computed(() => route.query.created === '1')
const latestVersion = computed(() => report.value?.versions?.[0] ?? null)

const form = reactive({
  title: '',
  studentsCount: '',
  comment: '',
  content: '',
})
const refusalReason = ref('')
const saving = ref(false)
const submitting = ref(false)
const reviewing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

watch(report, (value) => {
  if (!value) return
  form.title = value.title || ''
  form.studentsCount = value.studentsCount === null ? '' : String(value.studentsCount)
  form.comment = value.comment || ''
  form.content = value.versions?.[0]?.content || ''
  refusalReason.value = value.refusalReason || ''
}, { immediate: true })

function statusLabel(status: string) {
  return ({ NOT_STARTED: 'À démarrer', IN_PROGRESS: 'En cours', SUBMITTED: 'Soumis', VALIDATED: 'Validé', REFUSED: 'Refusé' } as Record<string, string>)[status] || status
}

function fmt(value: string | null) {
  return value ? new Date(value).toLocaleString('fr-FR') : '—'
}

async function save() {
  if (!canWrite.value || saving.value || report.value?.status === 'VALIDATED') return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/reports/${reportId.value}/save`, {
      method: 'POST',
      body: {
        title: form.title,
        studentsCount: form.studentsCount,
        comment: form.comment,
        content: form.content,
      },
    })
    await refresh()
    successMessage.value = 'Une nouvelle version du bilan a été enregistrée.'
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Le bilan n’a pas pu être enregistré.')
  }
  finally {
    saving.value = false
  }
}

async function submitReport() {
  if (!canWrite.value || submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/reports/${reportId.value}/submit`, { method: 'POST' })
    await refresh()
    successMessage.value = 'Le bilan a été soumis pour validation.'
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Le bilan n’a pas pu être soumis.')
  }
  finally {
    submitting.value = false
  }
}

async function review(status: 'VALIDATED' | 'REFUSED') {
  if (!canReview.value || reviewing.value) return
  reviewing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/reports/${reportId.value}/review`, {
      method: 'POST',
      body: { status, refusalReason: status === 'REFUSED' ? refusalReason.value : undefined },
    })
    await refresh()
    successMessage.value = status === 'VALIDATED' ? 'Le bilan a été validé.' : 'Le bilan a été refusé.'
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'La décision n’a pas pu être enregistrée.')
  }
  finally {
    reviewing.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ report?.title || 'Bilan' }}</h1>
        <p v-if="report">{{ report.project.reference ? `${report.project.reference} — ` : '' }}{{ report.project.title }}</p>
      </div>
      <div class="actions">
        <a v-if="report" class="btn btn-secondary" :href="`/api/reports/${report.id}/pdf`" target="_blank" rel="noopener">PDF</a>
        <NuxtLink class="btn btn-secondary" to="/dashboard/reports">Retour aux bilans</NuxtLink>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom: 18px">
      Bilan créé. Rédigez son contenu puis enregistrez une première version.
    </div>
    <div v-if="errorMessage" class="alert alert-error" style="margin-bottom: 18px">{{ errorMessage }}</div>
    <div v-if="successMessage" class="alert alert-success" style="margin-bottom: 18px">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">Impossible de charger ce bilan.</div>

    <template v-else-if="report">
      <section class="card card-pad" style="margin-bottom: 18px">
        <div class="actions" style="justify-content: space-between; align-items: flex-start">
          <div>
            <span class="badge">{{ statusLabel(report.status) }}</span>
            <span class="badge badge-muted" style="margin-left: 8px">v{{ report.currentVersion }}</span>
          </div>
          <div class="muted">Séance : {{ new Date(report.sessionDate).toLocaleDateString('fr-FR') }}</div>
        </div>
        <p><strong>Intervenant :</strong> {{ report.intervenor ? `${report.intervenor.firstName} ${report.intervenor.lastName}` : 'Bilan projet' }}</p>
        <p><strong>Soumis :</strong> {{ fmt(report.submittedAt) }} · <strong>Validé :</strong> {{ fmt(report.validatedAt) }}</p>
        <div v-if="report.refusalReason" class="alert alert-error">Motif du refus : {{ report.refusalReason }}</div>
      </section>

      <form class="card card-pad" style="margin-bottom: 18px" @submit.prevent="save">
        <h2>Rédaction</h2>
        <div class="form-grid">
          <div class="field">
            <label for="report-title">Titre</label>
            <input id="report-title" v-model="form.title" class="input" maxlength="255" :disabled="report.status === 'VALIDATED'">
          </div>
          <div class="field">
            <label for="report-students">Participants</label>
            <input id="report-students" v-model="form.studentsCount" class="input" type="number" min="0" step="1" :disabled="report.status === 'VALIDATED'">
          </div>
          <div class="field field-full">
            <label for="report-content">Contenu du bilan *</label>
            <textarea id="report-content" v-model="form.content" class="textarea" rows="12" :disabled="report.status === 'VALIDATED'" placeholder="Déroulé, objectifs, observations, résultats, difficultés et suites à donner." />
          </div>
          <div class="field field-full">
            <label for="report-comment">Commentaire</label>
            <textarea id="report-comment" v-model="form.comment" class="textarea" rows="4" :disabled="report.status === 'VALIDATED'" placeholder="Commentaire complémentaire ou interne." />
          </div>
        </div>
        <div v-if="canWrite && report.status !== 'VALIDATED'" class="actions" style="margin-top: 18px">
          <button class="btn btn-primary" type="submit" :disabled="saving || !form.content.trim()">{{ saving ? 'Enregistrement…' : 'Enregistrer une version' }}</button>
          <button v-if="report.currentVersion >= 1 && report.status !== 'SUBMITTED'" class="btn btn-secondary" type="button" :disabled="submitting" @click="submitReport">{{ submitting ? 'Soumission…' : 'Soumettre pour validation' }}</button>
        </div>
      </form>

      <section v-if="canReview && report.status === 'SUBMITTED'" class="card card-pad" style="margin-bottom: 18px">
        <h2>Validation IFICS</h2>
        <div class="field">
          <label for="refusal-reason">Motif en cas de refus</label>
          <textarea id="refusal-reason" v-model="refusalReason" class="textarea" rows="3" placeholder="Obligatoire uniquement pour un refus." />
        </div>
        <div class="actions" style="margin-top: 18px">
          <button class="btn btn-primary" type="button" :disabled="reviewing" @click="review('VALIDATED')">Valider le bilan</button>
          <button class="btn btn-secondary" type="button" :disabled="reviewing || !refusalReason.trim()" @click="review('REFUSED')">Refuser</button>
        </div>
      </section>

      <section class="card card-pad">
        <h2>Historique des versions</h2>
        <div v-if="!report.versions.length" class="empty-state">Aucune version enregistrée.</div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>Version</th><th>Date</th><th>Aperçu</th></tr></thead>
            <tbody>
              <tr v-for="version in report.versions" :key="version.id">
                <td>v{{ version.version }}</td>
                <td>{{ fmt(version.createdAt) }}</td>
                <td>{{ version.content.slice(0, 160) }}{{ version.content.length > 160 ? '…' : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="latestVersion" class="muted" style="margin-bottom: 0">Dernière version : v{{ latestVersion.version }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
h2 { margin-top: 0; }
</style>
