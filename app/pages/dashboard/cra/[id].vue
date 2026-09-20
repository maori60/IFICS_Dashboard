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
  | 'REVIEWED'
  | 'CLIENT_PENDING'
  | 'VALIDATED'
  | 'REFUSED'

type ReviewDecision = 'REVIEWED' | 'REFUSED'

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
  submittedAt: string | null
  validatedAt: string | null
  reviewedAt: string | null
  reviewedById: string | null
  correctionRequestedAt: string | null
  correctionRequestedById: string | null
  correctionReason: string | null
  totalDays: number
  totalHours: number
  project: { id: string; title: string; reference: string | null }
  intervenor: { id: string; firstName: string; lastName: string }
  days: CraDay[]
}

const statusLabels: Record<CraStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'À vérifier par IFICS',
  REVIEWED: 'Vérifié par IFICS',
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

const {
  data: sessionResponse,
  error: sessionError,
  refresh: refreshSession,
} = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me')

const report = computed(() => data.value?.data ?? null)
const user = computed(() =>
  sessionError.value ? undefined : sessionResponse.value?.data.user,
)

const busy = ref(false)
const feedback = ref('')
const actionError = ref('')
const showCorrectionForm = ref(false)
const correctionReason = ref('')

const reportReady = computed(() =>
  Boolean(report.value)
  && !error.value
  && status.value !== 'pending',
)

function hasPermission(permission: string): boolean {
  const permissions = user.value?.permissions ?? []

  return permissions.includes('*') || permissions.includes(permission)
}

const isOwner = computed(() => {
  const currentUser = user.value
  const currentReport = report.value

  return Boolean(
    currentUser
    && currentReport
    && currentUser.roleCode === 'INTERVENOR'
    && currentUser.intervenorId
    && currentUser.intervenorId === currentReport.intervenorId,
  )
})

const canWriteOwn = computed(() =>
  isOwner.value && hasPermission('cra:write:own'),
)

const canEdit = computed(() => {
  const current = report.value

  return reportReady.value
    && canWriteOwn.value
    && Boolean(
      current
      && (current.status === 'DRAFT' || current.status === 'REFUSED'),
    )
})

const canReview = computed(() =>
  reportReady.value
  && report.value?.status === 'SUBMITTED'
  && hasPermission('cra:read:all')
  && hasPermission('cra:review'),
)

const correctionReasonValid = computed(() => {
  const reason = correctionReason.value.trim()

  return reason.length > 0 && reason.length <= 2000
})

const readOnlyMessage = computed(() => {
  const current = report.value

  if (!current) return ''

  if (sessionError.value) {
    return 'Vos droits n’ont pas pu être chargés. Les actions sont désactivées.'
  }

  switch (current.status) {
    case 'DRAFT':
      return isOwner.value
        ? 'Ce CRA est en lecture seule : votre compte ne dispose pas de la permission de saisie.'
        : 'Ce brouillon est en lecture seule. Seul l’intervenant concerné peut déclarer ses journées et transmettre son CRA.'
    case 'SUBMITTED':
      return 'Ce CRA a été transmis à IFICS pour vérification. Les journées sont verrouillées.'
    case 'REVIEWED':
      return 'IFICS a vérifié ce CRA. Il est prêt pour l’envoi au client ; les journées restent verrouillées.'
    case 'CLIENT_PENDING':
      return 'Ce CRA est en attente de validation par le client. Les journées sont verrouillées.'
    case 'VALIDATED':
      return 'Ce CRA est validé. Les journées sont en lecture seule.'
    case 'REFUSED':
      return isOwner.value
        ? 'Une correction est demandée, mais votre compte ne dispose pas de la permission de saisie.'
        : 'Une correction est demandée. Seul l’intervenant concerné peut modifier ses journées et transmettre à nouveau le CRA.'
    default:
      return 'Ce CRA est en lecture seule.'
  }
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

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})

function dateLabel(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

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
    return 'Le CRA a changé, a été verrouillé, ou cette journée est déjà déclarée sur un autre projet. Vérifiez les données actualisées avant de réessayer.'
  }

  if (code === 403 || code === 404) {
    return 'Cette action n’est plus autorisée pour votre compte ou cette mission.'
  }

  if (code === 400) {
    return 'La demande a été refusée. Vérifiez les journées sélectionnées et, pour une correction, le motif renseigné.'
  }

  return 'La réponse du serveur n’a pas pu être confirmée. Vérifiez le CRA actualisé avant de réessayer.'
}

