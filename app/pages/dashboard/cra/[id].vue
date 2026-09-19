<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import holidayData from '../../../../server/data/jours-feries-metropole.json'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
  key: route => route.fullPath,
})

type CraStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'CLIENT_PENDING'
  | 'VALIDATED'
  | 'REFUSED'

type CraDay = {
  id: string
  date: string
  hours: number
  comment: string | null
  hasIncident: boolean
  incident: string | null
}

type CraReport = {
  id: string
  intervenorId: string
  year: number
  month: number
  status: CraStatus
  revision: number
  totalDays: number
  totalHours: number
  project: { id: string; title: string; reference: string | null }
  intervenor: { id: string; firstName: string; lastName: string }
  days: CraDay[]
}

const statusLabels: Record<CraStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'À vérifier par IFICS',
  CLIENT_PENDING: 'En attente du client',
  VALIDATED: 'Validé',
  REFUSED: 'À corriger',
}

const holidays: Record<string, string> = holidayData
const coveredYears = new Set(
  Object.keys(holidays).map(date => Number(date.slice(0, 4))),
)

const route = useRoute()
const reportUrl = `/api/cra/${encodeURIComponent(String(route.params.id))}`

const {
  data,
  status,
  error,
  refresh,
} = await useFetch<ApiSuccess<CraReport>>(reportUrl)

const { data: sessionResponse } = await useFetch<ApiSuccess<SessionPayload>>(
  '/api/auth/me',
)

const report = computed(() => data.value?.data ?? null)
const user = computed(() => sessionResponse.value?.data.user)
const busy = ref(false)
const feedback = ref('')
const actionError = ref('')

function can(permission: string): boolean {
  const permissions = user.value?.permissions ?? []
  return permissions.includes('*') || permissions.includes(permission)
}

const canEdit = computed(() => {
  if (!report.value || report.value.status !== 'DRAFT') return false

  return can('cra:manage')
    || (
      can('cra:write:own')
      && user.value?.intervenorId === report.value.intervenorId
    )
})

const calendarAvailable = computed(() =>
  Boolean(report.value && coveredYears.has(report.value.year)),
)

const selectedDays = computed(() =>
  new Map(report.value?.days.map(day => [day.date, day]) ?? []),
)

const period = computed(() => {
  if (!report.value) return 'Compte rendu d’activité'

  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(
    report.value.year,
    report.value.month - 1,
    1,
  )))
})

useHead({
  title: computed(() => `CRA — ${period.value} — IFICS`),
})

const weekdays = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']

const calendar = computed(() => {
  if (!report.value) return []

  const { year, month } = report.value
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cellCount = Math.ceil((offset + count) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => {
    const number = index - offset + 1

    if (number < 1 || number > count) return null

    const date = new Date(Date.UTC(year, month - 1, number))
    const iso = date.toISOString().slice(0, 10)
    const weekday = date.getUTCDay()

    return {
      number,
      iso,
      weekend: weekday === 0 || weekday === 6,
      holiday: holidays[iso] ?? null,
      selected: selectedDays.value.has(iso),
    }
  })
})

const notes = computed(() =>
  report.value?.days.filter(day => day.comment || day.hasIncident) ?? [],
)

function mutationErrorMessage(cause: unknown): string {
  const failure = cause as {
    statusCode?: number
    response?: { status?: number }
  }

  const code = failure?.statusCode ?? failure?.response?.status

  if (code === 409) {
    return 'Le CRA a changé, a été verrouillé, ou cette journée est déjà déclarée sur un autre projet. Vérifiez les données actualisées.'
  }

  if (code === 403 || code === 404) {
    return 'Cette action n’est plus autorisée pour votre compte ou cette mission.'
  }

  if (code === 400) {
    return 'La demande a été refusée. Vérifiez les journées sélectionnées.'
  }

  return 'La réponse du serveur n’a pas pu être confirmée. Vérifiez le CRA actualisé avant de réessayer.'
}

