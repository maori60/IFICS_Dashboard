<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'
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

type CraWritableDayType =
  | 'WORK'
  | 'PAID_LEAVE'
  | 'RTT'
  | 'SICK_LEAVE'
  | 'AUTHORIZED_ABSENCE'
  | 'UNJUSTIFIED_ABSENCE'
  | 'TRAINING'
  | 'OTHER'

type CraDayType = CraWritableDayType | 'PUBLIC_HOLIDAY'

type CraDay = {
  id: string
  date: string
  dayType: CraDayType
  durationMinutes: number
  hours: number
  comment: string | null
  hasIncident: boolean
  incident: string | null
}

type CraOfficialDocumentStatus =
  | 'GENERATED'
  | 'SENT_TO_INTERVENOR'
  | 'RECEIVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED'

type CraOfficialDocument = {
  id: string
  type: 'IFICS_TO_SIGN'
  status: CraOfficialDocumentStatus
  version: number
  reportRevision: number
  reference: string
  ificsVisaDate: string | null
  intervenorSignatureDate: string | null
  createdAt: string
  sentToIntervenorAt: string | null
}

type CraPeriodPolicy = {
  periodEnd: string
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
  declaredDays: number
  totalDays: number
  totalMinutes: number
  totalHours: number
  workedDays: number
  workedMinutes: number
  trainingDays: number
  trainingMinutes: number
  trainingHours: number
  absenceDays: number
  paidLeaveDays: number
  rttDays: number
  sickLeaveDays: number
  authorizedAbsenceDays: number
  unjustifiedAbsenceDays: number
  otherAbsenceDays: number
  publicHolidayDays: number
  project: { id: string; title: string; reference: string | null }
  intervenor: { id: string; firstName: string; lastName: string }
  officialDocument: CraOfficialDocument | null
  periodPolicy: CraPeriodPolicy
  days: CraDay[]
}

const dayTypeLabels: Record<CraDayType, string> = {
  WORK: 'Travail',
  PAID_LEAVE: 'Congé payé',
  RTT: 'RTT',
  SICK_LEAVE: 'Maladie',
  AUTHORIZED_ABSENCE: 'Absence autorisée',
  UNJUSTIFIED_ABSENCE: 'Absence injustifiée',
  TRAINING: 'Formation',
  PUBLIC_HOLIDAY: 'Jour férié',
  OTHER: 'Autre',
}

const writableDayTypes: Array<{
  value: CraWritableDayType
  label: string
}> = [
  { value: 'WORK', label: 'Travail' },
  { value: 'PAID_LEAVE', label: 'Congé payé' },
  { value: 'RTT', label: 'RTT' },
  { value: 'SICK_LEAVE', label: 'Maladie' },
  { value: 'TRAINING', label: 'Formation' },
  { value: 'AUTHORIZED_ABSENCE', label: 'Absence autorisée' },
  { value: 'UNJUSTIFIED_ABSENCE', label: 'Absence injustifiée' },
  { value: 'OTHER', label: 'Autre' },
]

const statusLabels: Record<CraStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'À vérifier par IFICS',
  REVIEWED: 'Vérifié par IFICS',
  CLIENT_PENDING: 'En attente du client',
  VALIDATED: 'Validé',
  REFUSED: 'À corriger',
}

