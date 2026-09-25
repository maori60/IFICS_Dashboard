<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
  key: route => route.fullPath,
})

useHead({ title: 'Fiche projet — IFICS' })

type ClientOption = {
  id: string
  name: string
  status: string
}

type ProjectType =
  | 'ASSOCIATIVE_ACTION'
  | 'COMMERCIAL_SERVICE'

type Assignment = {
  id: string
  assignmentStatus: string
  intervenor: {
    id: string
    firstName: string
    lastName: string
    email: string
    specialty: string | null
  }
}

type ProjectDetail = {
  id: string
  reference: string | null
  title: string
  description: string | null
  type: ProjectType
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
  projectClients: {
    id: string
    isMainClient: boolean
    isContractualClient: boolean
    isEndClient: boolean
    client: {
      id: string
      name: string
      type: string
      email: string | null
    }
  }[]
  projectIntervenors: Assignment[]
  documents: { id: string; title: string; type: string; version: number }[]
  reports: { id: string; title: string; status: string }[]
  billingDocuments: {
    id: string
    kind: string
    number: string
    status: string
    total: string
    currency: string
  }[]
}

const route = useRoute()
const projectId = computed(() => String(route.params.id || ''))
const projectUrl = computed(
  () => `/api/projects/${encodeURIComponent(projectId.value)}`,
)

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>(
  '/api/auth/me',
  { key: 'session-me' },
)

const permissions = computed(
  () => session.value?.data.user.permissions ?? [],
)

function hasPermission(permission: string): boolean {
  return permissions.value.includes('*')
    || permissions.value.includes(permission)
}

const canWrite = computed(() => hasPermission('project:write'))
const canAssign = computed(() => hasPermission('project:assign'))

const { data, error, refresh } = await useFetch<ApiSuccess<ProjectDetail>>(
  projectUrl,
)

const project = computed(() => data.value?.data)

const { data: clientsData } = await useFetch<ApiSuccess<ClientOption[]>>(
  '/api/clients',
  { immediate: canWrite.value },
)

const clients = computed(() =>
  (clientsData.value?.data ?? []).filter(item => item.status === 'ACTIVE'),
)

const contractualClientName = computed(() => {
  const links = project.value?.projectClients ?? []

  return (
    links.find(
      item => item.isContractualClient,
    )?.client.name
    ?? links.find(
      item => item.isMainClient,
    )?.client.name
    ?? links[0]?.client.name
    ?? 'Non renseigné'
  )
})

const endClientName = computed(() => {
  const links = project.value?.projectClients ?? []

  return (
    links.find(
      item => item.isEndClient,
    )?.client.name
    ?? links.find(
      item => item.isMainClient,
    )?.client.name
    ?? links[0]?.client.name
    ?? 'Non renseigné'
  )
})

const associativeClientName = computed(() => {
  const links = project.value?.projectClients ?? []

  return (
    links.find(
      item => item.isMainClient,
    )?.client.name
    ?? links.find(
      item => item.isContractualClient,
    )?.client.name
    ?? links.find(
      item => item.isEndClient,
    )?.client.name
    ?? links[0]?.client.name
    ?? 'Non renseigné'
  )
})

const ownAssignment = computed(() => {
  const user = session.value?.data.user

  if (user?.roleCode !== 'INTERVENOR' || !user.intervenorId) {
    return null
  }

  return project.value?.projectIntervenors.find(
    link => link.intervenor.id === user.intervenorId,
  ) ?? null
})

const canRespond = computed(
  () => ownAssignment.value?.assignmentStatus === 'PENDING',
)

const assignmentLabels: Record<string, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REFUSED: 'Refusée',
}

function assignmentLabel(status: string): string {
  return assignmentLabels[status] ?? status
}

