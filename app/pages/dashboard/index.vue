<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

useHead({
  title: 'Vue générale',
})

type RecentInvoice = {
  id: string
  number: string
  status: string
  issueDate: string
  dueDate: string | null
  total: number
  client: {
    id: string
    name: string
  }
  project: {
    id: string
    reference: string
    title: string
  } | null
}

type RecentExpense = {
  id: string
  category: string
  status: string
  expenseDate: string
  supplierName: string | null
  description: string
  amountInclTax: number
  taxAmount: number
  reimbursable: boolean
}

type DashboardOverview = {
  generatedAt: string

  period: {
    year: number
    month: number
    start: string
    end: string
  }

  finance: null | {
    month: {
      revenueExclTax: number
      revenueTax: number
      revenueInclTax: number
      invoiceCount: number
      collectedInclTax: number
      collectedInvoiceCount: number
      revenueVariationPercent: number | null
    }

    previousMonth: {
      revenueExclTax: number
      revenueTax: number
      revenueInclTax: number
      invoiceCount: number
    }

    receivables: {
      grossAmount: number
      paidAmount: number
      outstandingAmount: number
      invoiceCount: number
      note: string
    }

    overdue: {
      grossAmount: number
      paidAmount: number
      outstandingAmount: number
      invoiceCount: number
    }

    statuses: Record<string, number>

    recentInvoices: RecentInvoice[]
  }

  expenses: null | {
    month: {
      amountExclTax: number
      taxAmount: number
      amountInclTax: number
      count: number
    }

    pendingReview: number

    pendingPayment: {
      count: number
      amountInclTax: number
    }

    recentExpenses: RecentExpense[]
  }

  accounting: null | {
    configured: boolean

    currentPeriod: null | {
      id: string
      label: string
      status: string
      startDate: string
      endDate: string

      fiscalYear: {
        id: string
        label: string
        status: string
      }
    }

    checklist: null | {
      periodEnded: boolean
      priorUnclosedPeriods: number
      actionableBlockerCount: number
      warningCount: number

      blockers: Array<{
        code: string
        label: string
        count: number
        message: string
      }>

      warnings: Array<{
        code: string
        label: string
        count: number
        message: string
      }>
    }
  }

  activity: {
    projects: null | {
      active: number
    }

    clients: null | {
      active: number
    }

    intervenors: null | {
      active: number
    }

    cra: null | {
      draft: number
      submitted: number
      reviewed: number
      validated: number
      refused: number
    }
  }

  alerts: {
    overdueInvoices: number
    expensesToReview: number
    expensesToPay: number
    craToReview: number
    accountingPeriodsToClose: number
    accountingBlockers: number
    accountingConfiguration: number
  }

  indicators: {
    grossMarginEstimateExclTax: number | null
    note: string
  }
}

const { data: me } = await useFetch<ApiSuccess<SessionPayload>>(
  '/api/auth/me',
  { key: 'session-me' },
)

const {
  data: overviewResponse,
  error: overviewError,
  status: overviewStatus,
  refresh: refreshOverview,
} = await useFetch<ApiSuccess<DashboardOverview>>(
  '/api/dashboard/overview',
)

const overview = computed(
  () => overviewResponse.value?.data ?? null,
)

const permissions = computed(
  () => new Set(me.value?.data.user.permissions ?? []),
)

const associationTimezone = computed(
  () =>
    me.value?.data.association?.timezone
    || 'Europe/Paris',
)

function can(permission: string): boolean {
  return permissions.value.has('*')
    || permissions.value.has(permission)
}

const monthLabel = computed(() => {
  const period = overview.value?.period

  if (!period) return ''

  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    /*
     * year/month sont déjà des valeurs
     * civiles métier calculées côté serveur.
     */
    timeZone: 'UTC',
  }).format(
    new Date(Date.UTC(period.year, period.month - 1, 1)),
  )
})

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function dateTime(value: string | null): string {
  if (!value) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone:
      associationTimezone.value,
  }).format(new Date(value))
}

function accountingDate(
  value: string | null,
): string {
  if (!value) return '—'

  /*
   * Les bornes des périodes sont des dates
   * comptables logiques stockées en UTC.
   *
   * On les affiche donc en UTC pour éviter
   * qu'une fin de mois à 23:59 UTC apparaisse
   * comme le lendemain en Europe/Paris.
   */
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle: 'short',
      timeZone: 'UTC',
    },
  ).format(
    new Date(value),
  )
}

function accountingStatusLabel(
  status: string,
): string {
  return ({
    OPEN: 'Ouverte',
    REVIEW: 'En contrôle',
    PRE_CLOSED: 'Pré-clôturée',
    CLOSED: 'Clôturée',
  } as Record<string, string>)[status] ?? status
}

function accountingStatusClass(
  status: string,
): string {
  return ({
    OPEN: 'accounting-open',
    REVIEW: 'accounting-review',
    PRE_CLOSED: 'accounting-pre-closed',
    CLOSED: 'accounting-closed',
  } as Record<string, string>)[status] ?? ''
}