async function saveAction(
  url: string,
  method: 'PUT' | 'POST',
  body: Record<string, unknown>,
  message: string,
  action: 'edit' | 'review',
): Promise<boolean> {
  const allowed = action === 'review' ? canReview.value : canEdit.value

  if (!allowed || busy.value || !reportReady.value) return false

  busy.value = true
  feedback.value = ''
  actionError.value = ''

  let succeeded = false

  try {
    await $fetch(url, { method, body })
    succeeded = true
    feedback.value = message
  }
  catch (cause) {
    actionError.value = mutationErrorMessage(cause)
  }
  finally {
    try {
      await refresh()

      if (error.value || !report.value) {
        feedback.value = ''
        actionError.value = 'Impossible de recharger le CRA. Actualisez la page avant de continuer.'
      }
    }
    catch {
      feedback.value = ''
      actionError.value = 'Impossible de recharger le CRA. Actualisez la page avant de continuer.'
    }
    finally {
      busy.value = false
    }
  }

  return succeeded
}

async function toggleDay(date: string) {
  const current = report.value

  if (
    !current
    || !canEdit.value
    || !calendarAvailable.value
    || busy.value
  ) return

  const cell = calendar.value.find(day => day?.iso === date)

  if (!cell || cell.weekend || cell.holiday) return

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
    'edit',
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
  ) return

  const corrected = current.status === 'REFUSED'

  const confirmed = window.confirm(
    `${corrected ? 'Transmettre à nouveau' : 'Clôturer et transmettre'} le CRA de ${period.value} avec ${current.totalDays} journée(s) et ${current.totalHours} h au forfait ? Les journées seront verrouillées après transmission.`,
  )

  if (!confirmed) return

  await saveAction(
    `${reportUrl}/submit`,
    'POST',
    { confirmed: true, revision: current.revision },
    'CRA transmis à IFICS pour vérification. Les journées sont verrouillées.',
    'edit',
  )
}

