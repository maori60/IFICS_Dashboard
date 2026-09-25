<script setup lang="ts">
import type {
  ApiSuccess,
  SessionPayload,
} from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

useHead({
  title: 'Périodes & clôture',
})

type AccountingPeriodStatus =
  | 'OPEN'
  | 'REVIEW'
  | 'PRE_CLOSED'
  | 'CLOSED'

type FiscalYearStatus =
  | 'OPEN'
  | 'CLOSING'
  | 'CLOSED'

type AccountingPeriod = {
  id: string
  fiscalYearId: string
  number: number
  label: string
  startDate: string
  endDate: string
  status: AccountingPeriodStatus

  reviewStartedAt: string | null
  reviewStartedByUserId: string | null

  preClosedAt: string | null
  preClosedByUserId: string | null

  closedAt: string | null
  closedByUserId: string | null

  reopenedAt: string | null
  reopenedByUserId: string | null
  reopenReason: string | null

  closureChecklist: unknown
  lockVersion: number

  createdAt: string
  updatedAt: string
}

type FiscalYear = {
  id: string
  label: string
  startDate: string
  endDate: string
  status: FiscalYearStatus

  closingStartedAt: string | null
  closedAt: string | null
  closedByUserId: string | null

  reopenedAt: string | null
  reopenedByUserId: string | null
  reopenReason: string | null

  createdAt: string
  updatedAt: string

  periods: AccountingPeriod[]
}

type ChecklistStatus =
  | 'OK'
  | 'WARNING'
  | 'BLOCKER'

type AccountingTransitionAction =
  | 'START_REVIEW'
  | 'PRE_CLOSE'
  | 'CLOSE'
  | 'REOPEN'

type ChecklistItem = {
  code: string
  label: string
  status: ChecklistStatus
  count: number
  message: string
}

type PeriodChecklist = {
  period: {
    id: string
    label: string
    status: AccountingPeriodStatus
    startDate: string
    endDate: string
    lockVersion: number

    fiscalYear: {
      id: string
      label: string
      status: FiscalYearStatus
    }
  }

  metrics: {
    periodEnded: boolean
    draftInvoices: number
    draftExpenses: number
    submittedExpenses: number
    rejectedExpenses: number
    expensesWithoutAttachments: number
    outstandingInvoices: number
    outstandingInvoicesAmount: string
    approvedUnpaidExpenses: number
    approvedUnpaidExpensesAmount: string
  }

  readyForPreClose: boolean
  blockerCount: number
  warningCount: number
  items: ChecklistItem[]
  computedAt: string
}

const { data: me } = await useFetch<
  ApiSuccess<SessionPayload>
>(
  '/api/auth/me',
  {
    key: 'session-me',
  },
)

const {
  data: fiscalYearsResponse,
  error,
  status,
  refresh,
} = await useFetch<ApiSuccess<FiscalYear[]>>(
  '/api/accounting/fiscal-years',
)

const fiscalYears = computed(
  () => fiscalYearsResponse.value?.data ?? [],
)

const permissions = computed(
  () =>
    new Set(
      me.value?.data.user.permissions ?? [],
    ),
)

function can(permission: string): boolean {
  return permissions.value.has('*')
    || permissions.value.has(permission)
}

const selectedFiscalYearId = ref<string | null>(
  null,
)

watch(
  fiscalYears,
  (years) => {
    if (!years.length) {
      selectedFiscalYearId.value = null
      return
    }

    const stillExists
      = years.some(
        year =>
          year.id
          === selectedFiscalYearId.value,
      )

    if (!stillExists) {
      selectedFiscalYearId.value
        = years[0]!.id
    }
  },
  {
    immediate: true,
  },
)

const selectedFiscalYear = computed(
  () =>
    fiscalYears.value.find(
      year =>
        year.id
        === selectedFiscalYearId.value,
    ) ?? null,
)

function currentBusinessDateParts(): {
  year: number
  month: number
  day: number
} {
  const instant = new Date()

  const preferredTimeZone
    = me.value?.data.association?.timezone
      || 'Europe/Paris'

  let formatter:
    Intl.DateTimeFormat

  try {
    formatter
      = new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone:
            preferredTimeZone,

          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        },
      )
  }
  catch {
    formatter
      = new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone: 'Europe/Paris',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        },
      )
  }

  const parts
    = formatter.formatToParts(
      instant,
    )

  const value = (
    type: Intl.DateTimeFormatPartTypes,
  ): number =>
    Number(
      parts.find(
        part =>
          part.type === type,
      )?.value,
    )

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  }
}

const currentYear
  = currentBusinessDateParts().year

const creation = reactive({
  startDate: `${currentYear}-01-01`,
  label: '',
})

const creating = ref(false)
const creationError = ref('')
const creationSuccess = ref('')

const checklistPeriod
  = ref<AccountingPeriod | null>(null)

const checklist
  = ref<PeriodChecklist | null>(null)

const checklistLoading = ref(false)
const checklistError = ref('')

const transitionAction
  = ref<AccountingTransitionAction | null>(null)

