<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})

type OverviewResponse = {
  success: boolean
  data: {
    period: {
      from: string | null
      to: string | null
    }
    currency: string
    billing: {
      invoiceCount: number
      exclTax: string
      tax: string
      inclTax: string
      collected: string
      outstanding: string | null
    }
    expenses: {
      expenseCount: number
      exclTax: string
      declaredTax: string
      inclTax: string
    }
    cash: {
      customerReceipts: string
      disbursements: string
      difference: string
    }
    tax: {
      invoicedTax: string
      collectedTax: string
      collectionBasis: string
      expenseTaxRecorded: string
      deductibleTax: string
      pendingReviewCount: number
      pendingReviewTax: string
      payableTax: string | null
      status: string
    }
  }
}

const now = new Date()
const year = now.getFullYear()

const from = ref(`${year}-01-01`)
const to = ref(
  `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
)

const query = computed(() => ({
  from: from.value,
  to: to.value,
}))

const {
  data: response,
  pending,
  error,
  refresh,
} = await useFetch<OverviewResponse>(
  '/api/accounting/overview',
  {
    query,
    watch: false,
  },
)

const overview = computed(() => response.value?.data ?? null)

const money = (value: string | null | undefined) => {
  if (value == null) return '—'

  const amount = Number(value)

  if (!Number.isFinite(amount)) return '—'

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: overview.value?.currency || 'EUR',
  }).format(amount)
}

async function applyPeriod() {
  await refresh()
}
</script>

<template>
  <div class="finance-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">
          Finances & comptabilité
        </p>
        <h1>Vue financière</h1>
        <p>
          Suivi de la facturation, des encaissements,
          des dépenses et des montants de TVA enregistrés.
        </p>
      </div>
    </header>

    <section class="period-card">
      <div>
        <label for="finance-from">Du</label>
        <input
          id="finance-from"
          v-model="from"
          type="date"
        >
      </div>

      <div>
        <label for="finance-to">Au</label>
        <input
          id="finance-to"
          v-model="to"
          type="date"
        >
      </div>

      <button
        type="button"
        :disabled="pending"
        @click="applyPeriod"
      >
        {{ pending ? 'Actualisation…' : 'Actualiser' }}
      </button>
    </section>

    <div
      v-if="error"
      class="error-box"
      role="alert"
    >
      Impossible de charger la vue financière.
    </div>

    <template v-else-if="overview">
      <section class="metrics">
        <article>
          <span>CA facturé HT</span>
          <strong>{{ money(overview.billing.exclTax) }}</strong>
          <small>{{ overview.billing.invoiceCount }} facture(s)</small>
        </article>

        <article>
          <span>TVA facturée</span>
          <strong>{{ money(overview.billing.tax) }}</strong>
          <small>TVA portée sur les factures</small>
        </article>

        <article>
          <span>Encaissements clients</span>
          <strong>{{ money(overview.billing.collected) }}</strong>
          <small>Selon la date des règlements</small>
        </article>

        <article>
          <span>Dépenses TTC</span>
          <strong>{{ money(overview.expenses.inclTax) }}</strong>
          <small>{{ overview.expenses.expenseCount }} dépense(s)</small>
        </article>
      </section>

      <div class="finance-grid">
        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Facturation</p>
              <h2>Activité facturée</h2>
            </div>
          </div>

          <dl>
            <div>
              <dt>Total HT</dt>
              <dd>{{ money(overview.billing.exclTax) }}</dd>
            </div>
            <div>
              <dt>TVA facturée</dt>
              <dd>{{ money(overview.billing.tax) }}</dd>
            </div>
            <div>
              <dt>Total TTC</dt>
              <dd>{{ money(overview.billing.inclTax) }}</dd>
            </div>
            <div>
              <dt>Encaissements reçus</dt>
              <dd>{{ money(overview.billing.collected) }}</dd>
            </div>
          </dl>

          <p class="info">
            Le montant facturé est basé sur la date d’émission.
            Les encaissements sont basés sur leur date de règlement.
          </p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Dépenses</p>
              <h2>Charges enregistrées</h2>
            </div>
          </div>

          <dl>
            <div>
              <dt>Total HT</dt>
              <dd>{{ money(overview.expenses.exclTax) }}</dd>
            </div>
            <div>
              <dt>TVA enregistrée</dt>
              <dd>{{ money(overview.expenses.declaredTax) }}</dd>
            </div>
            <div>
              <dt>Total TTC</dt>
              <dd>{{ money(overview.expenses.inclTax) }}</dd>
            </div>
          </dl>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Trésorerie observée</p>
              <h2>Flux enregistrés</h2>
            </div>
          </div>

          <dl>
            <div>
              <dt>Encaissements clients</dt>
              <dd>{{ money(overview.cash.customerReceipts) }}</dd>
            </div>
            <div>
              <dt>Décaissements enregistrés</dt>
              <dd>{{ money(overview.cash.disbursements) }}</dd>
            </div>
            <div class="total">
              <dt>Différence</dt>
              <dd>{{ money(overview.cash.difference) }}</dd>
            </div>
          </dl>

          <p class="info">
            Cet indicateur compare les règlements clients reçus
            aux dépenses marquées comme payées par l’association.
            Les avances personnelles ne sont pas comptées comme
            décaissements tant qu’elles ne sont pas remboursées.
            Il ne constitue pas un résultat comptable ou fiscal.
          </p>
        </section>

        <section class="panel tax-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">TVA</p>
              <h2>Suivi fiscal</h2>
            </div>
            <span class="warning-pill">
              Calcul fiscal à configurer
            </span>
          </div>

          <dl>
            <div>
              <dt>TVA facturée</dt>
              <dd>{{ money(overview.tax.invoicedTax) }}</dd>
            </div>
            <div>
              <dt>TVA exigible estimée — encaissements</dt>
              <dd>{{ money(overview.tax.collectedTax) }}</dd>
            </div>
            <div>
              <dt>TVA portée sur les dépenses</dt>
              <dd>{{ money(overview.tax.expenseTaxRecorded) }}</dd>
            </div>
            <div>
              <dt>TVA qualifiée déductible</dt>
              <dd>{{ money(overview.tax.deductibleTax) }}</dd>
            </div>
            <div>
              <dt>TVA en attente de qualification</dt>
              <dd>
                {{ money(overview.tax.pendingReviewTax) }}
                <small>
                  ({{ overview.tax.pendingReviewCount }} dépense(s))
                </small>
              </dd>
            </div>
            <div>
              <dt>TVA à décaisser</dt>
              <dd>À déterminer</dd>
            </div>
          </dl>

          <p class="warning">
            La TVA exigible est actuellement estimée selon le régime
            sur encaissements. Seule la TVA explicitement qualifiée comme
            déductible est affichée comme telle. Les montants en attente
            de qualification restent exclus du calcul fiscal.
          </p>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.finance-page {
  display:flex;
  flex-direction:column;
  gap:22px;
}

.page-head h1,
.panel h2 {
  margin:0;
  color:#102b20;
}

.page-head h1 {
  font-size:1.8rem;
}

.page-head p:not(.eyebrow) {
  max-width:760px;
  margin:7px 0 0;
  color:#63736b;
}

.eyebrow {
  margin:0 0 5px;
  color:#287052;
  font-size:.7rem;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
}

.period-card {
  display:flex;
  align-items:end;
  gap:12px;
  padding:16px;
  background:#fff;
  border:1px solid #dce5df;
  border-radius:12px;
}

.period-card div {
  display:flex;
  flex-direction:column;
  gap:5px;
}

.period-card label {
  font-size:.75rem;
  font-weight:800;
  color:#52645b;
}

.period-card input {
  min-height:40px;
  padding:8px 10px;
  border:1px solid #ccd8d1;
  border-radius:8px;
  background:#fff;
}

.period-card button {
  min-height:40px;
  padding:8px 15px;
  border:0;
  border-radius:8px;
  background:#145039;
  color:#fff;
  font-weight:800;
  cursor:pointer;
}

.period-card button:disabled {
  opacity:.6;
  cursor:wait;
}

.metrics {
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:14px;
}

.metrics article,
.panel {
  background:#fff;
  border:1px solid #dce5df;
  border-radius:12px;
}

.metrics article {
  display:flex;
  flex-direction:column;
  padding:17px;
}

.metrics span {
  color:#617168;
  font-size:.75rem;
  font-weight:800;
}

.metrics strong {
  margin-top:7px;
  color:#102b20;
  font-size:1.45rem;
}

.metrics small {
  margin-top:4px;
  color:#839087;
}

.finance-grid {
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:16px;
}

.panel {
  padding:20px;
}

.panel-head {
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
  margin-bottom:15px;
}

.panel h2 {
  font-size:1.1rem;
}

.panel dl {
  margin:0;
}

.panel dl div {
  display:flex;
  justify-content:space-between;
  gap:20px;
  padding:10px 0;
  border-bottom:1px solid #edf1ee;
}

.panel dt {
  color:#64736b;
}

.panel dd {
  margin:0;
  color:#102b20;
  font-weight:850;
}

.panel dl .total {
  border-bottom:0;
  font-size:1.05rem;
}

.info,
.warning {
  margin:14px 0 0;
  padding:11px 12px;
  border-radius:8px;
  font-size:.78rem;
  line-height:1.45;
}

.info {
  background:#f4f7f5;
  color:#607068;
}

.warning {
  background:#fff8e8;
  color:#755a17;
  border:1px solid #efdfac;
}

.warning-pill {
  padding:5px 8px;
  border-radius:999px;
  background:#fff8e8;
  color:#755a17;
  font-size:.68rem;
  font-weight:850;
  white-space:nowrap;
}

.error-box {
  padding:14px;
  border:1px solid #e8b7b7;
  border-radius:10px;
  background:#fff2f2;
  color:#852828;
}

@media (max-width:1100px) {
  .metrics {
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}

@media (max-width:700px) {
  .metrics,
  .finance-grid {
    grid-template-columns:1fr;
  }

  .period-card {
    align-items:stretch;
    flex-direction:column;
  }

  .period-card button {
    width:100%;
  }

  .panel-head {
    flex-direction:column;
  }
}
</style>
