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
  projectIntervenors: {
    assignmentStatus: string
    intervenor: {
      id: string
      firstName: string
      lastName: string
    }
  }[]
  _count: {
    documents: number
    reports: number
    billingDocuments: number
  }
}

type IntervenorOption = {
  id: string
  firstName: string
  lastName: string
  email: string
  specialty: string | null
}

const assignmentLabels: Record<string, string> = {
  PENDING: 'En attente de réponse',
  ACCEPTED: 'Acceptée',
  REFUSED: 'Refusée',
}

const route = useRoute()

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>(
  '/api/auth/me',
  { key: 'session-me' },
)

const { data, status, error, refresh } = await useFetch<ApiSuccess<Project[]>>(
  '/api/projects',
)

const projects = computed(() => data.value?.data ?? [])
const loading = computed(() => status.value === 'pending')
const user = computed(() => session.value?.data.user)
const permissions = computed(() => user.value?.permissions ?? [])

const hasPermission = (permission: string) =>
  permissions.value.includes('*') || permissions.value.includes(permission)

const canCreate = computed(() => hasPermission('project:write'))
const canAssign = computed(() => hasPermission('project:assign'))
const canCreateIntervenor = computed(() => hasPermission('intervenor:write'))

const isIntervenor = computed(() =>
  user.value?.roleCode === 'INTERVENOR'
  && Boolean(user.value.intervenorId),
)

const created = computed(() => route.query.created === '1')
const archived = computed(() => route.query.archived === '1')

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : '—'

function ownAssignment(project: Project) {
  if (!isIntervenor.value) return undefined

  return project.projectIntervenors.find(
    link => link.intervenor.id === user.value?.intervenorId,
  )
}

function needsResponse(project: Project): boolean {
  return ownAssignment(project)?.assignmentStatus === 'PENDING'
}

const pendingCount = computed(() =>
  projects.value.filter(project => needsResponse(project)).length,
)

const displayedProjects = computed(() =>
  [...projects.value].sort((first, second) =>
    Number(needsResponse(second)) - Number(needsResponse(first)),
  ),
)

function assignmentLabel(value: string): string {
  return assignmentLabels[value] ?? value
}

const {
  data: intervenorOptionsData,
  status: intervenorOptionsStatus,
  error: intervenorOptionsError,
  refresh: refreshIntervenorOptions,
} = await useFetch<ApiSuccess<IntervenorOption[]>>(
  '/api/intervenors/options',
  { immediate: canAssign.value },
)

const intervenorOptions = computed(() =>
  intervenorOptionsData.value?.data ?? [],
)

const selectedIntervenor = reactive<Record<string, string>>({})
const assigningProjectId = ref<string | null>(null)
const assignmentError = ref('')
const assignmentSuccess = ref('')

function availableIntervenors(project: Project) {
  const assigned = new Set(
    project.projectIntervenors.map(link => link.intervenor.id),
  )

  return intervenorOptions.value.filter(item => !assigned.has(item.id))
}

async function assignIntervenor(project: Project) {
  const intervenorId = selectedIntervenor[project.id]

  if (
    !canAssign.value
    || !intervenorId
    || assigningProjectId.value
    || loading.value
    || !availableIntervenors(project).some(item => item.id === intervenorId)
  ) {
    return
  }

  assigningProjectId.value = project.id
  assignmentError.value = ''
  assignmentSuccess.value = ''

  try {
    await $fetch('/api/projects/link-intervenor', {
      method: 'POST',
      body: { projectId: project.id, intervenorId },
    })

    selectedIntervenor[project.id] = ''
    assignmentSuccess.value =
      `Intervenant affecté au projet « ${project.title} ». Sa réponse est attendue.`

    await refresh()

    if (error.value) {
      assignmentError.value =
        'L’affectation a été enregistrée, mais la liste des projets n’a pas pu être actualisée.'
    }
  }
  catch (cause) {
    assignmentError.value = apiErrorMessage(
      cause,
      'Impossible d’affecter l’intervenant.',
    )
  }
  finally {
    assigningProjectId.value = null
  }
}
</script>