const transitionLoading = ref(false)
const transitionError = ref('')
const transitionSuccess = ref('')
const reopenReason = ref('')

async function createFiscalYear() {
  creationError.value = ''
  creationSuccess.value = ''
  creating.value = true

  try {
    const response
      = await $fetch<ApiSuccess<FiscalYear>>(
        '/api/accounting/fiscal-years/create',
        {
          method: 'POST',

          body: {
            startDate:
              creation.startDate,

            label:
              creation.label.trim()
              || undefined,
          },
        },
      )

    creationSuccess.value
      = `L’exercice « ${response.data.label} » a été créé avec ses 12 périodes.`

    creation.label = ''

    await refresh()

    selectedFiscalYearId.value
      = response.data.id
  }
  catch (cause: unknown) {
    const candidate
      = cause as {
        data?: {
          statusMessage?: string
          message?: string
          data?: {
            code?: string
          }
        }

        statusMessage?: string
        message?: string
      }

    creationError.value
      = candidate.data?.statusMessage
      || candidate.data?.message
      || candidate.statusMessage
      || candidate.message
      || 'Impossible de créer l’exercice comptable.'
  }
  finally {
    creating.value = false
  }
}

async function loadChecklist(
  period: AccountingPeriod,
) {
  checklistPeriod.value = period
  checklist.value = null
  checklistError.value = ''
  checklistLoading.value = true

  try {
    const response
      = await $fetch<ApiSuccess<PeriodChecklist>>(
        `/api/accounting/periods/${period.id}/checklist`,
      )

    checklist.value = response.data
  }
  catch (cause: unknown) {
    const candidate
      = cause as {
        data?: {
          statusMessage?: string
          message?: string
        }

        statusMessage?: string
        message?: string
      }

    checklistError.value
      = candidate.data?.statusMessage
      || candidate.data?.message
      || candidate.statusMessage
      || candidate.message
      || 'Impossible de calculer la checklist de clôture.'
  }
  finally {
    checklistLoading.value = false
  }
}

function closeChecklist() {
  checklistPeriod.value = null
  checklist.value = null
  checklistError.value = ''

  transitionAction.value = null
  transitionError.value = ''
  transitionSuccess.value = ''
  reopenReason.value = ''
}

function checklistSummaryTitle(
  value: PeriodChecklist,
): string {
  switch (value.period.status) {
    case 'OPEN':
      return value.readyForPreClose
        ? 'Période prête pour le contrôle'
        : 'Pré-clôture impossible actuellement'

    case 'REVIEW':
      return value.readyForPreClose
        ? 'Contrôle en cours — prête pour la pré-clôture'
        : 'Contrôle en cours — corrections requises'

    case 'PRE_CLOSED':
      return 'Période pré-clôturée — données verrouillées'

    case 'CLOSED':
      return 'Période clôturée — données verrouillées'
  }
}

function checklistSummaryText(
  value: PeriodChecklist,
): string {
  if (value.period.status === 'PRE_CLOSED') {
    return 'Les données comptables de cette période sont verrouillées. Vous pouvez procéder à la clôture ou effectuer une réouverture exceptionnelle.'
  }

  if (value.period.status === 'CLOSED') {
    return 'Cette période est clôturée. Toute réouverture est exceptionnelle, motivée et tracée dans l’audit.'
  }

  if (
    value.blockerCount === 0
    && value.warningCount === 0
  ) {
    return value.period.status === 'OPEN'
      ? 'Aucun point bloquant. Le contrôle de clôture peut être démarré.'
      : 'Aucun point en attente. La période peut être pré-clôturée.'
  }

  const parts: string[] = []

  if (value.blockerCount > 0) {
    parts.push(
      value.blockerCount === 1
        ? '1 point bloquant'
        : `${value.blockerCount} points bloquants`,
    )
  }

  if (value.warningCount > 0) {
    parts.push(
      value.warningCount === 1
        ? '1 point d’attention'
        : `${value.warningCount} points d’attention`,
    )
  }

  return `${parts.join(' · ')}.`
}

function checklistSummaryClass(
  value: PeriodChecklist,
): string {
  if (
    value.period.status === 'PRE_CLOSED'
    || value.period.status === 'CLOSED'
  ) {
    return 'locked'
  }

  return value.readyForPreClose
    ? 'ready'
    : 'blocked'
}

function primaryTransitionAction():
  AccountingTransitionAction | null {
  const period
    = checklist.value?.period

  if (!period) {
    return null
  }

  if (
    period.status === 'OPEN'
    && can('accounting:period:manage')
  ) {
    return 'START_REVIEW'
  }

  if (
    period.status === 'REVIEW'
    && can('accounting:period:close')
  ) {
    return 'PRE_CLOSE'
  }

  if (
    period.status === 'PRE_CLOSED'
    && can('accounting:period:close')
  ) {
    return 'CLOSE'
  }

  return null
}

function canReopenPeriod(): boolean {
  const status
    = checklist.value?.period.status

  return (
    can('accounting:period:reopen')
    && (
      status === 'PRE_CLOSED'
      || status === 'CLOSED'
    )
  )
}

