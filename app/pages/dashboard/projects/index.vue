<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Projets' })

type Project = {
  id: string
  reference: string | null
  title: string
  status: string
  startDate: string | null
  endDate: string | null
  plannedBudget: string | null
  actualBudget: string | null
  projectClients: { client: { id: string; name: string } }[]
  projectIntervenors: { assignmentStatus: string; intervenor: { id: string; firstName: string; lastName: string } }[]
  _count: { documents: number; reports: number; billingDocuments: number }
}

type IntervenorOption = {
  id: string
  firstName: string
  lastName: string
  email: string
  specialty: string | null
}

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Project[]>>('/api/projects')

const projects = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const hasPermission = (permission: string) => permissions.value.includes('*') || permissions.value.includes(permission)
const canCreate = computed(() => hasPermission('project:write'))
const canAssign = computed(() => hasPermission('project:assign'))
const canCreateIntervenor = computed(() => hasPermission('intervenor:write'))
const created = computed(() => route.query.created === '1')
const archived = computed(() => route.query.archived === '1')
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('fr-FR') : '—'

const { data: intervenorOptionsData } = await useFetch<ApiSuccess<IntervenorOption[]>>('/api/intervenors/options', {
  immediate: canAssign.value,
})
const intervenorOptions = computed(() => intervenorOptionsData.value?.data ?? [])
const selectedIntervenor = reactive<Record<string, string>>({})
const assigningProjectId = ref<string | null>(null)
const assignmentError = ref('')
const assignmentSuccess = ref('')

function availableIntervenors(project: Project) {
  const assigned = new Set(project.projectIntervenors.map(link => link.intervenor.id))
  return intervenorOptions.value.filter(item => !assigned.has(item.id))
}

async function assignIntervenor(project: Project) {
  const intervenorId = selectedIntervenor[project.id]
  if (!intervenorId || assigningProjectId.value) return

  assigningProjectId.value = project.id
  assignmentError.value = ''
  assignmentSuccess.value = ''

  try {
    await $fetch('/api/projects/link-intervenor', {
      method: 'POST',
      body: { projectId: project.id, intervenorId },
    })
    selectedIntervenor[project.id] = ''
    assignmentSuccess.value = `Intervenant affecté au projet « ${project.title} ».`
    await refresh()
  }
  catch (error) {
    assignmentError.value = apiErrorMessage(error, 'Impossible d’affecter l’intervenant.')
  }
  finally {
    assigningProjectId.value = null
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Projets</h1>
        <p>Suivi opérationnel des actions IFICS.</p>
      </div>
      <div class="actions">
        <NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/projects/create">
          Nouveau projet
        </NuxtLink>
        <button class="btn btn-secondary" type="button" @click="refresh()">
          Actualiser
        </button>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom: 18px">
      Le projet a été créé avec succès.
    </div>
    <div v-if="archived" class="alert alert-success" style="margin-bottom: 18px">
      Le projet a été archivé.
    </div>
    <div v-if="assignmentSuccess" class="alert alert-success" style="margin-bottom: 18px">
      {{ assignmentSuccess }}
    </div>
    <div v-if="assignmentError" class="alert alert-error" style="margin-bottom: 18px">
      {{ assignmentError }}
    </div>

    <div v-if="error" class="alert alert-error">
      Impossible de charger les projets.
    </div>

    <div v-else-if="!projects.length" class="empty-state">
      <p>Aucun projet accessible.</p>
      <NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/projects/create">
        Créer le premier projet
      </NuxtLink>
    </div>

    <div v-else class="grid grid-2">
      <article v-for="project in projects" :key="project.id" class="card card-pad">
        <div class="project-topline">
          <div class="actions">
            <span class="badge">{{ project.status }}</span>
            <span v-if="project.reference" class="badge badge-muted">{{ project.reference }}</span>
          </div>
          <NuxtLink class="btn btn-secondary btn-small" :to="`/dashboard/projects/${project.id}`">Ouvrir / modifier</NuxtLink>
        </div>
        <h2>{{ project.title }}</h2>
        <p class="muted">{{ date(project.startDate) }} → {{ date(project.endDate) }}</p>
        <p><strong>Client :</strong> {{ project.projectClients[0]?.client.name || 'Non rattaché' }}</p>
        <p>
          <strong>Intervenants :</strong> {{ project.projectIntervenors.length }} ·
          <strong>Documents :</strong> {{ project._count.documents }} ·
          <strong>Bilans :</strong> {{ project._count.reports }}
        </p>

        <div v-if="project.projectIntervenors.length" class="assignment-list">
          <div v-for="link in project.projectIntervenors" :key="link.intervenor.id" class="assignment-row">
            <span>{{ link.intervenor.firstName }} {{ link.intervenor.lastName }}</span>
            <span class="badge badge-muted">{{ link.assignmentStatus }}</span>
          </div>
        </div>

        <div v-if="canAssign" class="assignment-box">
          <template v-if="intervenorOptions.length">
            <label :for="`intervenor-${project.id}`"><strong>Affecter un intervenant</strong></label>
            <div class="assignment-controls">
              <select :id="`intervenor-${project.id}`" v-model="selectedIntervenor[project.id]" class="select">
                <option value="">Sélectionner…</option>
                <option v-for="item in availableIntervenors(project)" :key="item.id" :value="item.id">
                  {{ item.firstName }} {{ item.lastName }}{{ item.specialty ? ` — ${item.specialty}` : '' }}
                </option>
              </select>
              <button
                class="btn btn-secondary"
                type="button"
                :disabled="!selectedIntervenor[project.id] || assigningProjectId === project.id"
                @click="assignIntervenor(project)"
              >
                {{ assigningProjectId === project.id ? 'Affectation…' : 'Affecter' }}
              </button>
            </div>
          </template>
          <div v-else class="muted">
            Aucun intervenant actif disponible.
            <NuxtLink v-if="canCreateIntervenor" to="/dashboard/intervenors/create">Créer un intervenant</NuxtLink>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
h2 { margin: 14px 0 6px; }
.empty-state p { margin-top: 0; }
.project-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.btn-small { padding: 8px 12px; white-space: nowrap; }
.assignment-list { display: grid; gap: 8px; margin-top: 16px; }
.assignment-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 11px; border-radius: 10px; background: #f6f8f6; }
.assignment-box { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--ifics-border); }
.assignment-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; margin-top: 8px; }
@media (max-width: 700px) { .assignment-controls { grid-template-columns: 1fr; } .project-topline { align-items: flex-start; flex-direction: column; } }
</style>