function invoiceStatusLabel(status: string): string {
  return ({
    DRAFT: 'Brouillon',
    ISSUED: 'Émise',
    SENT: 'Envoyée',
    ACCEPTED: 'Acceptée',
    REJECTED: 'Refusée',
    PARTIALLY_PAID: 'Partiellement payée',
    PAID: 'Payée',
    OVERDUE: 'En retard',
    CANCELLED: 'Annulée',
  } as Record<string, string>)[status] ?? status
}

function expenseStatusLabel(status: string): string {
  return ({
    DRAFT: 'Brouillon',
    SUBMITTED: 'À valider',
    APPROVED: 'Validée',
    REJECTED: 'Refusée',
    PAID: 'Payée',
    CANCELLED: 'Annulée',
  } as Record<string, string>)[status] ?? status
}

function expenseCategoryLabel(category: string): string {
  return ({
    FUEL: 'Carburant',
    TOLL: 'Péage',
    PARKING: 'Stationnement',
    TRANSPORT: 'Transport',
    MEAL: 'Repas',
    ACCOMMODATION: 'Hébergement',
    INTERNET: 'Internet',
    PHONE: 'Téléphonie',
    HARDWARE: 'Matériel',
    SOFTWARE: 'Logiciel',
    PRINTING: 'Impression',
    SUPPLIES: 'Fournitures',
    TRAINING: 'Formation',
    INSURANCE: 'Assurance',
    MILEAGE: 'Indemnités kilométriques',
    BANK_FEES: 'Frais bancaires',
    PROFESSIONAL_SERVICE: 'Prestation professionnelle',
    OTHER: 'Autre',
  } as Record<string, string>)[category] ?? category
}

function invoiceBadgeClass(status: string): string {
  if (status === 'PAID') return 'badge-success'

  if (
    status === 'OVERDUE'
    || status === 'REJECTED'
  ) {
    return 'badge-danger'
  }

  if (
    status === 'SENT'
    || status === 'ISSUED'
    || status === 'PARTIALLY_PAID'
  ) {
    return 'badge-warning'
  }

  return ''
}

function expenseBadgeClass(status: string): string {
  if (status === 'PAID' || status === 'APPROVED') {
    return 'badge-success'
  }

  if (status === 'REJECTED' || status === 'CANCELLED') {
    return 'badge-danger'
  }

  if (status === 'SUBMITTED') {
    return 'badge-warning'
  }

  return ''
}

const vatEstimate = computed(() => {
  const data = overview.value

  if (!data?.finance || !data.expenses) return null

  return data.finance.month.revenueTax
    - data.expenses.month.taxAmount
})

const totalAlerts = computed(() => {
  const alerts = overview.value?.alerts

  if (!alerts) return 0

  return alerts.overdueInvoices
    + alerts.expensesToReview
    + alerts.expensesToPay
    + alerts.craToReview
    + alerts.accountingPeriodsToClose
    + alerts.accountingBlockers
    + alerts.accountingConfiguration
})

const invoiceStatusTotal = computed(() => {
  const statuses = overview.value?.finance?.statuses

  if (!statuses) return 0

  return Object.values(statuses)
    .reduce((total, value) => total + value, 0)
})

function statusWidth(status: string): number {
  const total = invoiceStatusTotal.value
  const value = overview.value?.finance?.statuses[status] ?? 0

  if (total === 0) return 0

  return Math.max(2, (value / total) * 100)
}
</script>