const officialDocumentStatusLabels:
Record<CraOfficialDocumentStatus, string> = {
  GENERATED: 'Généré',
  SENT_TO_INTERVENOR: 'Envoyé à l’intervenant',
  RECEIVED: 'Document signé reçu',
  APPROVED: 'Approuvé',
  REJECTED: 'Rejeté',
  SUPERSEDED: 'Remplacé',
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

const showGenerationForm = ref(false)
const generationIficsVisaDate = ref('')
const generationIntervenorSignatureDate = ref('')

const showDayEditor = ref(false)
const dayEditorDate = ref('')
const dayEditorType = ref<CraWritableDayType>('WORK')
const dayEditorHours = ref(7)
const dayEditorMinutes = ref(0)

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

const canGenerateOfficial = computed(() =>
  reportReady.value
  && report.value?.status === 'REVIEWED'
  && hasPermission('cra:read:all')
  && hasPermission('cra:manage'),
)

const canViewOfficialDocumentPanel = computed(() =>
  reportReady.value
  && hasPermission('cra:read:all')
  && Boolean(
    report.value
    && (
      report.value.status === 'REVIEWED'
      || report.value.officialDocument
    ),
  ),
)

const officialDocumentViewUrl = computed(() => {
  const documentId = report.value?.officialDocument?.id

  return documentId
    ? `${reportUrl}/documents/${encodeURIComponent(documentId)}`
    : ''
})

const officialDocumentDownloadUrl = computed(() => {
  const url = officialDocumentViewUrl.value

  return url ? `${url}?download=1` : ''
})

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
      return 'IFICS a vérifié ce CRA. Il est prêt pour la génération du document officiel à faire signer par l’intervenant ; les journées restent verrouillées.'
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

const canSubmit = computed(() => {
  const current = report.value

  return Boolean(
    current
    && canEdit.value
    && calendarAvailable.value
    && current.declaredDays > 0,
  )
})

const generationDatesValid = computed(() =>
  /^\d{4}-\d{2}-\d{2}$/.test(
    generationIficsVisaDate.value,
  )
  && /^\d{4}-\d{2}-\d{2}$/.test(
    generationIntervenorSignatureDate.value,
  ),
)

const selectedDays = computed(() =>
  new Map(report.value?.days.map(day => [day.date, day]) ?? []),
)

const dayEditorExisting = computed(() =>
  Boolean(
    dayEditorDate.value
    && selectedDays.value.has(dayEditorDate.value),
  ),
)

const dayEditorDurationMinutes = computed(() => {
  const hours = Number(dayEditorHours.value)
  const minutes = Number(dayEditorMinutes.value)

  if (
    !Number.isSafeInteger(hours)
    || !Number.isSafeInteger(minutes)
    || hours < 0
    || hours > 12
    || minutes < 0
    || minutes > 59
  ) return null

  const total = hours * 60 + minutes

  return total >= 1 && total <= 720 ? total : null
})

const absenceItems = computed(() => {
  const current = report.value

  if (!current) return []

  return [
    { label: 'Congés payés', count: current.paidLeaveDays },
    { label: 'RTT', count: current.rttDays },
    { label: 'Maladie', count: current.sickLeaveDays },
    { label: 'Absences autorisées', count: current.authorizedAbsenceDays },
    { label: 'Absences injustifiées', count: current.unjustifiedAbsenceDays },
    { label: 'Autres absences', count: current.otherAbsenceDays },
  ].filter(item => item.count > 0)
})

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

function formatMinutes(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60

  if (!minutes) return `${hours} h`
  if (!hours) return `${minutes} min`

  return `${hours} h ${String(minutes).padStart(2, '0')}`
}

function dayDateLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const date = new Date(`${value}T00:00:00.000Z`)

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(date)
}

function isoDateLabel(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '—'
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeZone: 'UTC',
  }).format(date)
}

function dayTypeClass(date: string): string {
  const day = selectedDays.value.get(date)

  return day ? `type-${day.dayType.toLowerCase()}` : ''
}

function calendarDaySummary(date: string): string {
  const day = selectedDays.value.get(date)

  if (!day) return '—'

  return `${dayTypeLabels[day.dayType]} · ${formatMinutes(day.durationMinutes)}`
}

function calendarDayAriaLabel(
  date: string,
  number: number,
  weekend: boolean,
  holiday: string | null,
): string {
  if (holiday) return `${number} ${period.value}, ${holiday}`
  if (weekend) return `${number} ${period.value}, week-end`

  const day = selectedDays.value.get(date)

  if (!day) return `${number} ${period.value}, non déclaré`

  return `${number} ${period.value}, ${dayTypeLabels[day.dayType]}, ${formatMinutes(day.durationMinutes)}`
}