<template>
  <div :aria-busy="loading || Boolean(assigningProjectId)">
    <div class="page-head">
      <div>
        <h1>{{ isIntervenor ? 'Mes missions' : 'Projets' }}</h1>
        <p>
          {{
            isIntervenor
              ? 'Retrouvez vos projets et répondez aux propositions de mission.'
              : 'Suivi opérationnel des actions IFICS.'
          }}
        </p>
      </div>
      <div class="actions">
        <NuxtLink
          v-if="canCreate"
          class="btn btn-primary"
          to="/dashboard/projects/create"
        >
          Nouveau projet
        </NuxtLink>
        <button
          class="btn btn-secondary"
          type="button"
          :disabled="loading || Boolean(assigningProjectId)"
          @click="refresh()"
        >
          {{ loading ? 'Actualisation…' : 'Actualiser' }}
        </button>
      </div>
    </div>

    <div v-if="created" class="alert alert-success feedback" role="status">
      Le projet a été créé avec succès.
    </div>

    <div v-if="archived" class="alert alert-success feedback" role="status">
      Le projet a été archivé.
    </div>

    <div
      v-if="assignmentSuccess"
      class="alert alert-success feedback"
      role="status"
    >
      {{ assignmentSuccess }}
    </div>

    <div
      v-if="assignmentError"
      class="alert alert-error feedback"
      role="alert"
    >
      {{ assignmentError }}
    </div>

    <p v-if="loading" class="empty-state" role="status">
      Chargement des projets…
    </p>

    <div v-else-if="error" class="alert alert-error" role="alert">
      Impossible de charger les projets. Utilisez le bouton « Actualiser »
      pour réessayer.
    </div>

    <div v-else-if="!projects.length" class="empty-state">
      <p>
        {{
          isIntervenor
            ? 'Aucune mission accessible pour le moment.'
            : 'Aucun projet accessible.'
        }}
      </p>
      <NuxtLink
        v-if="canCreate"
        class="btn btn-primary"
        to="/dashboard/projects/create"
      >
        Créer le premier projet
      </NuxtLink>
    </div>

    <template v-else>
      <div
        v-if="isIntervenor && pendingCount > 0"
        class="pending-summary"
        role="status"
      >
        <strong>
          {{ pendingCount }}
          {{
            pendingCount === 1
              ? 'mission attend votre réponse'
              : 'missions attendent votre réponse'
          }}
        </strong>
        <span>
          Les propositions en attente apparaissent en premier.
          Cliquez sur « Répondre à la mission » pour consulter les détails
          et accepter ou refuser.
        </span>
      </div>

      <div class="grid grid-2">
        <article
          v-for="project in displayedProjects"
          :key="project.id"
          class="card card-pad"
          :class="{ 'pending-card': needsResponse(project) }"
        >
          <div class="project-topline">
            <div class="actions">
              <span class="badge">{{ project.status }}</span>
              <span v-if="project.reference" class="badge badge-muted">
                {{ project.reference }}
              </span>
            </div>

            <NuxtLink
              v-if="!needsResponse(project)"
              class="btn btn-secondary btn-small"
              :to="`/dashboard/projects/${project.id}`"
              :aria-label="`${canCreate ? 'Ouvrir ou modifier' : 'Consulter'} le projet ${project.title}`"
            >
              {{ canCreate ? 'Ouvrir / modifier' : 'Consulter la mission' }}
            </NuxtLink>
          </div>

          <h2>{{ project.title }}</h2>

          <div v-if="needsResponse(project)" class="response-notice">
            <strong>Votre réponse est attendue</strong>
            <p>
              IFICS vous propose cette mission. Consultez sa fiche pour
              l’accepter ou la refuser.
            </p>
            <NuxtLink
              class="btn btn-primary"
              :to="`/dashboard/projects/${project.id}`"
              :aria-label="`Répondre à la proposition de mission ${project.title}`"
            >
              Répondre à la mission
            </NuxtLink>
          </div>

          <p class="muted">
            {{ date(project.startDate) }} → {{ date(project.endDate) }}
          </p>

          <p>
            <strong>Client :</strong>
            {{ project.projectClients[0]?.client.name || 'Non rattaché' }}
          </p>

          <p>
            <strong>Intervenants :</strong>
            {{ project.projectIntervenors.length }} ·
            <strong>Documents :</strong>
            {{ project._count.documents }} ·
            <strong>Bilans :</strong>
            {{ project._count.reports }}
          </p>

          <div
            v-if="project.projectIntervenors.length"
            class="assignment-list"
          >
            <div
              v-for="link in project.projectIntervenors"
              :key="link.intervenor.id"
              class="assignment-row"
            >
              <span>
                {{ link.intervenor.firstName }}
                {{ link.intervenor.lastName }}
                <strong
                  v-if="
                    isIntervenor
                      && link.intervenor.id === user?.intervenorId
                  "
                >
                  (vous)
                </strong>
              </span>
              <span
                class="badge"
                :class="{
                  'badge-warning': link.assignmentStatus === 'PENDING',
                  'badge-danger': link.assignmentStatus === 'REFUSED',
                  'badge-muted': link.assignmentStatus !== 'PENDING'
                    && link.assignmentStatus !== 'REFUSED'
                    && link.assignmentStatus !== 'ACCEPTED',
                }"
              >
                {{ assignmentLabel(link.assignmentStatus) }}
              </span>
            </div>
          </div>

          <div v-if="canAssign" class="assignment-box">
            <p
              v-if="intervenorOptionsStatus === 'pending'"
              class="muted"
              role="status"
            >
              Chargement des intervenants…
            </p>

            <div
              v-else-if="intervenorOptionsError"
              class="alert alert-error"
              role="alert"
            >
              <p>Impossible de charger les intervenants disponibles.</p>
              <button
                class="btn btn-secondary btn-small"
                type="button"
                :disabled="Boolean(assigningProjectId)"
                @click="refreshIntervenorOptions()"
              >
                Réessayer
              </button>
            </div>

            <template v-else-if="availableIntervenors(project).length">
              <label :for="`intervenor-${project.id}`">
                <strong>Affecter un intervenant</strong>
              </label>

              <div class="assignment-controls">
                <select
                  :id="`intervenor-${project.id}`"
                  v-model="selectedIntervenor[project.id]"
                  class="select"
                  :disabled="Boolean(assigningProjectId)"
                >
                  <option value="">Sélectionner…</option>
                  <option
                    v-for="item in availableIntervenors(project)"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.firstName }} {{ item.lastName }}{{
                      item.specialty ? ` — ${item.specialty}` : ''
                    }}
                  </option>
                </select>

                <button
                  class="btn btn-secondary"
                  type="button"
                  :disabled="
                    !selectedIntervenor[project.id]
                      || Boolean(assigningProjectId)
                  "
                  @click="assignIntervenor(project)"
                >
                  {{
                    assigningProjectId === project.id
                      ? 'Affectation…'
                      : 'Affecter'
                  }}
                </button>
              </div>
            </template>

            <div v-else class="muted">
              {{
                intervenorOptions.length
                  ? 'Tous les intervenants actifs disponibles sont déjà affectés à ce projet.'
                  : 'Aucun intervenant actif disponible.'
              }}
              <NuxtLink
                v-if="canCreateIntervenor"
                to="/dashboard/intervenors/create"
              >
                Créer un intervenant
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
h2 {
  margin: 14px 0 6px;
}

.empty-state p {
  margin-top: 0;
}

.feedback {
  margin-bottom: 18px;
}

.project-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.btn-small {
  padding: 8px 12px;
  white-space: nowrap;
}

.pending-summary {
  display: grid;
  gap: 8px;
  margin-bottom: 22px;
  padding: 18px 20px;
  border: 1px solid #e4c879;
  border-radius: 14px;
  background: #fff8e6;
  color: #694c0b;
}

.pending-card {
  border: 2px solid #c79a35;
}

.response-notice {
  display: grid;
  justify-items: start;
  gap: 10px;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #e4c879;
  border-radius: 12px;
  background: #fff8e6;
  color: #694c0b;
}

.response-notice p {
  margin: 0;
}

.assignment-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.assignment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 9px 11px;
  border-radius: 10px;
  background: #f6f8f6;
}

.assignment-box {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--ifics-border);
}

.assignment-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  margin-top: 8px;
}

@media (max-width: 700px) {
  .assignment-controls {
    grid-template-columns: 1fr;
  }

  .project-topline {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>