<template>
  <div class="overview">
    <header class="overview-head">
      <div>
        <p class="eyebrow">
          Pilotage IFICS
        </p>

        <h1>
          Bonjour {{ me?.data.user.firstName }}
        </h1>

        <p class="head-description">
          Vue consolidée de l’activité, de la facturation,
          des dépenses et des opérations à traiter.
        </p>
      </div>

      <div class="overview-actions">
        <div v-if="overview" class="period-card">
          <small>Période de pilotage</small>
          <strong>{{ monthLabel }}</strong>
          <span>
            Actualisé {{ dateTime(overview.generatedAt) }}
          </span>
        </div>

        <button
          class="btn btn-secondary"
          type="button"
          :disabled="overviewStatus === 'pending'"
          @click="refreshOverview()"
        >
          {{
            overviewStatus === 'pending'
              ? 'Actualisation…'
              : 'Actualiser'
          }}
        </button>
      </div>
    </header>

    <div
      v-if="overviewError"
      class="alert alert-error"
    >
      Impossible de charger les indicateurs du tableau de bord.
    </div>

    <div
      v-else-if="overviewStatus === 'pending' && !overview"
      class="dashboard-loading"
    >
      Chargement du tableau de bord…
    </div>

    <template v-else-if="overview">
      <section
        v-if="overview.finance"
        class="dashboard-section"
      >
        <div class="section-heading">
          <div>
            <p class="eyebrow">Finance</p>
            <h2>Situation du mois</h2>
          </div>

          <NuxtLink
            v-if="can('billing:read')"
            class="section-link"
            to="/dashboard/billing"
          >
            Voir la facturation →
          </NuxtLink>
        </div>

        <div class="kpi-grid">
          <article class="metric-card metric-primary">
            <span class="metric-label">
              Chiffre d’affaires HT
            </span>

            <strong>
              {{ money(overview.finance.month.revenueExclTax) }}
            </strong>

            <div class="metric-foot">
              <span>
                {{ overview.finance.month.invoiceCount }}
                {{
                  overview.finance.month.invoiceCount === 1
                    ? 'facture'
                    : 'factures'
                }}
              </span>

              <span
                v-if="
                  overview.finance.month.revenueVariationPercent
                    !== null
                "
                class="variation"
                :class="{
                  positive:
                    overview.finance.month
                      .revenueVariationPercent > 0,
                  negative:
                    overview.finance.month
                      .revenueVariationPercent < 0,
                }"
              >
                {{
                  overview.finance.month
                    .revenueVariationPercent > 0
                    ? '+'
                    : ''
                }}{{
                  overview.finance.month
                    .revenueVariationPercent
                }} %
              </span>
            </div>
          </article>

          <article class="metric-card">
            <span class="metric-label">
              Chiffre d’affaires TTC
            </span>

            <strong>
              {{ money(overview.finance.month.revenueInclTax) }}
            </strong>

            <span class="metric-sub">
              TVA facturée :
              {{ money(overview.finance.month.revenueTax) }}
            </span>
          </article>

          <article class="metric-card">
            <span class="metric-label">
              Encaissements enregistrés
            </span>

            <strong>
              {{ money(overview.finance.month.collectedInclTax) }}
            </strong>

            <span class="metric-sub">
              {{
                overview.finance.month
                  .collectedInvoiceCount
              }}
              {{
                overview.finance.month.collectedInvoiceCount === 1
                  ? 'facture soldée'
                  : 'factures soldées'
              }}
            </span>
          </article>

          <article
            class="metric-card"
            :class="{
              'metric-warning':
                overview.finance.receivables.invoiceCount > 0,
            }"
          >
            <span class="metric-label">
              À encaisser
            </span>

            <strong>
              {{ money(overview.finance.receivables.outstandingAmount) }}
            </strong>

            <span class="metric-sub">
              {{
                overview.finance.receivables.invoiceCount
              }}
              {{
                overview.finance.receivables.invoiceCount === 1
                  ? 'facture'
                  : 'factures'
              }}
            </span>
          </article>

          <article
            v-if="overview.expenses"
            class="metric-card"
          >
            <span class="metric-label">
              Dépenses TTC
            </span>

            <strong>
              {{ money(overview.expenses.month.amountInclTax) }}
            </strong>

            <span class="metric-sub">
              {{ overview.expenses.month.count }}
              {{
                overview.expenses.month.count === 1
                  ? 'opération'
                  : 'opérations'
              }}
            </span>
          </article>

          <article
            v-if="
              overview.indicators
                .grossMarginEstimateExclTax !== null
            "
            class="metric-card"
          >
            <span class="metric-label">
              Marge de pilotage HT
            </span>

            <strong>
              {{
                money(
                  overview.indicators
                    .grossMarginEstimateExclTax,
                )
              }}
            </strong>

            <span class="metric-sub">
              CA HT − dépenses HT
            </span>
          </article>
        </div>

        <div class="finance-detail-grid">
          <article class="panel">
            <div class="panel-heading">
              <div>
                <span class="panel-kicker">
                  Facturation
                </span>
                <h3>État des factures</h3>
              </div>

              <strong>
                {{ invoiceStatusTotal }}
              </strong>
            </div>

            <div
              v-if="invoiceStatusTotal"
              class="invoice-status-bar"
              aria-label="Répartition des statuts de facture"
            >
              <span
                v-if="overview.finance.statuses.PAID"
                class="status-paid"
                :style="{
                  width: `${statusWidth('PAID')}%`,
                }"
              />

              <span
                v-if="overview.finance.statuses.SENT"
                class="status-sent"
                :style="{
                  width: `${statusWidth('SENT')}%`,
                }"
              />

              <span
                v-if="overview.finance.statuses.OVERDUE"
                class="status-overdue"
                :style="{
                  width: `${statusWidth('OVERDUE')}%`,
                }"
              />

              <span
                v-if="overview.finance.statuses.DRAFT"
                class="status-draft"
                :style="{
                  width: `${statusWidth('DRAFT')}%`,
                }"
              />
            </div>

            <div class="status-list">
              <div>
                <span>Payées</span>
                <strong>
                  {{ overview.finance.statuses.PAID ?? 0 }}
                </strong>
              </div>

              <div>
                <span>Envoyées</span>
                <strong>
                  {{ overview.finance.statuses.SENT ?? 0 }}
                </strong>
              </div>

              <div>
                <span>Partiellement payées</span>
                <strong>
                  {{
                    overview.finance.statuses
                      .PARTIALLY_PAID ?? 0
                  }}
                </strong>
              </div>

              <div>
                <span>En retard</span>
                <strong class="danger-text">
                  {{ overview.finance.overdue.invoiceCount }}
                </strong>
              </div>
            </div>
          </article>

          <article class="panel">
            <div class="panel-heading">
              <div>
                <span class="panel-kicker">
                  Fiscalité
                </span>
                <h3>TVA du mois</h3>
              </div>
            </div>

            <div class="tax-summary">
              <div>
                <span>TVA facturée</span>
                <strong>
                  {{ money(overview.finance.month.revenueTax) }}
                </strong>
              </div>

              <div v-if="overview.expenses">
                <span>TVA sur dépenses</span>
                <strong>
                  {{ money(overview.expenses.month.taxAmount) }}
                </strong>
              </div>

              <div v-if="vatEstimate !== null">
                <span>Écart indicatif</span>
                <strong>
                  {{ money(vatEstimate) }}
                </strong>
              </div>
            </div>

            <p class="panel-note">
              Indicateur de pilotage uniquement.
              Le calcul fiscal définitif dépend notamment
              de l’exigibilité et de la déductibilité de la TVA.
            </p>
          </article>
        </div>
      </section>

      <section
        v-if="
          overview.accounting
          && can('accounting:read')
        "
        class="dashboard-section"
      >
        <div class="section-heading">
          <div>
            <p class="eyebrow">Comptabilité</p>
            <h2>Période comptable</h2>
          </div>

          <NuxtLink
            class="section-link"
            to="/dashboard/accounting/periods"
          >
            Périodes & clôture →
          </NuxtLink>
        </div>

        <div
          v-if="!overview.accounting.configured"
          class="accounting-empty"
        >
          <div>
            <strong>
              Aucune période comptable active
            </strong>

            <span>
              Aucun exercice ne couvre la date actuelle.
              Configurez l’exercice avant de poursuivre
              le suivi comptable.
            </span>
          </div>

          <NuxtLink
            class="btn btn-primary"
            to="/dashboard/accounting/periods"
          >
            Configurer
          </NuxtLink>
        </div>

        <template
          v-else-if="
            overview.accounting.currentPeriod
            && overview.accounting.checklist
          "
        >
          <div class="accounting-dashboard-grid">
            <article class="panel accounting-period-panel">
              <div class="accounting-period-top">
                <div>
                  <span class="panel-kicker">
                    Période courante
                  </span>

                  <h3>
                    {{
                      overview.accounting
                        .currentPeriod.label
                    }}
                  </h3>
                </div>

                <span
                  class="accounting-status"
                  :class="
                    accountingStatusClass(
                      overview.accounting
                        .currentPeriod.status,
                    )
                  "
                >
                  {{
                    accountingStatusLabel(
                      overview.accounting
                        .currentPeriod.status,
                    )
                  }}
                </span>
              </div>

              <p class="accounting-period-meta">
                {{
                  overview.accounting
                    .currentPeriod
                    .fiscalYear.label
                }}
                ·
                {{
                  accountingDate(
                    overview.accounting
                      .currentPeriod.startDate,
                  )
                }}
                →
                {{
                  accountingDate(
                    overview.accounting
                      .currentPeriod.endDate,
                  )
                }}
              </p>

              <div
                class="accounting-period-state"
                :class="{
                  current:
                    !overview.accounting
                      .checklist.periodEnded,
                }"
              >
                <strong>
                  {{
                    overview.accounting
                      .checklist.periodEnded
                      ? 'Période terminée'
                      : 'Période en cours'
                  }}
                </strong>

                <span>
                  {{
                    overview.accounting
                      .checklist.periodEnded
                      ? 'Le cycle de contrôle peut être préparé.'
                      : 'La clôture sera possible après la fin de la période.'
                  }}
                </span>
              </div>
            </article>

            <article class="accounting-stat-card">
              <span>
                Périodes antérieures à clôturer
              </span>

              <strong>
                {{
                  overview.accounting
                    .checklist
                    .priorUnclosedPeriods
                }}
              </strong>

              <small>
                Ordre chronologique requis
              </small>
            </article>

            <article
              class="accounting-stat-card"
              :class="{
                warning:
                  overview.accounting
                    .checklist
                    .actionableBlockerCount > 0,
              }"
            >
              <span>
                Éléments bloquants
              </span>

              <strong>
                {{
                  overview.accounting
                    .checklist
                    .actionableBlockerCount
                }}
              </strong>

              <small>
                Hors période encore en cours
              </small>
            </article>

            <article
              class="accounting-stat-card"
              :class="{
                attention:
                  overview.accounting
                    .checklist.warningCount > 0,
              }"
            >
              <span>
                Points d’attention
              </span>

              <strong>
                {{
                  overview.accounting
                    .checklist.warningCount
                }}
              </strong>

              <small>
                Non bloquants
              </small>
            </article>
          </div>

          <div
            v-if="
              overview.accounting
                .checklist
                .priorUnclosedPeriods > 0
              || overview.accounting
                .checklist
                .blockers.length > 0
            "
            class="accounting-notice"
          >
            <strong>
              Préparation de clôture
            </strong>

            <span
              v-if="
                overview.accounting
                  .checklist
                  .priorUnclosedPeriods > 0
              "
            >
              {{
                overview.accounting
                  .checklist
                  .priorUnclosedPeriods
              }}
              {{
                overview.accounting.checklist
                  .priorUnclosedPeriods === 1
                  ? 'période antérieure doit encore être clôturée.'
                  : 'périodes antérieures doivent encore être clôturées.'
              }}
            </span>

            <span
              v-for="
                blocker
                in overview.accounting
                  .checklist.blockers
              "
              :key="blocker.code"
            >
              {{ blocker.message }}
            </span>
          </div>
        </template>
      </section>

      <section class="dashboard-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">À traiter</p>
            <h2>Priorités</h2>
          </div>

          <span
            class="priority-counter"
            :class="{ clear: totalAlerts === 0 }"
          >
            {{ totalAlerts }}
            {{ totalAlerts === 1 ? 'action' : 'actions' }}
          </span>
        </div>

        <div
          v-if="totalAlerts === 0"
          class="all-clear"
        >
          <strong>Aucune alerte prioritaire</strong>
          <span>
            Les principaux flux suivis sont à jour.
          </span>
        </div>

        <div v-else class="alerts-grid">
          <NuxtLink
            v-if="
              overview.alerts
                .accountingConfiguration
            "
            to="/dashboard/accounting/periods"
            class="alert-card alert-critical"
          >
            <span class="alert-dot" />

            <div>
              <strong>
                Période comptable non configurée
              </strong>

              <small>
                Un exercice doit couvrir la date actuelle
              </small>
            </div>
          </NuxtLink>

          <NuxtLink
            v-if="
              overview.alerts
                .accountingPeriodsToClose
            "
            to="/dashboard/accounting/periods"
            class="alert-card"
          >
            <span class="alert-dot" />

            <div>
              <strong>
                {{
                  overview.alerts
                    .accountingPeriodsToClose
                }}
                {{
                  overview.alerts.accountingPeriodsToClose === 1
                    ? 'période à clôturer'
                    : 'périodes à clôturer'
                }}
              </strong>

              <small>
                Clôture chronologique en attente
              </small>
            </div>
          </NuxtLink>

          <NuxtLink
            v-if="
              overview.alerts
                .accountingBlockers
            "
            to="/dashboard/accounting/periods"
            class="alert-card alert-critical"
          >
            <span class="alert-dot" />

            <div>
              <strong>
                {{
                  overview.alerts
                    .accountingBlockers
                }}
                {{
                  overview.alerts.accountingBlockers === 1
                    ? 'élément bloquant'
                    : 'éléments bloquants'
                }}
              </strong>

              <small>
                Contrôle comptable nécessaire
              </small>
            </div>
          </NuxtLink>

          <NuxtLink
            v-if="overview.alerts.overdueInvoices"
            to="/dashboard/billing"
            class="alert-card alert-critical"
          >
            <span class="alert-dot" />
            <div>
              <strong>
                {{ overview.alerts.overdueInvoices }}
                {{
                  overview.alerts.overdueInvoices === 1
                    ? 'facture échue'
                    : 'factures échues'
                }}
              </strong>
              <small>
                {{
                  money(
                    overview.finance?.overdue
                      .outstandingAmount ?? 0,
                  )
                }}
                à surveiller
              </small>
            </div>
          </NuxtLink>

          <div
            v-if="overview.alerts.expensesToReview"
            class="alert-card"
          >
            <span class="alert-dot" />
            <div>
              <strong>
                {{ overview.alerts.expensesToReview }}
                {{
                  overview.alerts.expensesToReview === 1
                    ? 'dépense à valider'
                    : 'dépenses à valider'
                }}
              </strong>
              <small>
                Contrôle administratif nécessaire
              </small>
            </div>
          </div>

          <div
            v-if="overview.alerts.expensesToPay"
            class="alert-card"
          >
            <span class="alert-dot" />
            <div>
              <strong>
                {{ overview.alerts.expensesToPay }}
                {{
                  overview.alerts.expensesToPay === 1
                    ? 'dépense à payer'
                    : 'dépenses à payer'
                }}
              </strong>
              <small>
                {{
                  money(
                    overview.expenses?.pendingPayment
                      .amountInclTax ?? 0,
                  )
                }}
                validés
              </small>
            </div>
          </div>

          <NuxtLink
            v-if="overview.alerts.craToReview"
            to="/dashboard/cra"
            class="alert-card"
          >
            <span class="alert-dot" />
            <div>
              <strong>
                {{ overview.alerts.craToReview }}
                CRA à examiner
              </strong>
              <small>
                Transmis et en attente de traitement
              </small>
            </div>
          </NuxtLink>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Activité</p>
            <h2>Organisation</h2>
          </div>
        </div>

        <div class="activity-grid">
          <NuxtLink
            v-if="overview.activity.projects"
            class="activity-card"
            to="/dashboard/projects"
          >
            <span>Projets actifs</span>
            <strong>
              {{ overview.activity.projects.active }}
            </strong>
          </NuxtLink>

          <NuxtLink
            v-if="overview.activity.clients"
            class="activity-card"
            to="/dashboard/clients"
          >
            <span>Clients actifs</span>
            <strong>
              {{ overview.activity.clients.active }}
            </strong>
          </NuxtLink>

          <NuxtLink
            v-if="overview.activity.intervenors"
            class="activity-card"
            to="/dashboard/intervenors"
          >
            <span>Intervenants actifs</span>
            <strong>
              {{ overview.activity.intervenors.active }}
            </strong>
          </NuxtLink>

          <NuxtLink
            v-if="overview.activity.cra"
            class="activity-card"
            to="/dashboard/cra"
          >
            <span>CRA transmis</span>
            <strong>
              {{ overview.activity.cra.submitted }}
            </strong>
          </NuxtLink>

          <NuxtLink
            v-if="overview.activity.cra"
            class="activity-card"
            to="/dashboard/cra"
          >
            <span>CRA brouillon</span>
            <strong>
              {{ overview.activity.cra.draft }}
            </strong>
          </NuxtLink>

          <NuxtLink
            v-if="overview.activity.cra"
            class="activity-card"
            to="/dashboard/cra"
          >
            <span>CRA validés</span>
            <strong>
              {{ overview.activity.cra.validated }}
            </strong>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="
          overview.finance?.recentInvoices.length
          || overview.expenses?.recentExpenses.length
        "
        class="dashboard-section"
      >
        <div class="section-heading">
          <div>
            <p class="eyebrow">Flux récents</p>
            <h2>Dernières opérations</h2>
          </div>
        </div>

        <div class="operations-grid">
          <article
            v-if="overview.finance"
            class="panel recent-panel"
          >
            <div class="panel-heading">
              <div>
                <span class="panel-kicker">
                  Clients
                </span>
                <h3>Dernières factures</h3>
              </div>

              <NuxtLink
                class="section-link"
                to="/dashboard/billing"
              >
                Toutes →
              </NuxtLink>
            </div>

            <div
              v-if="!overview.finance.recentInvoices.length"
              class="empty-mini"
            >
              Aucune facture enregistrée.
            </div>

            <div
              v-else
              class="recent-list"
            >
              <NuxtLink
                v-for="invoice in overview.finance.recentInvoices"
                :key="invoice.id"
                :to="`/dashboard/billing/${invoice.id}`"
                class="recent-row"
              >
                <div class="recent-main">
                  <strong>
                    {{ invoice.number }}
                  </strong>
                  <span>{{ invoice.client.name }}</span>
                </div>

                <div class="recent-meta">
                  <strong>
                    {{ money(invoice.total) }}
                  </strong>

                  <span
                    class="badge"
                    :class="
                      invoiceBadgeClass(invoice.status)
                    "
                  >
                    {{ invoiceStatusLabel(invoice.status) }}
                  </span>
                </div>
              </NuxtLink>
            </div>
          </article>

          <article
            v-if="overview.expenses"
            class="panel recent-panel"
          >
            <div class="panel-heading">
              <div>
                <span class="panel-kicker">
                  Charges
                </span>
                <h3>Dernières dépenses</h3>
              </div>
            </div>

            <div
              v-if="!overview.expenses.recentExpenses.length"
              class="empty-mini"
            >
              Aucune dépense enregistrée.
            </div>

            <div
              v-else
              class="recent-list"
            >
              <div
                v-for="expense in overview.expenses.recentExpenses"
                :key="expense.id"
                class="recent-row"
              >
                <div class="recent-main">
                  <strong>
                    {{
                      expense.supplierName
                        || expenseCategoryLabel(
                          expense.category,
                        )
                    }}
                  </strong>
                  <span>
                    {{ expense.description }}
                  </span>
                </div>

                <div class="recent-meta">
                  <strong>
                    {{ money(expense.amountInclTax) }}
                  </strong>

                  <span
                    class="badge"
                    :class="
                      expenseBadgeClass(expense.status)
                    "
                  >
                    {{ expenseStatusLabel(expense.status) }}
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Accès rapide</p>
            <h2>Créer et agir</h2>
          </div>
        </div>

        <div class="quick-actions">
          <NuxtLink
            v-if="can('billing:write')"
            class="quick-action primary-action"
            to="/dashboard/billing/create"
          >
            <strong>Nouvelle facture</strong>
            <span>Créer un devis ou une facture</span>
          </NuxtLink>

          <NuxtLink
            v-if="can('expense:manage') || can('expense:write:own')"
            class="quick-action"
            to="/dashboard/expenses/create"
          >
            <strong>Nouvelle dépense</strong>
            <span>Saisir un frais et son justificatif</span>
          </NuxtLink>

          <NuxtLink
            v-if="can('project:write')"
            class="quick-action"
            to="/dashboard/projects/create"
          >
            <strong>Nouveau projet</strong>
            <span>Créer et préparer une mission</span>
          </NuxtLink>

          <NuxtLink
            v-if="
              can('cra:write:own')
              && Boolean(me?.data.user.intervenorId)
            "
            class="quick-action"
            to="/dashboard/cra/create"
          >
            <strong>Nouveau CRA</strong>
            <span>Préparer son activité mensuelle</span>
          </NuxtLink>

          <NuxtLink
            v-if="can('intervenor:write')"
            class="quick-action"
            to="/dashboard/intervenors/create"
          >
            <strong>Nouvel intervenant</strong>
            <span>Ajouter un professionnel</span>
          </NuxtLink>
        </div>
      </section>

      <footer class="dashboard-disclaimer">
        <strong>Indicateurs de pilotage</strong>
        <span>
          Les chiffres financiers affichés servent au suivi
          opérationnel. Ils ne remplacent pas une comptabilité
          clôturée ni les déclarations fiscales officielles.
        </span>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.overview-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 28px;
}