async function saveAction(
  url: string,
  method: 'PUT' | 'POST',
  body: Record<string, unknown>,
  message: string,
) {
  busy.value = true
  feedback.value = ''
  actionError.value = ''

  try {
    await $fetch(url, { method, body })
    feedback.value = message
  }
  catch (cause) {
    actionError.value = mutationErrorMessage(cause)
  }
  finally {
    try {
      await refresh()
    }
    catch {
      actionError.value = 'Impossible de recharger le CRA. Actualisez la page.'
    }
    finally {
      busy.value = false
    }
  }
}

async function toggleDay(date: string) {
  const current = report.value

  if (
    !current
    || !canEdit.value
    || busy.value
    || error.value
    || status.value === 'pending'
  ) return

  const selected = !selectedDays.value.has(date)

  if (!selected) {
    const day = selectedDays.value.get(date)

    if (
      day
      && (day.comment || day.hasIncident)
      && !window.confirm(
        'Retirer cette journée supprimera aussi son commentaire et son incident. Continuer ?',
      )
    ) return
  }

  await saveAction(
    `${reportUrl}/day`,
    'PUT',
    { date, selected, revision: current.revision },
    selected ? 'Journée enregistrée : 7 h.' : 'Journée retirée.',
  )
}

async function submitReport() {
  const current = report.value

  if (
    !current
    || !canEdit.value
    || !calendarAvailable.value
    || current.totalDays === 0
    || busy.value
    || error.value
    || status.value === 'pending'
  ) return

  const confirmed = window.confirm(
    `Clôturer le CRA de ${period.value} avec ${current.totalDays} journée(s) et ${current.totalHours} h au forfait ? Vous ne pourrez plus le modifier sans réouverture par IFICS.`,
  )

  if (!confirmed) return

  await saveAction(
    `${reportUrl}/submit`,
    'POST',
    { confirmed: true, revision: current.revision },
    'CRA transmis à IFICS pour vérification. Les journées sont verrouillées.',
  )
}
</script>

<template>
  <section class="cra-agenda" :aria-busy="busy || status === 'pending'">
    <NuxtLink class="back-link" to="/dashboard/cra">
      ← Retour aux CRA
    </NuxtLink>

    <p v-if="status === 'pending'" role="status">
      Chargement du CRA…
    </p>

    <div v-else-if="error" class="notice error" role="alert">
      <p>Le CRA est inaccessible ou son chargement a échoué.</p>
      <button type="button" class="button" @click="refresh()">
        Réessayer
      </button>
    </div>

    <template v-else-if="report">
      <PageHeader
        :title="`CRA — ${period}`"
        :subtitle="`${report.intervenor.firstName} ${report.intervenor.lastName} · ${report.project.title}`"
      >
        <span class="badge">{{ statusLabels[report.status] }}</span>
      </PageHeader>

      <div class="totals">
        <div>
          <strong>{{ report.totalDays }}</strong>
          <span>Journées déclarées</span>
        </div>
        <div>
          <strong>{{ report.totalHours }} h</strong>
          <span>Total au forfait</span>
        </div>
        <div>
          <strong>7 h</strong>
          <span>Par journée cochée</span>
        </div>
      </div>

      <p v-if="!calendarAvailable" class="notice error" role="alert">
        Le calendrier des jours fériés doit être actualisé pour cette année.
        La saisie est désactivée.
      </p>
      <p v-else-if="canEdit" class="notice">
        Cliquez sur une journée pour la cocher ou la décocher.
        Les journées futures sont autorisées ; les week-ends et jours fériés
        sont désactivés. Chaque modification est enregistrée automatiquement.
      </p>
      <p v-else class="notice">
        Ce CRA est en lecture seule.
        <template v-if="report.status !== 'DRAFT'">
          Sa modification nécessite une réouverture par IFICS.
        </template>
      </p>

      <div class="calendar" aria-label="Calendrier mensuel des journées">
        <div
          v-for="weekday in weekdays"
          :key="weekday"
          class="weekday"
        >
          {{ weekday }}
        </div>

        <template v-for="(day, index) in calendar" :key="index">
          <button
            v-if="day"
            type="button"
            class="day"
            :class="{
              selected: day.selected,
              unavailable: day.weekend || Boolean(day.holiday),
            }"
            :disabled="
              !canEdit
                || !calendarAvailable
                || busy
                || day.weekend
                || Boolean(day.holiday)
            "
            :aria-pressed="day.selected"
            :aria-label="`${day.number} ${period}, ${day.holiday || (day.weekend ? 'week-end' : day.selected ? 'déclaré, 7 heures' : 'non déclaré')}`"
            @click="toggleDay(day.iso)"
          >
            <strong>{{ day.number }}</strong>
            <span v-if="day.holiday">{{ day.holiday }}</span>
            <span v-else-if="day.weekend">Repos</span>
            <span v-else-if="day.selected">✓ 7 h</span>
            <span v-else>—</span>
          </button>
          <div v-else class="empty-day" aria-hidden="true" />
        </template>
      </div>

      <div class="actions">
        <span v-if="busy" role="status">Enregistrement et actualisation…</span>
        <button
          v-if="canEdit"
          type="button"
          class="button primary"
          :disabled="busy || report.totalDays === 0 || !calendarAvailable"
          @click="submitReport"
        >
          Clôturer et transmettre à IFICS
        </button>
      </div>

      <section v-if="notes.length" class="notes">
        <h2>Commentaires et incidents</h2>
        <article v-for="day in notes" :key="day.id">
          <h3>{{ day.date.split('-').reverse().join('/') }}</h3>
          <p v-if="day.comment">{{ day.comment }}</p>
          <p v-if="day.hasIncident">
            <strong>Incident :</strong> {{ day.incident }}
          </p>
        </article>
      </section>
    </template>

    <p v-if="actionError" class="notice error" role="alert">
      {{ actionError }}
    </p>
    <p v-if="feedback" class="notice" role="status">
      {{ feedback }}
    </p>
  </section>