function transitionLabel(
  action: AccountingTransitionAction,
): string {
  return {
    START_REVIEW:
      'Démarrer le contrôle',

    PRE_CLOSE:
      'Pré-clôturer',

    CLOSE:
      'Clôturer',

    REOPEN:
      'Réouvrir',
  }[action]
}

function transitionTitle(
  action: AccountingTransitionAction,
): string {
  return {
    START_REVIEW:
      'Démarrer le contrôle de cette période ?',

    PRE_CLOSE:
      'Pré-clôturer cette période ?',

    CLOSE:
      'Clôturer définitivement cette période ?',

    REOPEN:
      'Réouvrir cette période ?',
  }[action]
}

function transitionDescription(
  action: AccountingTransitionAction,
): string {
  return {
    START_REVIEW:
      'La période passera en contrôle. Les données resteront modifiables pendant cette phase.',

    PRE_CLOSE:
      'Les données comptables de cette période seront verrouillées. Un nouveau contrôle sera réalisé par le serveur avant la transition.',

    CLOSE:
      'La période restera verrouillée et sera considérée comme clôturée. Toute réouverture sera exceptionnelle, motivée et auditée.',

    REOPEN:
      'La période repassera en contrôle. Cette opération est exceptionnelle et laissera une trace d’audit.',
  }[action]
}

function primaryTransitionDisabled(
  action: AccountingTransitionAction,
): boolean {
  if (!checklist.value) {
    return true
  }

  if (
    action === 'START_REVIEW'
  ) {
    return !checklist.value
      .metrics
      .periodEnded
  }

  if (
    action === 'PRE_CLOSE'
    || action === 'CLOSE'
  ) {
    return !checklist.value
      .readyForPreClose
  }

  return false
}

function requestTransition(
  action: AccountingTransitionAction,
) {
  transitionAction.value = action
  transitionError.value = ''
  transitionSuccess.value = ''
  reopenReason.value = ''
}

function cancelTransition() {
  transitionAction.value = null
  transitionError.value = ''
  reopenReason.value = ''
}

function transitionErrorMessage(
  cause: unknown,
): string {
  const candidate
    = cause as {
      data?: {
        statusMessage?: string
        message?: string

        data?: {
          message?: string
        }
      }

      statusMessage?: string
      message?: string
    }

  return (
    candidate.data?.message
    || candidate.data?.statusMessage
    || candidate.data?.data?.message
    || candidate.statusMessage
    || candidate.message
    || 'L’opération comptable a échoué.'
  )
}

async function executeTransition() {
  const action
    = transitionAction.value

  const currentChecklist
    = checklist.value

  const currentPeriod
    = checklistPeriod.value

  if (
    !action
    || !currentChecklist
    || !currentPeriod
  ) {
    return
  }

  const reason
    = reopenReason.value.trim()

  if (
    action === 'REOPEN'
    && reason.length < 10
  ) {
    transitionError.value
      = 'Le motif de réouverture doit contenir au moins 10 caractères.'

    return
  }

  transitionLoading.value = true
  transitionError.value = ''
  transitionSuccess.value = ''

  try {
    await $fetch(
      `/api/accounting/periods/${currentPeriod.id}/transition`,
      {
        method: 'POST',

        body: {
          action,

          lockVersion:
            currentChecklist
              .period
              .lockVersion,

          confirmed:
            true,

          ...(action === 'REOPEN'
            ? {
                reason,
              }
            : {}),
        },
      },
    )

    const successMessage = {
      START_REVIEW:
        'Le contrôle de la période a été démarré.',

      PRE_CLOSE:
        'La période a été pré-clôturée et ses données comptables sont maintenant verrouillées.',

      CLOSE:
        'La période a été clôturée.',

      REOPEN:
        'La période a été réouverte et replacée en contrôle.',
    }[action]

    transitionAction.value = null
    reopenReason.value = ''

    await refresh()

    const freshPeriod
      = fiscalYears.value
        .flatMap(
          year =>
            year.periods,
        )
        .find(
          period =>
            period.id
            === currentPeriod.id,
        )

    if (!freshPeriod) {
      closeChecklist()
      return
    }

    checklistPeriod.value
      = freshPeriod

    await loadChecklist(
      freshPeriod,
    )

    transitionSuccess.value
      = successMessage
  }
  catch (cause: unknown) {
    transitionError.value
      = transitionErrorMessage(
        cause,
      )
  }
  finally {
    transitionLoading.value = false
  }
}

function checklistStatusLabel(
  value: ChecklistStatus,
): string {
  return {
    OK: 'Conforme',
    WARNING: 'Attention',
    BLOCKER: 'Bloquant',
  }[value]
}

function checklistStatusClass(
  value: ChecklistStatus,
): string {
  return {
    OK: 'check-ok',
    WARNING: 'check-warning',
    BLOCKER: 'check-blocker',
  }[value]
}

function dateLabel(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle: 'medium',
      timeZone: 'UTC',
    },
  ).format(
    new Date(value),
  )
}