const form = reactive({
  type:
    'ASSOCIATIVE_ACTION' as ProjectType,

  clientId:
    '',

  contractualClientId:
    '',

  endClientId:
    '',

  reference: '',
  title: '',
  description: '',
  status: 'DRAFT',
  classification: 'INTERNAL',
  startDate: '',
  endDate: '',
  plannedBudget: '',
  actualBudget: '',
  totalIntervenorCost: '',
  materialCost: '',
  printingCost: '',
  otherCost: '',
  estimatedNetMargin: '',
  actualNetMargin: '',
  totalSessions: '',
  sessionUnitPrice: '',
  internalComments: '',
})

const isCommercial = computed(
  () => form.type === 'COMMERCIAL_SERVICE',
)

const budgetFields = [
  { key: 'plannedBudget', label: 'Budget prévisionnel (€)', min: 0 },
  { key: 'actualBudget', label: 'Budget réel (€)', min: 0 },
  { key: 'sessionUnitPrice', label: 'Prix unitaire séance (€)', min: 0 },
] as const

const internalFields = [
  { key: 'totalIntervenorCost', label: 'Coût intervenants (€)', min: 0 },
  { key: 'materialCost', label: 'Matériel (€)', min: 0 },
  { key: 'printingCost', label: 'Impressions (€)', min: 0 },
  { key: 'otherCost', label: 'Autres coûts (€)', min: 0 },
  { key: 'estimatedNetMargin', label: 'Marge prévisionnelle (€)' },
  { key: 'actualNetMargin', label: 'Marge réelle (€)' },
] as const

const hydratedId = ref('')

watch(project, (value) => {
  if (!value || hydratedId.value === value.id) return

  hydratedId.value = value.id

  const mainClient = value.projectClients.find(
    item => item.isMainClient,
  )?.client ?? value.projectClients[0]?.client

  const contractualClient
    = value.projectClients.find(
      item => item.isContractualClient,
    )?.client ?? mainClient

  const endClient
    = value.projectClients.find(
      item => item.isEndClient,
    )?.client ?? mainClient

  Object.assign(form, {
    type:
      value.type,

    clientId:
      mainClient?.id ?? '',

    contractualClientId:
      contractualClient?.id ?? '',

    endClientId:
      endClient?.id ?? '',

    reference: value.reference ?? '',
    title: value.title,
    description: value.description ?? '',
    status: value.status,
    classification: value.classification || 'INTERNAL',
    startDate: value.startDate?.slice(0, 10) ?? '',
    endDate: value.endDate?.slice(0, 10) ?? '',
    plannedBudget: value.plannedBudget ?? '',
    actualBudget: value.actualBudget ?? '',
    totalIntervenorCost: value.totalIntervenorCost ?? '',
    materialCost: value.materialCost ?? '',
    printingCost: value.printingCost ?? '',
    otherCost: value.otherCost ?? '',
    estimatedNetMargin: value.estimatedNetMargin ?? '',
    actualNetMargin: value.actualNetMargin ?? '',
    totalSessions: value.totalSessions?.toString() ?? '',
    sessionUnitPrice: value.sessionUnitPrice ?? '',
    internalComments: value.internalComments ?? '',
  })
}, { immediate: true })

const saving = ref(false)
const archiving = ref(false)
const removingIntervenorId = ref('')
const responding = ref(false)
const responseComment = ref('')
const successMessage = ref('')
const errorMessage = ref('')

const busy = computed(() =>
  saving.value
  || archiving.value
  || Boolean(removingIntervenorId.value)
  || responding.value,
)

function clearMessages() {
  successMessage.value = ''
  errorMessage.value = ''
}

