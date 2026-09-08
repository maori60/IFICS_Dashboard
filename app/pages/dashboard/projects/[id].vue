<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Fiche projet' })

type ClientOption = { id: string; name: string; status: string }
type ProjectDetail = {
  id: string
  reference: string | null
  title: string
  description: string | null
  status: string
  classification: string
  startDate: string | null
  endDate: string | null
  plannedBudget: string | null
  actualBudget: string | null
  totalIntervenorCost: string | null
  materialCost: string | null
  printingCost: string | null
  otherCost: string | null
  estimatedNetMargin: string | null
  actualNetMargin: string | null
  totalSessions: number | null
  sessionUnitPrice: string | null
  internalComments: string | null
  projectClients: { id: string; isMainClient: boolean; client: { id: string; name: string; type: string; email: string | null } }[]
  projectIntervenors: { id: string; assignmentStatus: string; intervenor: { id: string; firstName: string; lastName: string; email: string; specialty: string | null } }[]
  documents: { id: string; title: string; type: string; version: number }[]
  reports: { id: string; title: string; status: string }[]
  billingDocuments: { id: string; kind: string; number: string; status: string; total: string; currency: string }[]
}

const route = useRoute()
const projectId = computed(() => String(route.params.id || ''))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<ProjectDetail>>(() => `/api/projects/${projectId.value}`)
const { data: clientsData } = await useFetch<ApiSuccess<ClientOption[]>>('/api/clients')

const permissions = computed(() => session.value?.data.user.permissions ?? [])
const hasPermission = (permission: string) => permissions.value.includes('*') || permissions.value.includes(permission)
const canWrite = computed(() => hasPermission('project:write'))
const canAssign = computed(() => hasPermission('project:assign'))
const project = computed(() => data.value?.data)
const clients = computed(() => (clientsData.value?.data ?? []).filter(item => item.status === 'ACTIVE'))

const form = reactive({
  clientId: '', reference: '', title: '', description: '', status: 'DRAFT', classification: 'INTERNAL',
  startDate: '', endDate: '', plannedBudget: '', actualBudget: '', totalIntervenorCost: '', materialCost: '', printingCost: '', otherCost: '',
  estimatedNetMargin: '', actualNetMargin: '', totalSessions: '', sessionUnitPrice: '', internalComments: '',
})

const hydratedId = ref('')
watch(project, (value) => {
  if (!value || hydratedId.value === value.id) return
  hydratedId.value = value.id
  const mainClient = value.projectClients.find(item => item.isMainClient)?.client || value.projectClients[0]?.client
  Object.assign(form, {
    clientId: mainClient?.id ?? '',
    reference: value.reference ?? '', title: value.title, description: value.description ?? '', status: value.status,
    classification: value.classification || 'INTERNAL', startDate: value.startDate?.slice(0, 10) ?? '', endDate: value.endDate?.slice(0, 10) ?? '',
    plannedBudget: value.plannedBudget ?? '', actualBudget: value.actualBudget ?? '', totalIntervenorCost: value.totalIntervenorCost ?? '',
    materialCost: value.materialCost ?? '', printingCost: value.printingCost ?? '', otherCost: value.otherCost ?? '',
    estimatedNetMargin: value.estimatedNetMargin ?? '', actualNetMargin: value.actualNetMargin ?? '', totalSessions: value.totalSessions?.toString() ?? '',
    sessionUnitPrice: value.sessionUnitPrice ?? '', internalComments: value.internalComments ?? '',
  })
}, { immediate: true })

const saving = ref(false)
const archiving = ref(false)
const removingIntervenorId = ref('')
const successMessage = ref('')
const errorMessage = ref('')

async function save() {
  if (!canWrite.value || saving.value) return
  saving.value = true
  successMessage.value = ''
  errorMessage.value = ''
  try {
    await $fetch(`/api/projects/${projectId.value}`, { method: 'PUT', body: { ...form } })
    await refresh()
    successMessage.value = 'Le projet a été mis à jour.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible de mettre à jour le projet.')
  }
  finally { saving.value = false }
}