function statusLabel(
  value: AccountingPeriodStatus,
): string {
  return {
    OPEN: 'Ouverte',
    REVIEW: 'En contrôle',
    PRE_CLOSED: 'Pré-clôturée',
    CLOSED: 'Clôturée',
  }[value]
}

function fiscalYearStatusLabel(
  value: FiscalYearStatus,
): string {
  return {
    OPEN: 'Ouvert',
    CLOSING: 'En clôture',
    CLOSED: 'Clôturé',
  }[value]
}

function periodStatusClass(
  value: AccountingPeriodStatus,
): string {
  return {
    OPEN: 'status-open',
    REVIEW: 'status-review',
    PRE_CLOSED: 'status-preclosed',
    CLOSED: 'status-closed',
  }[value]
}

function yearStatusClass(
  value: FiscalYearStatus,
): string {
  return {
    OPEN: 'status-open',
    CLOSING: 'status-review',
    CLOSED: 'status-closed',
  }[value]
}

function isCurrentPeriod(
  period: AccountingPeriod,
): boolean {
  const current
    = currentBusinessDateParts()

  const businessDate
    = new Date(
      Date.UTC(
        current.year,
        current.month - 1,
        current.day,
      ),
    )

  return (
    businessDate
      >= new Date(period.startDate)
    && businessDate
      <= new Date(period.endDate)
  )
}

const selectedStats = computed(() => {
  const periods
    = selectedFiscalYear.value?.periods ?? []

  return {
    open:
      periods.filter(
        period =>
          period.status === 'OPEN',
      ).length,

    review:
      periods.filter(
        period =>
          period.status === 'REVIEW',
      ).length,

    preClosed:
      periods.filter(
        period =>
          period.status === 'PRE_CLOSED',
      ).length,

    closed:
      periods.filter(
        period =>
          period.status === 'CLOSED',
      ).length,
  }
})

const completionPercent = computed(() => {
  const periods
    = selectedFiscalYear.value?.periods ?? []

  if (!periods.length) {
    return 0
  }

  const closed
    = periods.filter(
      period =>
        period.status === 'CLOSED',
    ).length

  return Math.round(
    closed / periods.length * 100,
  )
})
</script>