.overview-head h1 {
  margin: 3px 0 7px;
  font-size: clamp(2rem, 3vw, 2.7rem);
  letter-spacing: -.035em;
}

.head-description {
  max-width: 760px;
  margin: 0;
  color: var(--ifics-muted);
  font-size: 1.02rem;
  line-height: 1.55;
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.period-card {
  min-width: 190px;
  display: flex;
  flex-direction: column;
  padding: 11px 14px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 12px;
}

.period-card small,
.period-card span {
  color: var(--ifics-muted);
  font-size: .72rem;
}

.period-card strong {
  text-transform: capitalize;
}

.dashboard-loading {
  min-height: 260px;
  display: grid;
  place-items: center;
  color: var(--ifics-muted);
}

.dashboard-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.section-heading h2 {
  margin: 2px 0 0;
  font-size: 1.4rem;
}

.section-heading .eyebrow {
  margin: 0;
}

.section-link {
  color: var(--ifics-green-700);
  text-decoration: none;
  font-weight: 800;
  font-size: .88rem;
}

.section-link:hover {
  text-decoration: underline;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  min-width: 0;
  min-height: 142px;
  display: flex;
  flex-direction: column;
  padding: 18px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 15px;
  box-shadow: 0 4px 14px rgba(20, 47, 34, .035);
}

.metric-primary {
  background:
    linear-gradient(
      145deg,
      #123c2b 0%,
      #1b5038 100%
    );
  border-color: transparent;
  color: #fff;
}

.metric-warning {
  border-color: #e6c97b;
  background: #fffdf6;
}

.metric-label {
  color: var(--ifics-muted);
  font-size: .76rem;
  font-weight: 800;
}

.metric-primary .metric-label,
.metric-primary .metric-sub,
.metric-primary .metric-foot {
  color: #c6ddd0;
}

.metric-card > strong {
  margin-top: auto;
  padding-top: 15px;
  font-size: clamp(1.45rem, 2vw, 1.9rem);
  letter-spacing: -.035em;
  overflow-wrap: anywhere;
}

.metric-sub,
.metric-foot {
  margin-top: 7px;
  color: var(--ifics-muted);
  font-size: .73rem;
}

.metric-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.variation {
  font-weight: 900;
}

.variation.positive {
  color: #80d2a2;
}

.variation.negative {
  color: #ffb2a7;
}

.finance-detail-grid,
.operations-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 16px;
}