useHead({
  title: computed(() => `CRA — ${period.value} — IFICS`),
})

const weekdays = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']

const calendar = computed(() => {
  const current = report.value

  if (!current) return []

  const { year, month } = current
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

function openDayEditor(date: string) {
  const current = report.value

  if (
    !current
    || !canEdit.value
    || !calendarAvailable.value
    || busy.value
  ) return

  const cell = calendar.value.find(day => day?.iso === date)

  if (
    !cell
    || cell.weekend
    || cell.holiday
  ) return

  const existing = selectedDays.value.get(date)

  dayEditorDate.value = date

  if (existing) {
    dayEditorType.value = existing.dayType === 'PUBLIC_HOLIDAY'
      ? 'WORK'
      : existing.dayType

    dayEditorHours.value = Math.floor(existing.durationMinutes / 60)
    dayEditorMinutes.value = existing.durationMinutes % 60
  }
  else {
    dayEditorType.value = 'WORK'
    dayEditorHours.value = 7
    dayEditorMinutes.value = 0
  }

  actionError.value = ''
  feedback.value = ''
  showDayEditor.value = true
}

function closeDayEditor() {
  if (busy.value) return

  showDayEditor.value = false
  dayEditorDate.value = ''
  dayEditorType.value = 'WORK'
  dayEditorHours.value = 7
  dayEditorMinutes.value = 0
}

async function saveDayEntry() {
  const current = report.value
  const durationMinutes = dayEditorDurationMinutes.value

  if (
    !current
    || !canEdit.value
    || !dayEditorDate.value
    || busy.value
  ) return

  if (durationMinutes === null) {
    actionError.value = 'La durée doit être comprise entre 1 minute et 12 heures.'
    return
  }

  const succeeded = await saveAction(
    `${reportUrl}/day`,
    'PUT',
    {
      date: dayEditorDate.value,
      selected: true,
      revision: current.revision,
      dayType: dayEditorType.value,
      durationMinutes,
    },
    `${dayTypeLabels[dayEditorType.value]} enregistré : ${formatMinutes(durationMinutes)}.`,
    'edit',
  )

  if (succeeded) closeDayEditor()
}

async function removeDayEntry() {
  const current = report.value
  const date = dayEditorDate.value
  const day = selectedDays.value.get(date)

  if (
    !current
    || !canEdit.value
    || !date
    || !day
    || busy.value
  ) return

  const warning = day.comment || day.hasIncident
    ? 'Retirer cette journée supprimera aussi son commentaire et son incident. Continuer ?'
    : `Retirer la journée du ${dayDateLabel(date)} ?`

  if (!window.confirm(warning)) return

  const succeeded = await saveAction(
    `${reportUrl}/day`,
    'PUT',
    {
      date,
      selected: false,
      revision: current.revision,
    },
    'Journée retirée.',
    'edit',
  )

  if (succeeded) closeDayEditor()
}

async function submitReport() {
  const current = report.value

  if (
    !current
    || !canSubmit.value
    || busy.value
  ) return

  const corrected = current.status === 'REFUSED'

  const summary = [
    `${current.declaredDays} journée(s) renseignée(s)`,
    `${current.totalDays} journée(s) travaillée(s)`,
    `${formatMinutes(current.workedMinutes)} de travail`,
  ]

  if (current.trainingDays > 0) {
    summary.push(
      `${current.trainingDays} journée(s) de formation (${formatMinutes(current.trainingMinutes)})`,
    )
  }

  if (current.absenceDays > 0) {
    summary.push(`${current.absenceDays} absence(s) / congé(s)`)
  }

  const confirmed = window.confirm(
    `${corrected ? 'Transmettre à nouveau' : 'Clôturer et transmettre'} le CRA de ${period.value} avec ${summary.join(', ')} ? Les journées seront verrouillées après transmission.`,
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
      ? 'CRA vérifié par IFICS. Il est prêt pour la génération du document officiel à faire signer par l’intervenant.'
      : 'Correction demandée. L’intervenant peut modifier puis transmettre à nouveau son CRA.',
    'review',
  )

  if (succeeded) {
    correctionReason.value = ''
    showCorrectionForm.value = false
  }
}

function openGenerationForm() {
  const current = report.value

  if (
    !current
    || !canGenerateOfficial.value
    || busy.value
  ) return

  generationIficsVisaDate.value
    = current.periodPolicy.periodEnd

  generationIntervenorSignatureDate.value
    = current.periodPolicy.periodEnd

  feedback.value = ''
  actionError.value = ''
  showGenerationForm.value = true
}

function closeGenerationForm() {
  if (busy.value) return

  showGenerationForm.value = false
  generationIficsVisaDate.value = ''
  generationIntervenorSignatureDate.value = ''
}

async function generateOfficialDocument() {
  const current = report.value

  if (
    !current
    || !canGenerateOfficial.value
    || !generationDatesValid.value
    || busy.value
  ) return

  const existing = current.officialDocument

  const confirmed = window.confirm(
    existing
      ? `Confirmer la génération d’une nouvelle version du CRA officiel de ${period.value} ? La version ${existing.version} restera archivée. Dates imprimées : VISA IFICS ${isoDateLabel(generationIficsVisaDate.value)}, signature intervenant ${isoDateLabel(generationIntervenorSignatureDate.value)}.`
      : `Confirmer la génération du CRA officiel de ${period.value} ? Dates imprimées : VISA IFICS ${isoDateLabel(generationIficsVisaDate.value)}, signature intervenant ${isoDateLabel(generationIntervenorSignatureDate.value)}.`,
  )

  if (!confirmed) return

  busy.value = true
  feedback.value = ''
  actionError.value = ''

  try {
    const response = await $fetch<ApiSuccess<CraOfficialDocument>>(
      `${reportUrl}/generate-official`,
      {
        method: 'POST',
        body: {
          confirmed: true,
          revision: current.revision,
          ificsVisaDate:
            generationIficsVisaDate.value,
          intervenorSignatureDate:
            generationIntervenorSignatureDate.value,
        },
      },
    )

    showGenerationForm.value = false
    generationIficsVisaDate.value = ''
    generationIntervenorSignatureDate.value = ''

    feedback.value
      = `Document officiel ${response.data.reference} généré avec succès.`
  }
  catch (cause) {
    actionError.value = apiErrorMessage(
      cause,
      'Le document officiel n’a pas pu être généré. Vérifiez le CRA, les dates choisies et la signature officielle configurée.',
    )
  }
  finally {
    try {
      await refresh()

      if (error.value || !report.value) {
        feedback.value = ''
        actionError.value
          = 'Impossible de recharger le CRA après la génération. Actualisez la page avant de continuer.'
      }
    }
    catch {
      feedback.value = ''
      actionError.value
        = 'Impossible de recharger le CRA après la génération. Actualisez la page avant de continuer.'
    }
    finally {
      busy.value = false
    }
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

      <div class="totals totals-detailed">
        <div>
          <strong>{{ report.declaredDays }}</strong>
          <span>Journées renseignées</span>
        </div>
        <div>
          <strong>{{ report.totalDays }}</strong>
          <span>Jours travaillés</span>
        </div>
        <div>
          <strong>{{ formatMinutes(report.workedMinutes) }}</strong>
          <span>Temps travaillé</span>
        </div>
        <div>
          <strong>{{ report.trainingDays }}</strong>
          <span>Formation · {{ formatMinutes(report.trainingMinutes) }}</span>
        </div>
        <div>
          <strong>{{ report.absenceDays }}</strong>
          <span>Congés / absences</span>
        </div>
      </div>

      <div v-if="absenceItems.length" class="absence-summary">
        <span
          v-for="item in absenceItems"
          :key="item.label"
          class="absence-chip"
        >
          {{ item.label }} : <strong>{{ item.count }}</strong>
        </span>
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
        Cliquez sur une journée pour renseigner son activité :
        travail, congé, RTT, maladie, formation ou absence.
        Les week-ends et jours fériés sont désactivés.
      </p>
      <p v-else-if="!canEdit" class="notice">
        {{ readOnlyMessage }}
      </p>

      <p
        v-if="canEdit && calendarAvailable"
        class="notice"
      >
        Vous pouvez clôturer et transmettre ce CRA à tout moment.
        Les journées ouvrées à venir du mois peuvent également être
        renseignées si nécessaire. Les week-ends et jours fériés
        restent désactivés.
      </p>

      <section
        v-if="showDayEditor"
        class="day-editor"
        aria-labelledby="day-editor-title"
      >
        <div class="day-editor-heading">
          <div>
            <p class="eyebrow">Journée CRA</p>
            <h2 id="day-editor-title">
              {{ dayDateLabel(dayEditorDate) }}
            </h2>
          </div>

          <button
            type="button"
            class="day-editor-close"
            :disabled="busy"
            aria-label="Fermer l’éditeur de journée"
            @click="closeDayEditor"
          >
            ×
          </button>
        </div>

        <div class="day-editor-grid">
          <label class="field">
            <span>Type de journée</span>
            <select
              v-model="dayEditorType"
              class="input"
              :disabled="busy"
            >
              <option
                v-for="option in writableDayTypes"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <fieldset class="duration-field">
            <legend>Durée</legend>

            <div class="duration-inputs">
              <label>
                <span>Heures</span>
                <input
                  v-model.number="dayEditorHours"
                  class="input"
                  type="number"
                  min="0"
                  max="12"
                  step="1"
                  :disabled="busy"
                >
              </label>

              <label>
                <span>Minutes</span>
                <input
                  v-model.number="dayEditorMinutes"
                  class="input"
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  :disabled="busy"
                >
              </label>
            </div>

            <p class="duration-preview">
              Durée enregistrée :
              <strong>
                {{ dayEditorDurationMinutes === null
                  ? 'Durée invalide'
                  : formatMinutes(dayEditorDurationMinutes) }}
              </strong>
            </p>
          </fieldset>
        </div>

        <div class="day-editor-actions">
          <button
            v-if="dayEditorExisting"
            type="button"
            class="button danger"
            :disabled="busy"
            @click="removeDayEntry"
          >
            Retirer cette journée
          </button>

          <div class="day-editor-actions-right">
            <button
              type="button"
              class="button"
              :disabled="busy"
              @click="closeDayEditor"
            >
              Annuler
            </button>

            <button
              type="button"
              class="button primary"
              :disabled="busy || dayEditorDurationMinutes === null"
              @click="saveDayEntry"
            >
              {{ dayEditorExisting ? 'Enregistrer les modifications' : 'Ajouter la journée' }}
            </button>
          </div>
        </div>
      </section>

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
            :class="[
              {
                selected: day.selected,
                unavailable:
                  day.weekend
                  || Boolean(day.holiday),
              },
              dayTypeClass(day.iso),
            ]"
            :disabled="
              !canEdit
                || !calendarAvailable
                || busy
                || day.weekend
                || Boolean(day.holiday)
            "
            :aria-pressed="day.selected"
            :aria-label="calendarDayAriaLabel(
              day.iso,
              day.number,
              day.weekend,
              day.holiday,
            )"
            @click="openDayEditor(day.iso)"
          >
            <strong>{{ day.number }}</strong>
            <span v-if="day.holiday">{{ day.holiday }}</span>
            <span v-else-if="day.weekend">Repos</span>
            <span v-else-if="day.selected">
              {{ calendarDaySummary(day.iso) }}
            </span>
            <span v-else>—</span>
          </button>
          <div v-else class="empty-day" aria-hidden="true" />
        </template>
      </div>

      <div v-if="canEdit" class="actions">
        <button
          type="button"
          class="button primary"
          :disabled="busy || !canSubmit"
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
        v-if="canViewOfficialDocumentPanel"
        class="official-document-panel"
        aria-labelledby="official-document-heading"
      >
        <h2 id="official-document-heading">
          Document officiel
        </h2>

        <template v-if="report.officialDocument">
          <div class="official-document-summary">
            <div>
              <strong class="official-document-reference">
                {{ report.officialDocument.reference }}
              </strong>

              <p class="muted">
                Version {{ report.officialDocument.version }}
                · générée le
                {{ dateLabel(report.officialDocument.createdAt) }}
                — heure de Paris
              </p>

              <p class="muted">
                Visa IFICS :
                {{
                  isoDateLabel(
                    report.officialDocument.ificsVisaDate,
                  )
                }}
                · Signature intervenant :
                {{
                  isoDateLabel(
                    report.officialDocument.intervenorSignatureDate,
                  )
                }}
              </p>
            </div>

            <span class="badge">
              {{
                officialDocumentStatusLabels[
                  report.officialDocument.status
                ]
              }}
            </span>
          </div>

          <p
            v-if="report.officialDocument.sentToIntervenorAt"
            class="muted"
          >
            Envoyé à l’intervenant le
            {{ dateLabel(report.officialDocument.sentToIntervenorAt) }}
            — heure de Paris.
          </p>

          <div class="official-document-file-actions">
            <a
              :href="officialDocumentViewUrl"
              class="button primary"
              target="_blank"
              rel="noopener"
            >
              Visualiser le PDF
            </a>

            <a
              :href="officialDocumentDownloadUrl"
              class="button"
            >
              Télécharger le PDF
            </a>
          </div>
        </template>

        <p v-else>
          Aucun document officiel n’a encore été généré pour ce CRA.
        </p>

        <div
          v-if="canGenerateOfficial && !showGenerationForm"
          class="actions"
        >
          <button
            type="button"
            class="button primary"
            :disabled="busy"
            @click="openGenerationForm"
          >
            {{
              report.officialDocument
                ? 'Générer une nouvelle version'
                : 'Générer le CRA officiel à signer'
            }}
          </button>
        </div>

        <form
          v-if="canGenerateOfficial && showGenerationForm"
          class="generation-form"
          @submit.prevent="generateOfficialDocument"
        >
          <p>
            Les deux dates proposées correspondent par défaut
            à la fin de la période du CRA. Vous pouvez les modifier
            avant la génération.
          </p>

          <p
            v-if="report.officialDocument"
            class="muted"
          >
            Une nouvelle version sera créée.
            La version {{ report.officialDocument.version }}
            ({{ report.officialDocument.reference }})
            restera conservée dans l’historique.
          </p>

          <div class="generation-grid">
            <label class="field">
              <span>Date VISA IFICS</span>
              <input
                v-model="generationIficsVisaDate"
                class="input"
                type="date"
                required
                :disabled="busy"
              >
            </label>

            <label class="field">
              <span>Date signature intervenant</span>
              <input
                v-model="generationIntervenorSignatureDate"
                class="input"
                type="date"
                required
                :disabled="busy"
              >
            </label>
          </div>

          <p class="muted">
            La date technique réelle de génération est enregistrée
            séparément dans la traçabilité du document.
          </p>

          <div class="actions">
            <button
              type="button"
              class="button"
              :disabled="busy"
              @click="closeGenerationForm"
            >
              Annuler
            </button>

            <button
              type="submit"
              class="button primary"
              :disabled="busy || !generationDatesValid"
            >
              {{
                report.officialDocument
                  ? 'Générer la nouvelle version'
                  : 'Générer le document officiel'
              }}
            </button>
          </div>
        </form>

        <p
          v-if="canGenerateOfficial && !showGenerationForm"
          class="muted"
        >
          La signature officielle IFICS sera intégrée au PDF.
          Les dates imprimées pourront être choisies avant génération.
          Le document généré restera archivé et traçable.
        </p>
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
.official-document-panel h2,
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

.day.selected.type-work {
  background: #1d4933;
  border-color: #1d4933;
  color: #fff;
}

.day.selected.type-training {
  background: #e8f1fb;
  border-color: #76a6d8;
  color: #173b5d;
}

.day.selected.type-paid_leave {
  background: #fff4d8;
  border-color: #d7ae4b;
  color: #5d4818;
}

.day.selected.type-rtt {
  background: #f0eafe;
  border-color: #9b83d1;
  color: #403365;
}

.day.selected.type-sick_leave {
  background: #fdebec;
  border-color: #d9868b;
  color: #692d31;
}

.day.selected.type-authorized_absence {
  background: #fff0e0;
  border-color: #dc9a52;
  color: #68421d;
}

.day.selected.type-unjustified_absence {
  background: #f9dddd;
  border-color: #c96767;
  color: #672323;
}

.day.selected.type-other {
  background: #edf0ee;
  border-color: #9aa79f;
  color: #37443c;
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

.totals-detailed {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.absence-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: -4px;
}

.absence-chip {
  padding: 7px 10px;
  border: 1px solid #d6e2da;
  border-radius: 999px;
  background: #f6f9f7;
  color: #40584a;
  font-size: .82rem;
}

.day-editor {
  padding: 22px;
  border: 1px solid #c8dacf;
  border-radius: 16px;
  background: #f8fbf9;
  box-shadow: 0 12px 30px rgb(27 65 45 / 8%);
}

.day-editor-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.day-editor-heading h2 {
  margin: 4px 0 0;
  font-size: 1.25rem;
  text-transform: capitalize;
}

.day-editor-heading .eyebrow {
  margin: 0;
  color: #52705d;
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.day-editor-close {
  width: 38px;
  height: 38px;
  border: 1px solid #c4d4c9;
  border-radius: 10px;
  background: #fff;
  color: #294533;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.day-editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .8fr);
  gap: 24px;
}

.day-editor .field {
  display: grid;
  align-content: start;
  gap: 8px;
}

.day-editor .field > span,
.duration-field legend,
.duration-inputs label > span {
  color: #40584a;
  font-size: .82rem;
  font-weight: 700;
}

.duration-field {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.duration-field legend {
  margin-bottom: 8px;
}

.duration-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.duration-inputs label {
  display: grid;
  gap: 6px;
}

.duration-preview {
  margin: 10px 0 0;
  color: #52665b;
  font-size: .85rem;
}

.day-editor-actions {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 24px;
}

.day-editor-actions-right {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-left: auto;
}

.button.danger {
  border-color: #d8aaaa;
  background: #fff;
  color: #8b3030;
}

.button.danger:not(:disabled):hover {
  background: #fff1f1;
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
.review-panel,
.official-document-panel {
  padding: 20px;
  border: 1px solid #dce6df;
  border-radius: 14px;
  background: #fff;
}

.notes article + article {
  border-top: 1px solid #dce6df;
}

.official-document-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin: 14px 0;
}

.official-document-summary p {
  margin: 6px 0 0;
}

.official-document-reference {
  overflow-wrap: anywhere;
  color: #1d4933;
}

.official-document-file-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 0;
}

.official-document-file-actions .button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.official-document-panel > .muted:last-child {
  margin-bottom: 0;
}

.generation-form {
  display: grid;
  gap: 16px;
  margin-top: 18px;
  padding: 18px;
  border: 1px solid #d6e2da;
  border-radius: 12px;
  background: #f8fbf9;
}

.generation-form > p {
  margin: 0;
}

.generation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.generation-form .field {
  display: grid;
  gap: 8px;
}

.generation-form .field > span {
  color: #40584a;
  font-size: .82rem;
  font-weight: 700;
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
  .generation-grid {
    grid-template-columns: 1fr;
  }

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

  .totals-detailed {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .day-editor-grid {
    grid-template-columns: 1fr;
  }

  .day-editor-actions {
    flex-direction: column;
  }

  .day-editor-actions-right {
    width: 100%;
    margin-left: 0;
    flex-direction: column-reverse;
  }

  .day-editor-actions .button {
    width: 100%;
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