<template>
  <div class="accounting-periods">
    <header class="page-head">
      <div>
        <p class="eyebrow">
          Finances & comptabilité
        </p>

        <h1>
          Périodes & clôture
        </h1>

        <p class="page-description">
          Gérez les exercices comptables,
          leurs périodes mensuelles et leur
          état de clôture.
        </p>
      </div>

      <div class="head-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="status === 'pending'"
          @click="refresh()"
        >
          {{
            status === 'pending'
              ? 'Actualisation…'
              : 'Actualiser'
          }}
        </button>
      </div>
    </header>

    <div
      v-if="error"
      class="feedback feedback-error"
    >
      Impossible de charger les exercices comptables.
    </div>

    <section
      v-if="can('accounting:period:manage')"
      class="panel creation-panel"
    >
      <div class="panel-heading">
        <div>
          <span class="panel-kicker">
            Nouvel exercice
          </span>

          <h2>
            Créer un exercice comptable
          </h2>
        </div>
      </div>

      <form
        class="creation-form"
        @submit.prevent="createFiscalYear"
      >
        <div class="field">
          <label for="fiscal-year-start">
            Date de début
          </label>

          <input
            id="fiscal-year-start"
            v-model="creation.startDate"
            type="date"
            required
          >

          <small>
            L’exercice doit commencer
            le premier jour d’un mois.
          </small>
        </div>

        <div class="field">
          <label for="fiscal-year-label">
            Libellé personnalisé
          </label>

          <input
            id="fiscal-year-label"
            v-model="creation.label"
            type="text"
            maxlength="80"
            placeholder="Exercice 2026"
          >

          <small>
            Facultatif. Un libellé sera
            généré automatiquement.
          </small>
        </div>

        <div class="creation-action">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="creating"
          >
            {{
              creating
                ? 'Création…'
                : 'Créer l’exercice'
            }}
          </button>
        </div>
      </form>

      <div
        v-if="creationError"
        class="feedback feedback-error"
      >
        {{ creationError }}
      </div>

      <div
        v-if="creationSuccess"
        class="feedback feedback-success"
      >
        {{ creationSuccess }}
      </div>
    </section>

    <div
      v-if="status === 'pending' && !fiscalYears.length"
      class="loading-state"
    >
      Chargement des périodes comptables…
    </div>

    <section
      v-else-if="!fiscalYears.length"
      class="empty-state"
    >
      <div class="empty-icon">
        12
      </div>

      <h2>
        Aucun exercice comptable
      </h2>

      <p>
        Créez votre premier exercice.
        IFICS générera automatiquement
        ses douze périodes mensuelles.
      </p>
    </section>

    <template v-else>
      <section class="year-selector">
        <label for="year-select">
          Exercice affiché
        </label>

        <select
          id="year-select"
          v-model="selectedFiscalYearId"
        >
          <option
            v-for="year in fiscalYears"
            :key="year.id"
            :value="year.id"
          >
            {{ year.label }}
          </option>
        </select>
      </section>

      <template v-if="selectedFiscalYear">
        <section class="year-summary">
          <div class="year-title">
            <div>
              <div class="year-title-line">
                <h2>
                  {{ selectedFiscalYear.label }}
                </h2>

                <span
                  class="status-badge"
                  :class="
                    yearStatusClass(
                      selectedFiscalYear.status,
                    )
                  "
                >
                  {{
                    fiscalYearStatusLabel(
                      selectedFiscalYear.status,
                    )
                  }}
                </span>
              </div>

              <p>
                {{
                  dateLabel(
                    selectedFiscalYear.startDate,
                  )
                }}
                →
                {{
                  dateLabel(
                    selectedFiscalYear.endDate,
                  )
                }}
              </p>
            </div>

            <div class="completion">
              <strong>
                {{ completionPercent }} %
              </strong>

              <span>
                de l’exercice clôturé
              </span>
            </div>
          </div>

          <div class="progress-track">
            <div
              class="progress-value"
              :style="{
                width:
                  `${completionPercent}%`,
              }"
            />
          </div>

          <div class="summary-grid">
            <article>
              <span>Ouvertes</span>
              <strong>
                {{ selectedStats.open }}
              </strong>
            </article>

            <article>
              <span>En contrôle</span>
              <strong>
                {{ selectedStats.review }}
              </strong>
            </article>

            <article>
              <span>Pré-clôturées</span>
              <strong>
                {{ selectedStats.preClosed }}
              </strong>
            </article>

            <article>
              <span>Clôturées</span>
              <strong>
                {{ selectedStats.closed }}
              </strong>
            </article>
          </div>
        </section>

        <section class="periods-section">
          <div class="section-heading">
            <div>
              <p class="eyebrow">
                Périodes
              </p>

              <h2>
                Les 12 mois de l’exercice
              </h2>
            </div>

            <span class="period-count">
              {{
                selectedFiscalYear.periods.length
              }}
              {{
                selectedFiscalYear.periods.length === 1
                  ? 'période'
                  : 'périodes'
              }}
            </span>
          </div>

          <div class="period-grid">
            <article
              v-for="period in selectedFiscalYear.periods"
              :key="period.id"
              class="period-card"
              :class="{
                current:
                  isCurrentPeriod(period),
              }"
            >
              <div class="period-top">
                <div>
                  <small>
                    Période {{ period.number }}
                  </small>

                  <h3>
                    {{ period.label }}
                  </h3>
                </div>

                <span
                  class="status-badge"
                  :class="
                    periodStatusClass(
                      period.status,
                    )
                  "
                >
                  {{
                    statusLabel(
                      period.status,
                    )
                  }}
                </span>
              </div>

              <div
                v-if="isCurrentPeriod(period)"
                class="current-marker"
              >
                Période courante
              </div>

              <div class="period-dates">
                <span>
                  Du
                  {{ dateLabel(period.startDate) }}
                </span>

                <span>
                  au
                  {{ dateLabel(period.endDate) }}
                </span>
              </div>

              <div class="period-footer">
                <span
                  v-if="
                    period.status === 'PRE_CLOSED'
                    || period.status === 'CLOSED'
                  "
                  class="lock-state locked"
                >
                  Verrouillée
                </span>

                <span
                  v-else
                  class="lock-state"
                >
                  Données modifiables
                </span>

                <button
                  type="button"
                  class="period-control"
                  @click="loadChecklist(period)"
                >
                  Contrôler
                </button>
              </div>
            </article>
          </div>
        </section>

        <Teleport to="body">
          <div
            v-if="checklistPeriod"
            class="checklist-overlay"
            role="presentation"
            @click.self="closeChecklist"
          >
            <section
              class="checklist-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checklist-title"
            >
              <header class="checklist-head">
                <div>
                  <p class="eyebrow">
                    Préparation de clôture
                  </p>

                  <h2 id="checklist-title">
                    {{ checklistPeriod.label }}
                  </h2>

                  <p>
                    {{
                      dateLabel(
                        checklistPeriod.startDate,
                      )
                    }}
                    →
                    {{
                      dateLabel(
                        checklistPeriod.endDate,
                      )
                    }}
                  </p>
                </div>

                <button
                  type="button"
                  class="dialog-close"
                  aria-label="Fermer"
                  @click="closeChecklist"
                >
                  ×
                </button>
              </header>

              <div
                v-if="checklistLoading"
                class="checklist-loading"
              >
                Analyse de la période en cours…
              </div>

              <div
                v-else-if="checklistError"
                class="feedback feedback-error"
              >
                {{ checklistError }}

                <button
                  type="button"
                  class="retry-button"
                  @click="
                    checklistPeriod
                      && loadChecklist(
                        checklistPeriod,
                      )
                  "
                >
                  Réessayer
                </button>
              </div>

              <template v-else-if="checklist">
                <div
                  class="checklist-summary"
                  :class="
                    checklistSummaryClass(
                      checklist,
                    )
                  "
                >
                  <div>
                    <strong>
                      {{
                        checklistSummaryTitle(
                          checklist,
                        )
                      }}
                    </strong>

                    <p>
                      {{
                        checklistSummaryText(
                          checklist,
                        )
                      }}
                    </p>
                  </div>
                </div>

                <div class="checklist-items">
                  <article
                    v-for="item in checklist.items"
                    :key="item.code"
                    class="checklist-item"
                  >
                    <div
                      class="check-indicator"
                      :class="
                        checklistStatusClass(
                          item.status,
                        )
                      "
                    >
                      {{
                        item.status === 'OK'
                          ? '✓'
                          : item.status === 'WARNING'
                            ? '!'
                            : '×'
                      }}
                    </div>

                    <div class="check-content">
                      <div class="check-title">
                        <strong>
                          {{ item.label }}
                        </strong>

                        <span
                          class="check-badge"
                          :class="
                            checklistStatusClass(
                              item.status,
                            )
                          "
                        >
                          {{
                            checklistStatusLabel(
                              item.status,
                            )
                          }}
                        </span>
                      </div>

                      <p>
                        {{ item.message }}
                      </p>
                    </div>
                  </article>
                </div>

                <div
                  v-if="transitionSuccess"
                  class="feedback feedback-success"
                >
                  {{ transitionSuccess }}
                </div>

                <div
                  v-if="transitionError"
                  class="feedback feedback-error"
                >
                  {{ transitionError }}
                </div>

                <section
                  v-if="transitionAction"
                  class="transition-confirmation"
                >
                  <strong>
                    {{
                      transitionTitle(
                        transitionAction,
                      )
                    }}
                  </strong>

                  <p>
                    {{
                      transitionDescription(
                        transitionAction,
                      )
                    }}
                  </p>

                  <div
                    v-if="
                      transitionAction
                      === 'REOPEN'
                    "
                    class="field reopen-field"
                  >
                    <label for="reopen-reason">
                      Motif de réouverture
                    </label>

                    <textarea
                      id="reopen-reason"
                      v-model="reopenReason"
                      rows="3"
                      maxlength="1000"
                      placeholder="Expliquez précisément pourquoi cette période doit être réouverte."
                    />

                    <small>
                      10 caractères minimum.
                      Cette justification sera conservée
                      dans la traçabilité comptable.
                    </small>
                  </div>

                  <div class="confirmation-actions">
                    <button
                      type="button"
                      class="btn btn-secondary"
                      :disabled="transitionLoading"
                      @click="cancelTransition"
                    >
                      Annuler
                    </button>

                    <button
                      type="button"
                      class="btn btn-primary"
                      :disabled="
                        transitionLoading
                        || (
                          transitionAction === 'REOPEN'
                          && reopenReason.trim().length < 10
                        )
                      "
                      @click="executeTransition"
                    >
                      {{
                        transitionLoading
                          ? 'Traitement…'
                          : `Confirmer : ${
                              transitionLabel(
                                transitionAction,
                              )
                            }`
                      }}
                    </button>
                  </div>
                </section>

                <div class="checklist-action-zone">
                  <footer class="checklist-footer">
                    <div>
                      <small>
                        Contrôle recalculé le
                        {{
                          new Intl.DateTimeFormat(
                            'fr-FR',
                            {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            },
                          ).format(
                            new Date(
                              checklist.computedAt,
                            ),
                          )
                        }}
                      </small>
                    </div>

                    <div class="checklist-actions">
                      <button
                        type="button"
                        class="btn btn-secondary"
                        :disabled="
                          checklistLoading
                          || transitionLoading
                        "
                        @click="
                          loadChecklist(
                            checklistPeriod,
                          )
                        "
                      >
                        Recalculer
                      </button>

                      <button
                        v-if="canReopenPeriod()"
                        type="button"
                        class="btn btn-secondary"
                        :disabled="
                          transitionLoading
                          || Boolean(
                            transitionAction,
                          )
                        "
                        @click="
                          requestTransition(
                            'REOPEN',
                          )
                        "
                      >
                        Réouvrir
                      </button>

                      <button
                        v-if="
                          primaryTransitionAction()
                        "
                        type="button"
                        class="btn btn-primary"
                        :disabled="
                          transitionLoading
                          || Boolean(
                            transitionAction,
                          )
                          || primaryTransitionDisabled(
                            primaryTransitionAction()!,
                          )
                        "
                        @click="
                          requestTransition(
                            primaryTransitionAction()!,
                          )
                        "
                      >
                        {{
                          transitionLabel(
                            primaryTransitionAction()!,
                          )
                        }}
                      </button>
                    </div>
                  </footer>

                  <p
                    v-if="
                      primaryTransitionAction()
                      && primaryTransitionDisabled(
                        primaryTransitionAction()!,
                      )
                    "
                    class="disabled-explanation"
                  >
                    <template
                      v-if="
                        primaryTransitionAction()
                        === 'START_REVIEW'
                      "
                    >
                      Le contrôle pourra être démarré
                      après la fin de la période.
                    </template>

                    <template v-else>
                      Corrigez les points bloquants
                      avant de poursuivre le cycle
                      de clôture.
                    </template>
                  </p>
                </div>
              </template>
            </section>
          </div>
        </Teleport>

        <section class="closure-info">
          <div class="closure-icon">
            ✓
          </div>

          <div>
            <strong>
              Cycle de clôture sécurisé
            </strong>

            <p>
              Une période passera successivement
              de Ouverte à En contrôle,
              Pré-clôturée puis Clôturée.
              La pré-clôture et la clôture
              verrouilleront les données comptables
              de la période.
            </p>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.accounting-periods {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.page-head h1 {
  margin: 3px 0 7px;
  font-size: clamp(2rem, 3vw, 2.6rem);
  letter-spacing: -.035em;
}

.page-description {
  margin: 0;
  color: var(--ifics-muted);
  line-height: 1.55;
}

.eyebrow {
  margin: 0;
  color: var(--ifics-green-700);
  font-size: .72rem;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.panel {
  padding: 22px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 16px;
}

.panel-heading {
  margin-bottom: 18px;
}

.panel-heading h2 {
  margin: 3px 0 0;
  font-size: 1.2rem;
}

.panel-kicker {
  color: var(--ifics-muted);
  font-size: .7rem;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.creation-form {
  display: grid;
  grid-template-columns:
    minmax(220px, .7fr)
    minmax(280px, 1fr)
    auto;
  align-items: end;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field label,
.year-selector label {
  font-size: .78rem;
  font-weight: 800;
}

.field input,
.year-selector select {
  width: 100%;
  min-height: 42px;
  padding: 9px 11px;
  border: 1px solid var(--ifics-border);
  border-radius: 9px;
  background: #fff;
  color: inherit;
  font: inherit;
}

.field small {
  color: var(--ifics-muted);
  font-size: .7rem;
}

.feedback {
  margin-top: 15px;
  padding: 11px 13px;
  border-radius: 9px;
  font-size: .82rem;
}

.feedback-error {
  background: #fff0ed;
  color: #953c31;
  border: 1px solid #e9b8b1;
}

.feedback-success {
  background: #eef9f2;
  color: #246347;
  border: 1px solid #c8e2d2;
}

.loading-state,
.empty-state {
  min-height: 230px;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--ifics-muted);
}

.empty-state {
  align-content: center;
  gap: 8px;
  padding: 40px;
  background: #fff;
  border: 1px dashed var(--ifics-border);
  border-radius: 16px;
}

.empty-state h2,
.empty-state p {
  margin: 0;
}

.empty-state p {
  max-width: 520px;
}

.empty-icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  margin-bottom: 5px;
  border-radius: 14px;
  background: #eaf4ee;
  color: var(--ifics-green-700);
  font-weight: 900;
}

.year-selector {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.year-summary {
  padding: 22px;
  background:
    linear-gradient(
      145deg,
      #153e2d,
      #1e563c
    );
  color: #fff;
  border-radius: 17px;
}

.year-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.year-title-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.year-title h2 {
  margin: 0;
  color: #fff;
  font-size: 1.5rem;
}

.year-title p {
  margin: 6px 0 0;
  color: #c7dbcf;
  font-size: .82rem;
}

.completion {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.completion strong {
  font-size: 1.35rem;
}

.completion span {
  color: #c7dbcf;
  font-size: .7rem;
}

.progress-track {
  height: 7px;
  margin: 20px 0;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, .15);
}

.progress-value {
  height: 100%;
  border-radius: inherit;
  background: #d3eadb;
  transition: width .25s ease;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.summary-grid article {
  padding: 12px;
  background: rgba(255, 255, 255, .08);
  border-radius: 10px;
}

.summary-grid span {
  display: block;
  color: #c7dbcf;
  font-size: .68rem;
}

.summary-grid strong {
  display: block;
  margin-top: 4px;
  font-size: 1.25rem;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 15px;
}

.section-heading h2 {
  margin: 3px 0 0;
  font-size: 1.3rem;
}

.period-count {
  color: var(--ifics-muted);
  font-size: .76rem;
}

.period-grid {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.period-card {
  min-width: 0;
  padding: 17px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 14px;
}

.period-card.current {
  border-color: #78a98a;
  box-shadow:
    0 0 0 2px rgba(49, 112, 77, .08);
}

.period-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.period-top small {
  color: var(--ifics-muted);
  font-size: .66rem;
}

.period-top h3 {
  margin: 3px 0 0;
  font-size: 1rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: .64rem;
  font-weight: 900;
}

.status-open {
  background: #eaf7ef;
  color: #246347;
}

.status-review {
  background: #fff5dd;
  color: #815d18;
}

.status-preclosed {
  background: #edf2f8;
  color: #445c77;
}

.status-closed {
  background: #e8ecea;
  color: #35423a;
}

.current-marker {
  display: inline-flex;
  margin-top: 12px;
  padding: 4px 7px;
  background: #edf7f1;
  border-radius: 6px;
  color: #2f6c4d;
  font-size: .64rem;
  font-weight: 900;
}

.period-dates {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 16px;
  color: var(--ifics-muted);
  font-size: .72rem;
}

.period-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #edf1ee;
  color: var(--ifics-muted);
  font-size: .66rem;
}

.lock-state {
  color: #367354;
  font-weight: 800;
}

.lock-state.locked {
  color: #665d4f;
}

.closure-info {
  display: flex;
  gap: 14px;
  padding: 18px;
  background: #f1f6f3;
  border: 1px solid #d6e3db;
  border-radius: 14px;
}

.closure-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #dbece2;
  color: #266448;
  font-weight: 900;
}

.closure-info p {
  margin: 4px 0 0;
  color: var(--ifics-muted);
  font-size: .79rem;
  line-height: 1.5;
}

.period-control {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ifics-green-700);
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.period-control:hover {
  text-decoration: underline;
}

.checklist-overlay {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 33, 24, .55);
  backdrop-filter: blur(3px);
}

.checklist-dialog {
  width: min(720px, 100%);
  max-height: min(820px, calc(100vh - 48px));
  overflow: auto;
  padding: 24px;
  background: #fff;
  border-radius: 18px;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, .25);
}

.checklist-head {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--ifics-border);
}