async function reviewReport(decision: ReviewDecision) {
  const current = report.value

  if (!current || !canReview.value || busy.value) return

  const reason = correctionReason.value.trim()

  if (decision === 'REFUSED' && !correctionReasonValid.value) {
    actionError.value = 'Indiquez un motif de correction de 1 à 2 000 caractères.'
    return
  }

  const confirmed = window.confirm(
    decision === 'REVIEWED'
      ? `Confirmer la vérification IFICS du CRA de ${period.value} pour ${current.intervenor.firstName} ${current.intervenor.lastName} ? Cette étape ne l’envoie pas encore au client.`
      : `Demander une correction du CRA de ${period.value} ? L’intervenant pourra modifier ses journées et recevra le motif renseigné.`,
  )

  if (!confirmed) return

  const succeeded = await saveAction(
    `${reportUrl}/review`,
    'POST',
    {
      decision,
      confirmed: true,
      revision: current.revision,
      ...(decision === 'REFUSED' ? { correctionReason: reason } : {}),
    },
    decision === 'REVIEWED'
      ? 'CRA vérifié par IFICS. Il est prêt pour l’envoi au client.'
      : 'Correction demandée. L’intervenant peut modifier puis transmettre à nouveau son CRA.',
    'review',
  )

  if (succeeded) {
    correctionReason.value = ''
    showCorrectionForm.value = false
  }
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
      <button
        type="button"
        class="button"
        :disabled="busy"
        @click="refresh()"
      >
        Réessayer
      </button>
    </div>

    <template v-else-if="report">
      <PageHeader
        :title="`CRA — ${period}`"
        :subtitle="`${report.intervenor.firstName} ${report.intervenor.lastName} · ${report.project.title}`"
      >
        <span class="badge" :class="`state-${report.status}`">
          {{ statusLabels[report.status] }}
        </span>
      </PageHeader>

      <div v-if="sessionError" class="notice error" role="alert">
        <p>Impossible de charger vos droits. Les actions sont désactivées.</p>
        <button
          type="button"
          class="button"
          :disabled="busy"
          @click="refreshSession()"
        >
          Recharger mes droits
        </button>
      </div>

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

      <section
        v-if="report.correctionReason"
        class="notice correction-notice"
        aria-labelledby="correction-heading"
      >
        <h2 id="correction-heading">
          {{ report.status === 'REFUSED'
            ? 'Correction demandée'
            : 'Dernière demande de correction' }}
        </h2>
        <p v-if="report.correctionRequestedAt" class="muted">
          Le {{ dateLabel(report.correctionRequestedAt) }} — heure de Paris
        </p>
        <p class="preserve-text">{{ report.correctionReason }}</p>
        <p v-if="report.status === 'REFUSED' && canEdit">
          Corrigez les journées concernées, puis transmettez à nouveau votre CRA.
        </p>
        <p v-else-if="report.status === 'SUBMITTED'">
          Le CRA a été transmis à nouveau. Ce motif rappelle la correction
          précédemment demandée ; une nouvelle vérification IFICS est attendue.
        </p>
      </section>

      <p v-if="report.reviewedAt" class="notice">
        Vérification IFICS enregistrée le
        {{ dateLabel(report.reviewedAt) }} — heure de Paris.
      </p>

      <p v-if="!calendarAvailable" class="notice error" role="alert">
        Le calendrier des jours fériés doit être actualisé pour cette année.
        La saisie est désactivée.
      </p>

      <p v-if="canEdit && calendarAvailable" class="notice">
        Cliquez sur une journée pour la cocher ou la décocher.
        Les journées futures sont autorisées ; les week-ends et jours fériés
        sont désactivés. Chaque modification est enregistrée automatiquement.
      </p>
      <p v-else-if="!canEdit" class="notice">
        {{ readOnlyMessage }}
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

      <div v-if="canEdit" class="actions">
        <button
          type="button"
          class="button primary"
          :disabled="busy || report.totalDays === 0 || !calendarAvailable"
          @click="submitReport"
        >
          {{ report.status === 'REFUSED'
            ? 'Transmettre le CRA corrigé à IFICS'
            : 'Clôturer et transmettre à IFICS' }}
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

      <section
        v-if="canReview"
        class="review-panel"
        aria-labelledby="review-heading"
      >
        <h2 id="review-heading">Vérification IFICS</h2>
        <p>
          Contrôlez les journées déclarées et les éventuels commentaires.
          Vous pouvez marquer le CRA comme vérifié ou demander une correction.
        </p>

        <template v-if="!showCorrectionForm">
          <div class="actions">
            <button
              type="button"
              class="button"
              :disabled="busy"
              @click="showCorrectionForm = true"
            >
              Demander une correction
            </button>
            <button
              type="button"
              class="button primary"
              :disabled="busy"
              @click="reviewReport('REVIEWED')"
            >
              Marquer comme vérifié
            </button>
          </div>
          <p class="muted">
            La vérification IFICS ne déclenche pas l’envoi au client.
          </p>
        </template>

        <form v-else class="correction-form" @submit.prevent="reviewReport('REFUSED')">
          <label for="correction-reason">
            Corrections attendues de l’intervenant *
          </label>
          <textarea
            id="correction-reason"
            v-model="correctionReason"
            rows="5"
            maxlength="2000"
            required
            :disabled="busy"
            aria-describedby="correction-help"
          />
          <p id="correction-help" class="muted">
            Précisez les journées et les éléments à corriger.
            Ce motif sera visible par l’intervenant.
            {{ correctionReason.length }} / 2 000 caractères.
          </p>
          <div class="actions">
            <button
              type="button"
              class="button"
              :disabled="busy"
              @click="showCorrectionForm = false"
            >
              Annuler
            </button>
            <button
              type="submit"
              class="button primary"
              :disabled="busy || !correctionReasonValid"
            >
              Confirmer la demande de correction
            </button>
          </div>
        </form>
      </section>
    </template>

    <p v-if="busy" class="notice" role="status">
      Enregistrement et actualisation…
    </p>
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

.state-SUBMITTED,
.state-CLIENT_PENDING {
  background: #fff3d6;
  color: #775400;
}

.state-REVIEWED {
  background: #e7efff;
  color: #284c86;
}

.state-REFUSED {
  background: #fce8e5;
  color: #993d31;
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

.totals span,
.muted {
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

.correction-notice {
  border-color: #ead49b;
  background: #fff8e6;
  color: #694a13;
}

.correction-notice h2,
.review-panel h2,
.notes h2 {
  margin-top: 0;
  font-size: 1.2rem;
}

.preserve-text,
.notes p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
  min-width: 0;
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
  opacity: 1;
}

.day:not(:disabled):hover {
  outline: 2px solid #438660;
}

.day:focus-visible,
.button:focus-visible,
.back-link:focus-visible,
.correction-form textarea:focus-visible {
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

.notes,
.review-panel {
  padding: 20px;
  border: 1px solid #dce6df;
  border-radius: 14px;
  background: #fff;
}

.notes article + article {
  border-top: 1px solid #dce6df;
}

.correction-form {
  display: grid;
  gap: 12px;
}

.correction-form label {
  font-weight: 700;
}

.correction-form textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  border: 1px solid #b9ccbf;
  border-radius: 10px;
  background: #fff;
  color: #20392b;
  font: inherit;
  resize: vertical;
}

.correction-form p {
  margin: 0;
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