async function unlinkIntervenor(intervenorId: string, name: string) {
  if (!canAssign.value || removingIntervenorId.value) return
  if (!confirm(`Retirer ${name} de ce projet ?`)) return
  removingIntervenorId.value = intervenorId
  errorMessage.value = ''
  try {
    await $fetch('/api/projects/unlink-intervenor', { method: 'POST', body: { projectId: projectId.value, intervenorId } })
    await refresh()
    successMessage.value = `${name} a été retiré du projet.`
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Impossible de retirer cet intervenant.') }
  finally { removingIntervenorId.value = '' }
}

async function archiveProject() {
  if (!canWrite.value || archiving.value) return
  if (!confirm('Archiver ce projet ? Il restera dans l’historique mais disparaîtra des projets actifs.')) return
  archiving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/projects/archive', { method: 'POST', body: { id: projectId.value } })
    await navigateTo('/dashboard/projects?archived=1')
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Impossible d’archiver le projet.') }
  finally { archiving.value = false }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <p class="eyebrow">Projet</p>
        <h1>{{ project?.title || 'Fiche projet' }}</h1>
        <p>Corrigez les informations, le client principal, les budgets et le suivi opérationnel.</p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/projects">Retour aux projets</NuxtLink>
    </div>

    <div v-if="error" class="alert alert-error">Impossible de charger ce projet.</div>
    <template v-else-if="project">
      <div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div>
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>

      <form class="card card-pad" @submit.prevent="save">
        <div class="form-grid">
          <div class="field field-full"><label for="edit-project-client">Client principal *</label><select id="edit-project-client" v-model="form.clientId" class="select" :disabled="!canWrite" required><option value="" disabled>Sélectionner</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option></select></div>
          <div class="field"><label for="edit-project-reference">Référence</label><input id="edit-project-reference" v-model="form.reference" class="input" maxlength="50" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-title">Titre *</label><input id="edit-project-title" v-model="form.title" class="input" maxlength="255" :disabled="!canWrite" required></div>
          <div class="field"><label for="edit-project-status">Statut *</label><select id="edit-project-status" v-model="form.status" class="select" :disabled="!canWrite" required><option value="DRAFT">Brouillon</option><option value="VALIDATED">Validé</option><option value="IN_PROGRESS">En cours</option><option value="COMPLETED">Terminé</option><option value="CANCELLED">Annulé</option></select></div>
          <div class="field"><label for="edit-project-classification">Classification *</label><select id="edit-project-classification" v-model="form.classification" class="select" :disabled="!canWrite" required><option value="PUBLIC">Public</option><option value="INTERNAL">Interne</option><option value="CONFIDENTIAL">Confidentiel</option><option value="RESTRICTED">Restreint</option></select></div>
          <div class="field"><label for="edit-project-start">Début</label><input id="edit-project-start" v-model="form.startDate" class="input" type="date" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-end">Fin</label><input id="edit-project-end" v-model="form.endDate" class="input" type="date" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-planned">Budget prévisionnel (€)</label><input id="edit-project-planned" v-model="form.plannedBudget" class="input" type="number" min="0" step="0.01" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-actual">Budget réel (€)</label><input id="edit-project-actual" v-model="form.actualBudget" class="input" type="number" min="0" step="0.01" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-sessions">Nombre de séances</label><input id="edit-project-sessions" v-model="form.totalSessions" class="input" type="number" min="0" step="1" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-unit-price">Prix unitaire séance (€)</label><input id="edit-project-unit-price" v-model="form.sessionUnitPrice" class="input" type="number" min="0" step="0.01" :disabled="!canWrite"></div>
          <div class="field field-full"><label for="edit-project-description">Description</label><textarea id="edit-project-description" v-model="form.description" class="textarea" :disabled="!canWrite" /></div>
        </div>

        <h2 style="margin-top:28px">Coûts et marge internes</h2>
        <div class="form-grid">
          <div class="field"><label for="edit-project-intervenor-cost">Coût intervenants (€)</label><input id="edit-project-intervenor-cost" v-model="form.totalIntervenorCost" class="input" type="number" min="0" step="0.01" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-material-cost">Matériel (€)</label><input id="edit-project-material-cost" v-model="form.materialCost" class="input" type="number" min="0" step="0.01" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-printing-cost">Impressions (€)</label><input id="edit-project-printing-cost" v-model="form.printingCost" class="input" type="number" min="0" step="0.01" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-other-cost">Autres coûts (€)</label><input id="edit-project-other-cost" v-model="form.otherCost" class="input" type="number" min="0" step="0.01" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-estimated-margin">Marge prévisionnelle (€)</label><input id="edit-project-estimated-margin" v-model="form.estimatedNetMargin" class="input" type="number" step="0.01" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-project-actual-margin">Marge réelle (€)</label><input id="edit-project-actual-margin" v-model="form.actualNetMargin" class="input" type="number" step="0.01" :disabled="!canWrite"></div>
          <div class="field field-full"><label for="edit-project-comments">Commentaires internes</label><textarea id="edit-project-comments" v-model="form.internalComments" class="textarea" :disabled="!canWrite" /></div>
        </div>

        <div v-if="canWrite" class="actions" style="margin-top:22px"><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer les modifications' }}</button><button class="btn btn-secondary" type="button" :disabled="archiving" @click="archiveProject">{{ archiving ? 'Archivage…' : 'Archiver le projet' }}</button></div>
      </form>

      <section class="card card-pad" style="margin-top:18px">
        <div class="page-head compact"><div><h2>Intervenants affectés</h2><p>{{ project.projectIntervenors.length }} affectation(s).</p></div></div>
        <div v-if="project.projectIntervenors.length" class="assignment-list">
          <div v-for="link in project.projectIntervenors" :key="link.id" class="assignment-row">
            <NuxtLink :to="`/dashboard/intervenors/${link.intervenor.id}`"><strong>{{ link.intervenor.firstName }} {{ link.intervenor.lastName }}</strong></NuxtLink>
            <div class="actions"><span class="badge badge-muted">{{ link.assignmentStatus }}</span><button v-if="canAssign" class="btn btn-secondary btn-small" type="button" :disabled="removingIntervenorId === link.intervenor.id" @click="unlinkIntervenor(link.intervenor.id, `${link.intervenor.firstName} ${link.intervenor.lastName}`)">Retirer</button></div>
          </div>
        </div>
        <p v-else class="muted">Aucun intervenant affecté.</p>
      </section>

      <section class="grid grid-3" style="margin-top:18px">
        <div class="card card-pad"><h3>Documents</h3><p>{{ project.documents.length }}</p></div>
        <div class="card card-pad"><h3>Bilans</h3><p>{{ project.reports.length }}</p><NuxtLink to="/dashboard/reports">Ouvrir les bilans</NuxtLink></div>
        <div class="card card-pad"><h3>Facturation</h3><p>{{ project.billingDocuments.length }}</p><NuxtLink to="/dashboard/billing">Ouvrir la facturation</NuxtLink></div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.compact{margin-bottom:12px}.assignment-list{display:grid;gap:8px}.assignment-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--ifics-border);border-radius:10px}.btn-small{padding:7px 10px}
</style>