.checklist-head h2 {
  margin: 4px 0;
  font-size: 1.45rem;
}

.checklist-head p:last-child {
  margin: 0;
  color: var(--ifics-muted);
  font-size: .78rem;
}

.dialog-close {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid var(--ifics-border);
  border-radius: 9px;
  background: #fff;
  cursor: pointer;
  color: #445048;
  font-size: 1.35rem;
  line-height: 1;
}

.checklist-loading {
  padding: 50px 10px;
  text-align: center;
  color: var(--ifics-muted);
}

.checklist-summary {
  margin-top: 18px;
  padding: 15px 17px;
  border-radius: 12px;
}

.checklist-summary.ready {
  background: #eef8f2;
  border: 1px solid #cce3d4;
  color: #245e43;
}

.checklist-summary.blocked {
  background: #fff1ee;
  border: 1px solid #ecc7bf;
  color: #843d34;
}

.checklist-summary.locked {
  background: #f1f5f3;
  border: 1px solid #ced8d2;
  color: #2f5142;
}

.checklist-summary p {
  margin: 4px 0 0;
  font-size: .78rem;
}

.checklist-items {
  display: flex;
  flex-direction: column;
  margin-top: 15px;
  border: 1px solid var(--ifics-border);
  border-radius: 13px;
  overflow: hidden;
}