</template>

<style scoped>
.cra-agenda {
  display: grid;
  gap: 22px;
}

.back-link {
  color: #1c6042;
  font-weight: 700;
  text-underline-offset: 4px;
}

.badge {
  padding: 8px 12px;
  border-radius: 999px;
  background: #e7f2ea;
  color: #214631;
  font-weight: 700;
}

.totals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.totals > div {
  display: grid;
  gap: 7px;
  padding: 20px;
  border: 1px solid #dce6df;
  border-radius: 14px;
  background: #fff;
}

.totals strong {
  color: #163d29;
  font-size: 1.8rem;
}

.totals span {
  color: #52665b;
}

.notice {
  margin: 0;
  padding: 16px 18px;
  border: 1px solid #c9e5d4;
  border-radius: 12px;
  background: #edf8f1;
  color: #214631;
}

.error {
  border-color: #efc2ba;
  background: #fff0ed;
  color: #993d31;
}

.calendar {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.weekday {
  padding: 10px 0;
  text-align: center;
  color: #52665b;
  font-weight: 700;
}

.day {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-height: 100px;
  padding: 14px;
  border: 1px solid #cbd9cf;
  border-radius: 12px;
  background: #fff;
  color: #294533;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.day strong {
  font-size: 1.1rem;
}

.day span {
  font-size: .8rem;
  overflow-wrap: anywhere;
}

.day.selected {
  background: #1d4933;
  border-color: #1d4933;
  color: #fff;
}

.day.unavailable {
  background: #e9eeeb;
  border-color: #e0e6e2;
  color: #68746d;
}

.day:disabled {
  cursor: default;
}

.day:not(:disabled):hover {
  outline: 2px solid #438660;
}

.day:focus-visible,
.button:focus-visible,
.back-link:focus-visible {
  outline: 3px solid #438660;
  outline-offset: 3px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
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
  background: #1d4933;
  border-color: #1d4933;
  color: #fff;
}

.button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.notes {
  padding: 20px;
  border: 1px solid #dce6df;
  border-radius: 14px;
  background: #fff;
}

.notes article + article {
  border-top: 1px solid #dce6df;
}

.notes p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .totals {
    gap: 8px;
  }

  .totals > div {
    padding: 12px;
  }

  .totals strong {
    font-size: 1.35rem;
  }

  .totals span {
    font-size: .8rem;
  }

  .calendar {
    gap: 4px;
  }

  .day {
    min-height: 76px;
    padding: 7px;
    border-radius: 8px;
  }

  .day span {
    font-size: .65rem;
  }
}
</style>