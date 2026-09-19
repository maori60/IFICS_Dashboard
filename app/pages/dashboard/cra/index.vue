<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

useHead({ title: 'Comptes rendus d’activité — IFICS' })

type CraStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'CLIENT_PENDING'
  | 'VALIDATED'
  | 'REFUSED'

type CraSummary = {
  id: string
  year: number
  month: number
  status: CraStatus
  totalDays: number
  totalHours: number
  project: {
    id: string
    reference: string | null
    title: string
  }
  intervenor: {
    id: string
    firstName: string
    lastName: string
  }
}

type CraList = {
  items: CraSummary[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
}

const statusLabels: Record<CraStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'À vérifier par IFICS',
  CLIENT_PENDING: 'En attente du client',
  VALIDATED: 'Validé',
  REFUSED: 'À corriger',
}

const page = ref(1)
const query = computed(() => ({
  page: page.value,
  pageSize: 20,
}))

const { data, status, error, refresh } = await useFetch<ApiSuccess<CraList>>(
  '/api/cra',
  { query },
)

const reports = computed(() => data.value?.data.items ?? [])
const pagination = computed(() => data.value?.data.pagination)
const loading = computed(() => status.value === 'pending')

const errorMessage = computed(() => {
  if (error.value?.statusCode === 403) {
    return 'Votre compte ne dispose pas des droits de consultation des CRA.'
  }

  return 'Impossible de charger les CRA. Réessayez dans quelques instants.'
})

const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function periodLabel(report: CraSummary): string {
  return monthFormatter.format(
    new Date(Date.UTC(report.year, report.month - 1, 1)),
  )
}

function previousPage() {
  if (!loading.value && page.value > 1) {
    page.value -= 1
  }
}

function nextPage() {
  if (!loading.value && pagination.value?.hasNextPage) {
    page.value += 1
  }
}
</script>

<template>
  <section class="cra-page" :aria-busy="loading">
    <PageHeader
      title="Comptes rendus d’activité"
      subtitle="Retrouvez vos journées déclarées et suivez la validation de vos CRA."
    />

    <div class="cra-notice">
      <strong>Une journée déclarée = 7 heures au forfait</strong>
      <span>
        Chaque CRA correspond à un intervenant, un projet et un mois.
      </span>
    </div>

    <p v-if="loading" class="cra-feedback" role="status">
      Chargement des CRA…
    </p>

    <div v-else-if="error" class="cra-error" role="alert">
      <p>{{ errorMessage }}</p>
      <button class="cra-button" type="button" @click="refresh()">
        Réessayer
      </button>
    </div>

    <template v-else>
      <div class="cra-summary">
        <strong>
          {{ pagination?.total ?? 0 }}
          {{ pagination?.total === 1 ? 'CRA accessible' : 'CRA accessibles' }}
        </strong>
        <span>Seuls les rapports autorisés pour votre compte apparaissent.</span>
      </div>

      <div v-if="reports.length === 0" class="cra-empty">
        <h2>Aucun CRA sur cette page</h2>
        <p>
          Les comptes rendus apparaîtront ici après leur création.
        </p>
      </div>

      <div v-else class="cra-table-container">
        <table class="cra-table">
          <caption class="sr-only">
            Liste des comptes rendus d’activité accessibles
          </caption>
          <thead>
            <tr>
              <th scope="col">Période</th>
              <th scope="col">Intervenant</th>
              <th scope="col">Projet</th>
              <th scope="col">Journées</th>
              <th scope="col">Heures au forfait</th>
              <th scope="col">État</th>
              <th scope="col">Consultation</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="report in reports" :key="report.id">
              <td class="cra-period">{{ periodLabel(report) }}</td>
              <td>
                {{ report.intervenor.firstName }}
                {{ report.intervenor.lastName }}
              </td>
              <td>
                <strong>{{ report.project.title }}</strong>
                <small v-if="report.project.reference">
                  {{ report.project.reference }}
                </small>
              </td>
              <td>{{ report.totalDays }}</td>
              <td>{{ report.totalHours }} h</td>
              <td>
                <span class="cra-badge" :class="`state-${report.status}`">
                  {{ statusLabels[report.status] }}
                </span>
              </td>
              <td>
                <NuxtLink
                  class="cra-open"
                  :to="`/dashboard/cra/${report.id}`"
                  :aria-label="`Ouvrir le CRA de ${report.intervenor.firstName} ${report.intervenor.lastName}, ${periodLabel(report)}, ${report.project.title}`"
                >
                  Ouvrir
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <nav
      v-if="page > 1 || (pagination?.totalPages ?? 0) > 1"
      class="cra-pagination"
      aria-label="Pagination des CRA"
    >
      <button
        class="cra-button"
        type="button"
        :disabled="loading || page <= 1"
        @click="previousPage"
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
        class="cra-button"
        type="button"
        :disabled="loading || Boolean(error) || !pagination?.hasNextPage"
        @click="nextPage"
      >
        Suivant
      </button>
    </nav>
  </section>
</template>

<style scoped>
.cra-page {
  display: grid;
  gap: 24px;
}

.cra-notice {
  display: grid;
  gap: 6px;
  padding: 18px 20px;
  border: 1px solid #c9e5d4;
  border-radius: 14px;
  background: #edf8f1;
  color: #1c6042;
}

.cra-notice span,
.cra-summary span {
  font-size: .9rem;
}

.cra-summary {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.cra-summary span,
.cra-empty p,
.cra-feedback {
  color: #52665b;
}

.cra-table-container {
  overflow-x: auto;
  background: #fff;
  border: 1px solid #dce6df;
  border-radius: 14px;
}

.cra-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.cra-table th,
.cra-table td {
  padding: 16px;
  border-bottom: 1px solid #e7eee9;
}

.cra-table th {
  background: #eaf1ec;
  color: #345540;
  font-size: .8rem;
  white-space: nowrap;
}

.cra-table td {
  color: #20392b;
  vertical-align: middle;
}

.cra-table tbody tr:last-child td {
  border-bottom: 0;
}

.cra-table tbody tr:hover {
  background: #f8fbf9;
}

.cra-table td strong,
.cra-table td small {
  display: block;
}

.cra-table td small {
  margin-top: 4px;
  color: #52665b;
}

.cra-period {
  white-space: nowrap;
  font-weight: 700;
}

.cra-badge {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef2f0;
  color: #43554a;
  font-size: .8rem;
  font-weight: 700;
  white-space: nowrap;
}

.state-SUBMITTED,
.state-CLIENT_PENDING {
  background: #fff3d6;
  color: #775400;
}

.state-VALIDATED {
  background: #dcf3e4;
  color: #1c6042;
}

.state-REFUSED {
  background: #fce8e5;
  color: #993d31;
}

.cra-open {
  color: #1c6042;
  font-weight: 750;
  text-underline-offset: 4px;
}

.cra-empty,
.cra-error {
  padding: 30px;
  background: #fff;
  border: 1px solid #dce6df;
  border-radius: 14px;
}

.cra-empty h2 {
  margin: 0 0 10px;
  font-size: 1.2rem;
  color: #20392b;
}

.cra-error {
  border-color: #efc2ba;
  color: #993d31;
}

.cra-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.cra-button {
  padding: 10px 16px;
  border: 1px solid #b9ccbf;
  border-radius: 10px;
  background: #fff;
  color: #214631;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.cra-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.cra-button:focus-visible,
.cra-open:focus-visible {
  outline: 3px solid #438660;
  outline-offset: 3px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
</style>