.checklist-item {
  display: flex;
  gap: 13px;
  padding: 15px;
  background: #fff;
}

.checklist-item + .checklist-item {
  border-top: 1px solid #edf1ee;
}

.check-indicator {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  font-weight: 900;
}

.check-content {
  min-width: 0;
  flex: 1;
}

.check-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.check-content p {
  margin: 5px 0 0;
  color: var(--ifics-muted);
  font-size: .76rem;
  line-height: 1.45;
}

.check-badge {
  padding: 4px 7px;
  border-radius: 999px;
  font-size: .62rem;
  font-weight: 900;
}

.check-ok {
  background: #e8f6ed;
  color: #236346;
}

.check-warning {
  background: #fff3d9;
  color: #7d5915;
}

.check-blocker {
  background: #fdecea;
  color: #923e35;
}

.transition-confirmation {
  margin-top: 18px;
  padding: 17px;
  border: 1px solid #d7dfda;
  border-radius: 12px;
  background: #f7faf8;
}

.transition-confirmation > p {
  margin: 6px 0 0;
  color: var(--ifics-muted);
  font-size: .78rem;
  line-height: 1.5;
}

.reopen-field {
  margin-top: 15px;
}

.reopen-field textarea {
  width: 100%;
  resize: vertical;
  padding: 10px 11px;
  border: 1px solid var(--ifics-border);
  border-radius: 9px;
  background: #fff;
  color: inherit;
  font: inherit;
}

.confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 15px;
}

.checklist-action-zone {
  position: sticky;
  bottom: -24px;
  z-index: 3;
  margin: 18px -24px -24px;
  padding: 15px 24px 20px;
  border-top: 1px solid var(--ifics-border);
  background: rgba(255, 255, 255, .97);
  backdrop-filter: blur(6px);
}

.checklist-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}

.checklist-footer small,
.disabled-explanation {
  color: var(--ifics-muted);
}

.checklist-actions {
  display: flex;
  gap: 9px;
}

.disabled-explanation {
  margin: 10px 0 0;
  text-align: right;
  font-size: .68rem;
}

.retry-button {
  margin-left: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-weight: 900;
  text-decoration: underline;
}

@media (max-width: 1250px) {
  .period-grid {
    grid-template-columns:
      repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .page-head,
  .year-title {
    flex-direction: column;
  }

  .creation-form,
  .summary-grid,
  .period-grid {
    grid-template-columns: 1fr;
  }

  .completion {
    text-align: left;
  }

  .year-title-line {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
