<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import holidayData from '../../../../server/data/jours-feries-metropole.json'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

useHead({ title: 'Créer un CRA — IFICS' })

type Assignment = {
  id: string
  projectId: string
  intervenorId: string
  project: {
    title: string
    reference: string | null
    startDate: string | null
    endDate: string | null
  }
  intervenor: {
    firstName: string
    lastName: string
  }
}

type AssignmentList = {
  items: Assignment[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
}

const {
  data: sessionResponse,
  status: sessionStatus,
  error: sessionError,
  refresh: refreshSession,
} = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me')

const user = computed(() => sessionResponse.value?.data.user)

const canAccessCreation = computed(() => {
  const currentUser = user.value

  if (
    sessionError.value
    || !currentUser
    || !currentUser.intervenorId
  ) {
    return false
  }

  return currentUser.permissions.includes('*')
    || currentUser.permissions.includes('cra:write:own')
})

const accessMessage = computed(() => {
  if (!user.value?.intervenorId) {
    return 'Votre compte doit être associé à une fiche intervenant pour créer un CRA. Contactez IFICS.'
  }

  return 'Votre compte ne dispose pas de la permission de créer ses CRA. Contactez IFICS.'
})

const searchInput = ref('')
const search = ref('')
const page = ref(1)
const selectedId = ref('')
const selectedMonth = ref('')
const creating = ref(false)
const actionError = ref('')

const coveredYears = new Set(
  Object.keys(holidayData).map(date => Number(date.slice(0, 4))),
)

const query = computed(() => ({
  search: search.value,
  page: page.value,
}))

const { data, status, error, refresh } = await useFetch<
  ApiSuccess<AssignmentList>
>('/api/cra/assignments', {
  query,
  immediate: canAccessCreation.value,
  watch: false,
})

const loading = computed(() => status.value === 'pending')
const assignments = computed(() => data.value?.data.items ?? [])
const pagination = computed(() => data.value?.data.pagination)

const selectedAssignment = computed(() =>
  assignments.value.find(item =>
    item.id === selectedId.value
    && item.intervenorId === user.value?.intervenorId,
  ) ?? null,
)

const periodError = computed(() => {
  const match = /^(\d{4})-(\d{2})$/.exec(selectedMonth.value)

  if (!match) return ''

  const year = Number(match[1])
  const month = Number(match[2])

  if (
    year < 2000
    || year > 2100
    || month < 1
    || month > 12
  ) {
    return 'Mois invalide.'
  }

  if (!coveredYears.has(year)) {
    return 'Cette année n’est pas encore couverte par le calendrier des jours fériés.'
  }

  const assignment = selectedAssignment.value

  if (!assignment) return ''

  const periodStart = new Date(Date.UTC(year, month - 1, 1))
  const periodEnd = new Date(Date.UTC(year, month, 0))

  const projectStart = assignment.project.startDate
    ? new Date(assignment.project.startDate)
    : null

  const projectEnd = assignment.project.endDate
    ? new Date(assignment.project.endDate)
    : null

  if (projectStart && periodEnd < projectStart) {
    return 'Ce mois est antérieur au début de la mission.'
  }

  if (projectEnd && periodStart > projectEnd) {
    return 'Ce mois est postérieur à la fin de la mission.'
  }

  return ''
})

const validPeriod = computed(() => {
  const match = /^(\d{4})-(\d{2})$/.exec(selectedMonth.value)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])

  if (periodError.value) {
    return null
  }

  return { year, month }
})

watch(selectedAssignment, (assignment) => {
  if (!assignment || !selectedMonth.value) return

  const minimumMonth = assignment.project.startDate?.slice(0, 7)
  const maximumMonth = assignment.project.endDate?.slice(0, 7)

  if (minimumMonth && selectedMonth.value < minimumMonth) {
    selectedMonth.value = minimumMonth
    return
  }

  if (maximumMonth && selectedMonth.value > maximumMonth) {
    selectedMonth.value = maximumMonth
  }
})

const canCreate = computed(() =>
  Boolean(
    canAccessCreation.value
    && selectedAssignment.value
    && validPeriod.value
    && !creating.value
    && !loading.value
    && !error.value
    && sessionStatus.value !== 'pending',
  ),
)

watch(canAccessCreation, async (allowed) => {
  selectedId.value = ''
  actionError.value = ''

  if (allowed) {
    await refresh()
  }
})

onMounted(() => {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    timeZone:
      sessionResponse.value
        ?.data
        .association
        ?.timezone
      || 'Europe/Paris',
  }).formatToParts(new Date())

  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value

  if (year && month) selectedMonth.value = `${year}-${month}`
})

async function reloadAssignments() {
  if (!canAccessCreation.value || creating.value || loading.value) return

  selectedId.value = ''
  actionError.value = ''
  await refresh()
}