async function save() {
  if (!canWrite.value || busy.value) return

  clearMessages()

  if (isCommercial.value) {
    if (
      !form.contractualClientId
      || !form.endClientId
    ) {
      errorMessage.value =
        'Le client contractuel et le client final sont obligatoires pour une prestation commerciale.'

      return
    }
  }
  else if (!form.clientId) {
    errorMessage.value =
      'L’organisme ou client lié à l’action est obligatoire.'

    return
  }

  saving.value = true

  try {
    const commonBody = {
      type:
        form.type,

      reference:
        form.reference,

      title:
        form.title,

      description:
        form.description,

      status:
        form.status,

      classification:
        form.classification,

      startDate:
        form.startDate,

      endDate:
        form.endDate,

      plannedBudget:
        form.plannedBudget,

      actualBudget:
        form.actualBudget,

      totalIntervenorCost:
        form.totalIntervenorCost,

      materialCost:
        form.materialCost,

      printingCost:
        form.printingCost,

      otherCost:
        form.otherCost,

      estimatedNetMargin:
        form.estimatedNetMargin,

      actualNetMargin:
        form.actualNetMargin,

      totalSessions:
        form.totalSessions,

      sessionUnitPrice:
        form.sessionUnitPrice,

      internalComments:
        form.internalComments,
    }

    const clientBody = isCommercial.value
      ? {
          contractualClientId:
            form.contractualClientId,

          endClientId:
            form.endClientId,
        }
      : {
          clientId:
            form.clientId,
        }

    await $fetch(projectUrl.value, {
      method: 'PUT',

      body: {
        ...commonBody,
        ...clientBody,
      },
    })

    await refresh()

    successMessage.value =
      'Le projet a été mis à jour.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(
      err,
      'Impossible de mettre à jour le projet.',
    )
  }
  finally {
    saving.value = false
  }
}

async function unlinkIntervenor(intervenorId: string, name: string) {
  if (!canAssign.value || busy.value) return
  if (!window.confirm(`Retirer ${name} de ce projet ?`)) return

  removingIntervenorId.value = intervenorId
  clearMessages()

  try {
    await $fetch('/api/projects/unlink-intervenor', {
      method: 'POST',
      body: { projectId: projectId.value, intervenorId },
    })

    await refresh()
    successMessage.value = `${name} a été retiré du projet.`
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(
      err,
      'Impossible de retirer cet intervenant.',
    )
  }
  finally {
    removingIntervenorId.value = ''
  }
}

async function archiveProject() {
  if (!canWrite.value || busy.value) return

  if (!window.confirm(
    'Archiver ce projet ? Il restera dans l’historique mais disparaîtra des projets actifs.',
  )) return

  archiving.value = true
  clearMessages()

  try {
    await $fetch('/api/projects/archive', {
      method: 'POST',
      body: { id: projectId.value },
    })

    await navigateTo('/dashboard/projects?archived=1')
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(
      err,
      'Impossible d’archiver le projet.',
    )
  }
  finally {
    archiving.value = false
  }
}

async function respondToAssignment(
  assignmentStatus: 'ACCEPTED' | 'REFUSED',
) {
  if (!canRespond.value || busy.value) return

  const action = assignmentStatus === 'ACCEPTED' ? 'Accepter' : 'Refuser'

  if (!window.confirm(
    `${action} la mission « ${project.value?.title ?? ''} » ?`,
  )) return

  responding.value = true
  clearMessages()

  try {
    await $fetch(`${projectUrl.value}/assignment/respond`, {
      method: 'POST',
      body: {
        assignmentStatus,
        responseComment: responseComment.value.trim() || undefined,
      },
    })

    successMessage.value = assignmentStatus === 'ACCEPTED'
      ? 'Vous avez accepté cette mission.'
      : 'Vous avez refusé cette mission.'

    responseComment.value = ''
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(
      err,
      'La réponse n’a pas pu être confirmée. Vérifiez le statut de la mission.',
    )
  }
  finally {
    try {
      await refresh()
    }
    catch {
      errorMessage.value = 'Impossible de recharger le projet. Actualisez la page pour vérifier le statut de votre mission.'
    }

    responding.value = false
  }
}
</script>