.panel {
  padding: 20px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 15px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-heading h3 {
  margin: 2px 0 0;
  font-size: 1.05rem;
}

.panel-kicker {
  color: var(--ifics-muted);
  font-size: .7rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.invoice-status-bar {
  height: 9px;
  display: flex;
  overflow: hidden;
  margin-bottom: 18px;
  border-radius: 999px;
  background: #edf2ef;
}

.invoice-status-bar span {
  display: block;
  height: 100%;
}

.status-paid {
  background: #27704e;
}

.status-sent {
  background: #84a68f;
}

.status-overdue {
  background: #b94b3e;
}

.status-draft {
  background: #c7cec9;
}

.status-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 9px 18px;
}

.status-list > div,
.tax-summary > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 9px 0;
  border-bottom: 1px solid #edf1ee;
}

.status-list span,
.tax-summary span {
  color: var(--ifics-muted);
  font-size: .82rem;
}

.danger-text {
  color: #a83930;
}

.tax-summary {
  display: flex;
  flex-direction: column;
}

.panel-note {
  margin: 14px 0 0;
  color: var(--ifics-muted);
  font-size: .74rem;
  line-height: 1.45;
}

.priority-counter {
  padding: 7px 10px;
  border-radius: 999px;
  background: #fff1ee;
  color: #963c31;
  font-size: .74rem;
  font-weight: 900;
}