async function applySearch() {
  if (!canAccessCreation.value || creating.value || loading.value) return

  selectedId.value = ''
  actionError.value = ''
  page.value = 1
  search.value = searchInput.value.trim()

  await refresh()
}

async function changePage(nextPage: number) {
  if (
    !canAccessCreation.value
    || creating.value
    || loading.value
    || !Number.isInteger(nextPage)
    || nextPage < 1
    || nextPage === page.value
  ) {
    return
  }

  if (
    nextPage > page.value
    && (
      error.value
      || !pagination.value?.hasNextPage
      || nextPage !== page.value + 1
    )
  ) {
    return
  }

  selectedId.value = ''
  actionError.value = ''
  page.value = nextPage

  await refresh()
}

async function createReport() {
  const assignment = selectedAssignment.value
  const period = validPeriod.value

  if (!canCreate.value || !assignment || !period) return

  creating.value = true
  actionError.value = ''

  try {
    const response = await $fetch<ApiSuccess<{ id: string }>>(
      '/api/cra/create',
      {
        method: 'POST',
        body: {
          projectId: assignment.projectId,
          year: period.year,
          month: period.month,
        },
      },
    )

    await navigateTo(
      `/dashboard/cra/${encodeURIComponent(response.data.id)}`,
    )
  }
  catch (cause) {
    const failure = cause as {
      statusCode?: number
      response?: { status?: number }
    }

    const code = failure?.statusCode ?? failure?.response?.status

    if (code === 409) {
      actionError.value =
        'Un CRA existe déjà pour cette mission et ce mois. Retrouvez-le dans la liste des CRA.'
    }
    else if (code === 403 || code === 404) {
      actionError.value =
        'Votre compte ou cette mission ne permet plus la création de ce CRA.'
    }
    else if (code === 400) {
      actionError.value =
        'La demande a été refusée. Vérifiez la mission et le mois sélectionnés.'
    }
    else {
      actionError.value =
        'La création n’a pas pu être confirmée. Consultez la liste des CRA avant de réessayer.'
    }
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <section
    class="cra-create"
    :aria-busy="creating || loading || sessionStatus === 'pending'"
  >
    <NuxtLink class="back-link" to="/dashboard/cra">
      ← Retour aux CRA
    </NuxtLink>

    <PageHeader
      title="Créer un CRA"
      :subtitle="
        canAccessCreation
          ? 'Choisissez l’une de vos missions acceptées et le mois à déclarer.'
          : 'La création d’un CRA nécessite une fiche intervenant rattachée au compte.'
      "
    />

    <p v-if="sessionStatus === 'pending'" role="status">
      Vérification de votre accès…
    </p>

    <div v-else-if="sessionError || !user" class="notice error" role="alert">
      <p>Impossible de vérifier les droits de votre compte.</p>
      <button class="button" type="button" @click="refreshSession()">
        Réessayer
      </button>
    </div>

    <div v-else-if="!canAccessCreation" class="notice">
      {{ accessMessage }}
    </div>

    <template v-else>
      <form class="search-form" @submit.prevent="applySearch">
        <label for="cra-search">Rechercher dans mes missions</label>
        <div class="search-row">
          <input
            id="cra-search"
            v-model="searchInput"
            type="search"
            maxlength="100"
            placeholder="Titre ou référence du projet"
            :disabled="creating || loading"
          >
          <button
            class="button"
            type="submit"
            :disabled="creating || loading"
          >
            Rechercher
          </button>
        </div>
      </form>

      <p v-if="loading" role="status">Chargement de vos missions…</p>

      <div v-else-if="error" class="notice error" role="alert">
        <p>
          {{
            error.statusCode === 403
              ? 'Votre compte ne dispose plus des droits de création des CRA.'
              : 'Impossible de charger vos missions.'
          }}
        </p>
        <button class="button" type="button" @click="reloadAssignments">
          Réessayer
        </button>
      </div>

      <template v-else>
        <div v-if="assignments.length === 0" class="notice">
          Aucune mission admissible trouvée sur cette page.
          Votre fiche intervenant doit être active et votre affectation
          acceptée sur un projet non archivé et non annulé.
        </div>

        <form v-else class="create-form" @submit.prevent="createReport">
          <fieldset :disabled="creating">
            <legend>1. Sélectionnez votre mission</legend>

            <label
              v-for="assignment in assignments"
              :key="assignment.id"
              class="mission"
              :class="{ selected: selectedId === assignment.id }"
            >
              <input
                v-model="selectedId"
                type="radio"
                name="assignment"
                :value="assignment.id"
                required
              >
              <span>
                <strong>{{ assignment.project.title }}</strong>
                <span>
                  {{ assignment.intervenor.firstName }}
                  {{ assignment.intervenor.lastName }}
                </span>
                <small v-if="assignment.project.reference">
                  Référence : {{ assignment.project.reference }}
                </small>
              </span>
            </label>
          </fieldset>

          <div class="period-field">
            <label for="cra-month">2. Choisissez le mois</label>
            <input
              id="cra-month"
              v-model="selectedMonth"
              type="month"
              required
              :disabled="creating"
              :min="
                selectedAssignment?.project.startDate
                  ? selectedAssignment.project.startDate.slice(0, 7)
                  : undefined
              "
              :max="
                selectedAssignment?.project.endDate
                  ? selectedAssignment.project.endDate.slice(0, 7)
                  : undefined
              "
            >
            <p
              v-if="selectedMonth && periodError"
              class="field-error"
              role="alert"
            >
              {{ periodError }}
            </p>
          </div>

          <div v-if="selectedAssignment && validPeriod" class="notice">
            <strong>{{ selectedAssignment.project.title }}</strong>
            <p>
              {{ selectedAssignment.intervenor.firstName }}
              {{ selectedAssignment.intervenor.lastName }}
              — {{ selectedMonth.split('-').reverse().join('/') }}
            </p>
            Votre CRA sera créé en brouillon. Vous pourrez ensuite cocher
            vos journées dans l’agenda.
          </div>

          <button
            class="button primary"
            type="submit"
            :disabled="!canCreate"
          >
            {{ creating ? 'Création en cours…' : 'Créer et ouvrir l’agenda' }}
          </button>
        </form>
      </template>

      <nav
        v-if="page > 1 || (pagination?.totalPages ?? 0) > 1"
        class="pagination"
        aria-label="Pagination des missions"
      >
        <button
          class="button"
          type="button"
          :disabled="creating || loading || page <= 1"
          @click="changePage(page - 1)"
        >
          Précédent
        </button>

        <span>
          Page {{ page }}
          <template v-if="!loading && !error && pagination">
            sur {{ Math.max(1, pagination.totalPages) }}
          </template>
        </span>

        <button
          class="button"
          type="button"
          :disabled="
            creating || loading || Boolean(error) || !pagination?.hasNextPage
          "
          @click="changePage(page + 1)"
        >
          Suivant
        </button>
      </nav>

      <div v-if="actionError" class="notice error" role="alert">
        <p>{{ actionError }}</p>
        <NuxtLink class="back-link" to="/dashboard/cra">
          Consulter les CRA
        </NuxtLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
.cra-create,
.create-form {
  display: grid;
  gap: 24px;
}

.back-link {
  color: #1c6042;
  font-weight: 700;
  text-underline-offset: 4px;
}

.search-form,
.period-field {
  display: grid;
  gap: 10px;
}

.search-form > label,
.period-field > label,
legend {
  color: #20392b;
  font-weight: 750;
}

.search-row {
  display: flex;
  gap: 12px;
}

input[type="search"],
input[type="month"] {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid #b9ccbf;
  border-radius: 10px;
  background: #fff;
  color: #20392b;
  font: inherit;
}

input[type="search"] {
  flex: 1;
}

input[type="month"] {
  max-width: 260px;
}

fieldset {
  display: grid;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 20px;
  border: 1px solid #dce6df;
  border-radius: 14px;
  background: #fff;
}

legend {
  padding: 0 8px;
}

.mission {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid #dce6df;
  border-radius: 10px;
  cursor: pointer;
}

.mission.selected {
  background: #edf8f1;
  border-color: #438660;
}

.mission > span {
  display: grid;
  gap: 5px;
  overflow-wrap: anywhere;
}

.mission strong {
  color: #214631;
}

.mission small {
  color: #52665b;
}

input[type="radio"] {
  margin-top: 4px;
  accent-color: #1d4933;
}

.notice {
  padding: 18px;
  border: 1px solid #c9e5d4;
  border-radius: 12px;
  background: #edf8f1;
  color: #214631;
}

.error {
  background: #fff0ed;
  border-color: #efc2ba;
  color: #993d31;
}

.field-error {
  margin: 0;
  color: #993d31;
}

.button {
  padding: 12px 18px;
  border: 1px solid #b9ccbf;
  border-radius: 10px;
  background: #fff;
  color: #214631;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.button.primary {
  justify-self: start;
  background: #1d4933;
  border-color: #1d4933;
  color: #fff;
}

.button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.button:focus-visible,
input:focus-visible,
.back-link:focus-visible {
  outline: 3px solid #438660;
  outline-offset: 3px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 600px) {
  .search-row {
    flex-direction: column;
  }

  fieldset {
    padding: 12px;
  }

  .mission {
    padding: 12px;
  }
}
</style>