<template>
  <div :aria-busy="busy">
    <div class="page-head">
      <div>
        <p class="eyebrow">Projet</p>
        <h1>{{ project?.title || 'Fiche projet' }}</h1>
        <p>
          {{
            canWrite
              ? 'Gérez les informations et le suivi opérationnel du projet.'
              : 'Consultez les informations du projet et votre affectation.'
          }}
        </p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/projects">
        Retour aux projets
      </NuxtLink>
    </div>

    <div v-if="error" class="alert alert-error" role="alert">
      Impossible de charger ce projet.
      <button class="btn btn-secondary" type="button" @click="refresh()">
        Réessayer
      </button>
    </div>

    <template v-else-if="project">
      <div
        v-if="successMessage"
        class="alert alert-success feedback"
        role="status"
      >
        {{ successMessage }}
      </div>

      <div
        v-if="errorMessage"
        class="alert alert-error feedback"
        role="alert"
      >
        {{ errorMessage }}
      </div>

      <section v-if="ownAssignment" class="card card-pad mission-response">
        <h2>Votre affectation</h2>
        <p>
          Statut :
          <strong>
            {{ assignmentLabel(ownAssignment.assignmentStatus) }}
          </strong>
        </p>

        <template v-if="canRespond">
          <p>
            Vous êtes invité à intervenir sur ce projet.
            Acceptez ou refusez cette proposition.
          </p>

          <div class="field">
            <label for="assignment-response-comment">
              Commentaire facultatif
            </label>
            <textarea
              id="assignment-response-comment"
              v-model="responseComment"
              class="textarea"
              maxlength="2000"
              rows="3"
              :disabled="busy"
            />
          </div>

          <div class="actions response-actions">
            <button
              class="btn btn-primary"
              type="button"
              :disabled="busy"
              @click="respondToAssignment('ACCEPTED')"
            >
              Accepter la mission
            </button>
            <button
              class="btn btn-secondary"
              type="button"
              :disabled="busy"
              @click="respondToAssignment('REFUSED')"
            >
              Refuser la mission
            </button>
            <span v-if="responding" role="status">
              Enregistrement de votre réponse…
            </span>
          </div>
        </template>
      </section>

      <form class="card card-pad" @submit.prevent="save">
        <div class="form-grid">
          <div class="field field-full">
            <label for="edit-project-type">
              Nature du projet
            </label>

            <select
              v-if="canWrite"
              id="edit-project-type"
              v-model="form.type"
              class="select"
              :disabled="busy"
              required
            >
              <option value="ASSOCIATIVE_ACTION">
                Action associative
              </option>

              <option value="COMMERCIAL_SERVICE">
                Prestation commerciale / Business
              </option>
            </select>

            <input
              v-else
              id="edit-project-type"
              class="input"
              :value="
                form.type === 'COMMERCIAL_SERVICE'
                  ? 'Prestation commerciale / Business'
                  : 'Action associative'
              "
              disabled
            >

            <span class="help">
              La nature du projet est indépendante de son mode de financement.
            </span>
          </div>

          <template v-if="isCommercial">
            <div class="field">
              <label for="edit-contractual-client">
                Client contractuel / facturé
              </label>

              <select
                v-if="canWrite"
                id="edit-contractual-client"
                v-model="form.contractualClientId"
                class="select"
                :disabled="busy"
                required
              >
                <option value="" disabled>
                  Sélectionner le client facturé
                </option>

                <option
                  v-for="client in clients"
                  :key="client.id"
                  :value="client.id"
                >
                  {{ client.name }}
                </option>
              </select>

              <input
                v-else
                id="edit-contractual-client"
                class="input"
                :value="contractualClientName"
                disabled
              >

              <span class="help">
                Structure qui reçoit la facture IFICS.
              </span>
            </div>

            <div class="field">
              <label for="edit-end-client">
                Client final / bénéficiaire
              </label>

              <select
                v-if="canWrite"
                id="edit-end-client"
                v-model="form.endClientId"
                class="select"
                :disabled="busy"
                required
              >
                <option value="" disabled>
                  Sélectionner le client final
                </option>

                <option
                  v-for="client in clients"
                  :key="client.id"
                  :value="client.id"
                >
                  {{ client.name }}
                </option>
              </select>

              <input
                v-else
                id="edit-end-client"
                class="input"
                :value="endClientName"
                disabled
              >

              <span class="help">
                Structure bénéficiaire de la mission et validatrice du CRA.
              </span>
            </div>

            <div class="field field-full">
              <div class="alert alert-info">
                Le client contractuel et le client final peuvent être
                identiques dans le cas d’un contrat direct.
              </div>
            </div>
          </template>

          <div
            v-else
            class="field field-full"
          >
            <label for="edit-project-client">
              Organisme / client lié
            </label>

            <select
              v-if="canWrite"
              id="edit-project-client"
              v-model="form.clientId"
              class="select"
              :disabled="busy"
              required
            >
              <option value="" disabled>
                Sélectionner une structure
              </option>

              <option
                v-for="client in clients"
                :key="client.id"
                :value="client.id"
              >
                {{ client.name }}
              </option>
            </select>

            <input
              v-else
              id="edit-project-client"
              class="input"
              :value="associativeClientName"
              disabled
            >

            <span class="help">
              Une action associative peut également être facturée.
            </span>
          </div>

          <div class="field">
            <label for="edit-project-reference">Référence</label>
            <input
              id="edit-project-reference"
              v-model="form.reference"
              class="input"
              maxlength="50"
              :disabled="!canWrite || busy"
            >
          </div>

          <div class="field">
            <label for="edit-project-title">Titre *</label>
            <input
              id="edit-project-title"
              v-model="form.title"
              class="input"
              maxlength="255"
              :disabled="!canWrite || busy"
              required
            >
          </div>

          <div class="field">
            <label for="edit-project-status">Statut *</label>
            <select
              id="edit-project-status"
              v-model="form.status"
              class="select"
              :disabled="!canWrite || busy"
              required
            >
              <option value="DRAFT">Brouillon</option>
              <option value="VALIDATED">Validé</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="COMPLETED">Terminé</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>

          <div class="field">
            <label for="edit-project-classification">Classification *</label>
            <select
              id="edit-project-classification"
              v-model="form.classification"
              class="select"
              :disabled="!canWrite || busy"
              required
            >
              <option value="PUBLIC">Public</option>
              <option value="INTERNAL">Interne</option>
              <option value="CONFIDENTIAL">Confidentiel</option>
              <option value="RESTRICTED">Restreint</option>
            </select>
          </div>

          <div class="field">
            <label for="edit-project-start">Début</label>
            <input
              id="edit-project-start"
              v-model="form.startDate"
              class="input"
              type="date"
              :disabled="!canWrite || busy"
            >
          </div>

          <div class="field">
            <label for="edit-project-end">Fin</label>
            <input
              id="edit-project-end"
              v-model="form.endDate"
              class="input"
              type="date"
              :disabled="!canWrite || busy"
            >
          </div>

          <template v-if="canWrite">
            <div
              v-for="field in budgetFields"
              :key="field.key"
              class="field"
            >
              <label :for="`edit-project-${field.key}`">
                {{ field.label }}
              </label>
              <input
                :id="`edit-project-${field.key}`"
                v-model="form[field.key]"
                class="input"
                type="number"
                :min="field.min"
                step="0.01"
                :disabled="busy"
              >
            </div>
          </template>

          <div class="field">
            <label for="edit-project-sessions">Nombre de séances</label>
            <input
              id="edit-project-sessions"
              v-model="form.totalSessions"
              class="input"
              type="number"
              min="0"
              step="1"
              :disabled="!canWrite || busy"
            >
          </div>

          <div class="field field-full">
            <label for="edit-project-description">Description</label>
            <textarea
              id="edit-project-description"
              v-model="form.description"
              class="textarea"
              :disabled="!canWrite || busy"
            />
          </div>
        </div>

        <template v-if="canWrite">
          <h2 class="internal-heading">Coûts et marge internes</h2>
          <div class="form-grid">
            <div
              v-for="field in internalFields"
              :key="field.key"
              class="field"
            >
              <label :for="`edit-project-${field.key}`">
                {{ field.label }}
              </label>
              <input
                :id="`edit-project-${field.key}`"
                v-model="form[field.key]"
                class="input"
                type="number"
                :min="'min' in field ? field.min : undefined"
                step="0.01"
                :disabled="busy"
              >
            </div>

            <div class="field field-full">
              <label for="edit-project-comments">Commentaires internes</label>
              <textarea
                id="edit-project-comments"
                v-model="form.internalComments"
                class="textarea"
                :disabled="busy"
              />
            </div>
          </div>

          <div class="actions save-actions">
            <button class="btn btn-primary" type="submit" :disabled="busy">
              {{ saving ? 'Enregistrement…' : 'Enregistrer les modifications' }}
            </button>
            <button
              class="btn btn-secondary"
              type="button"
              :disabled="busy"
              @click="archiveProject"
            >
              {{ archiving ? 'Archivage…' : 'Archiver le projet' }}
            </button>
          </div>
        </template>
      </form>

      <section class="card card-pad section-spacing">
        <div class="page-head compact">
          <div>
            <h2>Intervenants affectés</h2>
            <p>{{ project.projectIntervenors.length }} {{ project.projectIntervenors.length === 1 ? 'affectation' : 'affectations' }}.</p>
          </div>
        </div>

        <div v-if="project.projectIntervenors.length" class="assignment-list">
          <div
            v-for="link in project.projectIntervenors"
            :key="link.id"
            class="assignment-row"
          >
            <NuxtLink :to="`/dashboard/intervenors/${link.intervenor.id}`">
              <strong>
                {{ link.intervenor.firstName }} {{ link.intervenor.lastName }}
              </strong>
            </NuxtLink>

            <div class="actions">
              <span class="badge badge-muted">
                {{ assignmentLabel(link.assignmentStatus) }}
              </span>
              <button
                v-if="canAssign"
                class="btn btn-secondary btn-small"
                type="button"
                :disabled="busy"
                @click="unlinkIntervenor(
                  link.intervenor.id,
                  `${link.intervenor.firstName} ${link.intervenor.lastName}`,
                )"
              >
                {{
                  removingIntervenorId === link.intervenor.id
                    ? 'Retrait…'
                    : 'Retirer'
                }}
              </button>
            </div>
          </div>
        </div>
        <p v-else class="muted">Aucun intervenant affecté.</p>
      </section>

      <section class="grid grid-3 section-spacing">
        <div class="card card-pad">
          <h3>Documents</h3>
          <p>{{ project.documents.length }}</p>
        </div>
        <div class="card card-pad">
          <h3>Bilans</h3>
          <p>{{ project.reports.length }}</p>
          <NuxtLink to="/dashboard/reports">Ouvrir les bilans</NuxtLink>
        </div>
        <div v-if="hasPermission('billing:read')" class="card card-pad">
          <h3>Facturation</h3>
          <p>{{ project.billingDocuments.length }}</p>
          <NuxtLink to="/dashboard/billing">Ouvrir la facturation</NuxtLink>
        </div>
      </section>
    </template>

    <p v-else role="status">Chargement du projet…</p>
    <PermanentDeletePanel v-if="project" entity="project" :entity-id="project.id" :label="project.title" return-to="/dashboard/projects" />
  </div>
</template>

<style scoped>
.compact {
  margin-bottom: 12px;
}

.feedback,
.mission-response {
  margin-bottom: 18px;
}

.section-spacing {
  margin-top: 18px;
}

.internal-heading {
  margin-top: 28px;
}

.save-actions {
  margin-top: 22px;
}

.response-actions {
  margin-top: 16px;
}

.actions {
  flex-wrap: wrap;
}

.assignment-list {
  display: grid;
  gap: 8px;
}

.assignment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--ifics-border);
  border-radius: 10px;
}

.btn-small {
  padding: 7px 10px;
}
</style>