.priority-counter.clear {
  background: #eaf7ef;
  color: #246347;
}

.all-clear {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  border-radius: 14px;
  border: 1px solid #cde3d5;
  background: #f3faf6;
}

.all-clear span {
  color: var(--ifics-muted);
  font-size: .84rem;
}

.alerts-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.alert-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 13px;
  color: inherit;
  text-decoration: none;
}

.alert-card:hover {
  border-color: #a8c3b1;
}

.alert-critical {
  border-color: #e2b0a9;
  background: #fffafa;
}

.alert-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  margin-top: 5px;
  border-radius: 50%;
  background: #d17a3e;
}

.alert-critical .alert-dot {
  background: #b94b3e;
}

.alert-card div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alert-card small {
  color: var(--ifics-muted);
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.activity-card {
  min-height: 110px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 17px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 13px;
  text-decoration: none;
  color: inherit;
}

.activity-card:hover {
  border-color: #9ab8a4;
}

.activity-card span {
  color: var(--ifics-muted);
  font-size: .79rem;
}

.activity-card strong {
  font-size: 1.8rem;
  letter-spacing: -.03em;
}

.recent-list {
  display: flex;
  flex-direction: column;
}

.recent-row {
  min-width: 0;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  border-top: 1px solid #edf1ee;
  color: inherit;
  text-decoration: none;
}

.recent-row:first-child {
  border-top: 0;
}

a.recent-row:hover .recent-main strong {
  color: var(--ifics-green-700);
}

.recent-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.recent-main span {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ifics-muted);
  font-size: .75rem;
}

.recent-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: right;
}

.recent-meta > strong {
  white-space: nowrap;
}

.badge-success {
  background: #eaf7ef;
  color: #246347;
}

.badge-warning {
  background: #fff6df;
  color: #865f16;
}

.badge-danger {
  background: #fff0ed;
  color: #9b3e33;
}

.empty-mini {
  padding: 20px 0;
  color: var(--ifics-muted);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.quick-action {
  min-height: 94px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 17px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 13px;
  color: inherit;
  text-decoration: none;
}

.quick-action:hover {
  border-color: #98b7a3;
  transform: translateY(-1px);
}

.quick-action span {
  color: var(--ifics-muted);
  font-size: .76rem;
}

.primary-action {
  background: #173f2e;
  color: #fff;
  border-color: #173f2e;
}

.primary-action span {
  color: #bcd1c4;
}

.dashboard-disclaimer {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  color: var(--ifics-muted);
  background: #eef3f0;
  border-radius: 12px;
  font-size: .74rem;
}

.dashboard-disclaimer strong {
  flex: 0 0 auto;
  color: #395545;
}

@media (max-width: 1450px) {
  .kpi-grid,
  .activity-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .alerts-grid,
  .quick-actions {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 950px) {
  .overview-head,
  .overview-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .period-card {
    min-width: 0;
  }

  .kpi-grid,
  .activity-grid,
  .finance-detail-grid,
  .operations-grid,
  .alerts-grid,
  .quick-actions {
    grid-template-columns: 1fr;
  }

  .recent-row {
    flex-direction: column;
  }

  .recent-meta {
    justify-content: space-between;
  }

  .dashboard-disclaimer {
    flex-direction: column;
  }
}

.accounting-dashboard-grid {
  display: grid;
  grid-template-columns:
    minmax(300px, 2fr)
    repeat(3, minmax(150px, 1fr));
  gap: 14px;
}

.accounting-period-panel {
  min-width: 0;
}

.accounting-period-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.accounting-period-top h3 {
  margin: 4px 0 0;
  font-size: 1.25rem;
}

.accounting-status {
  flex: 0 0 auto;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: .68rem;
  font-weight: 900;
}

.accounting-status.accounting-open {
  background: #edf7f0;
  color: #246044;
}

.accounting-status.accounting-review {
  background: #fff3d9;
  color: #765415;
}

.accounting-status.accounting-pre-closed {
  background: #edf1ef;
  color: #4d6257;
}

.accounting-status.accounting-closed {
  background: #e4ebe7;
  color: #294c3b;
}

.accounting-period-meta {
  margin: 10px 0 0;
  color: var(--ifics-muted);
  font-size: .76rem;
}

.accounting-period-state {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 18px;
  padding: 11px 13px;
  border-radius: 10px;
  background: #f2f7f4;
}

.accounting-period-state.current {
  background: #f5f7f6;
}

.accounting-period-state strong {
  font-size: .79rem;
}

.accounting-period-state span {
  color: var(--ifics-muted);
  font-size: .72rem;
}

.accounting-stat-card {
  min-width: 0;
  min-height: 156px;
  display: flex;
  flex-direction: column;
  padding: 17px;
  background: #fff;
  border: 1px solid var(--ifics-border);
  border-radius: 15px;
}

.accounting-stat-card > span {
  color: var(--ifics-muted);
  font-size: .74rem;
  font-weight: 800;
  line-height: 1.35;
}

.accounting-stat-card > strong {
  margin-top: auto;
  padding-top: 16px;
  font-size: 1.8rem;
}

.accounting-stat-card > small {
  margin-top: 3px;
  color: var(--ifics-muted);
  font-size: .67rem;
}

.accounting-stat-card.warning {
  border-color: #e6b1a8;
  background: #fff8f6;
}

.accounting-stat-card.attention {
  border-color: #e6cf91;
  background: #fffdf7;
}

.accounting-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid #e6c97b;
  border-radius: 14px;
  background: #fffdf6;
}

.accounting-empty > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.accounting-empty span {
  color: var(--ifics-muted);
  font-size: .78rem;
}

.accounting-notice {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 13px 15px;
  border-left: 4px solid #d6a53d;
  background: #fffaf0;
  border-radius: 8px;
  font-size: .76rem;
}

.accounting-notice span {
  color: var(--ifics-muted);
}

@media (max-width: 1180px) {
  .accounting-dashboard-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .accounting-dashboard-grid {
    grid-template-columns: 1fr;
  }

  .accounting-empty {
    align-items: stretch;
    flex-direction: column;
  }
}

</style>
