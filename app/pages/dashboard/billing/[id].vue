<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Document de facturation' })

type BillingLine = { id: string; position: number; description: string; quantity: string; unitPrice: string; lineTotal: string }
type BillingDocument = {
  id: string
  kind: 'QUOTE' | 'INVOICE'
  number: string
  status: string
  issueDate: string
  dueDate: string | null
  currency: string
  subject: string | null
  notes: string | null
  subtotal: string
  taxRate: string
  taxAmount: string
  total: string
  sentAt: string | null
  acceptedAt: string | null
  paidAt: string | null
  client: {
    id: string
    name: string
    serviceName: string | null
    email: string | null
    siret: string | null
    addressLine1: string
    addressLine2: string | null
    postalCode: string
    city: string
    country: string
  }
  association: {
    name: string
    legalName: string | null
    billingName: string | null
    billingEmail: string | null
    billingPhone: string | null
    siret: string | null
  }
  finance: {
    legalForm: string | null
    rnaNumber: string | null
    vatNumber: string | null
    bankName: string | null
    bankAccountHolder: string | null
    iban: string | null
    bic: string | null
    paymentTerms: string | null
    taxExemptionText: string | null
  } | null
  project: { id: string; reference: string | null; title: string } | null
  lines: BillingLine[]
  sourceQuote: { id: string; number: string } | null
  convertedInvoices: { id: string; number: string; status: string }[]
}
type EditableLine = { description: string; quantity: string; unitPrice: string }
type BillingPayment = {
  id: string
  amount: string
  currency: string
  paidAt: string
  method: string
  reference: string | null
  note: string | null
  reversedAt: string | null
  reversalReason: string | null
  createdAt: string
}
type PaymentSummary = {
  invoice: { id: string; number: string; total: string; currency: string; status: string }
  paidAmount: string
  remainingAmount: string
  payments: BillingPayment[]
}

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<BillingDocument>>(() => `/api/billing/${id.value}`)

const doc = computed(() => data.value?.data ?? null)
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('billing:write'))
const created = computed(() => route.query.created === '1')
const saving = ref(false)
const changing = ref(false)
const converting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const paymentSummary = ref<PaymentSummary | null>(null)
const loadingPayments = ref(false)
const recordingPayment = ref(false)
const reversingPaymentId = ref<string | null>(null)
const reversalReason = ref('')
const paymentForm = reactive({
  amount: '',
  paidAt: '',
  method: 'BANK_TRANSFER',
  reference: '',
  note: '',
})

const form = reactive({ dueDate: '', subject: '', notes: '', taxRate: '0', lines: [] as EditableLine[] })

watch(doc, (value) => {
  if (!value) return
  form.dueDate = value.dueDate ? value.dueDate.slice(0, 10) : ''
  form.subject = value.subject || ''
  form.notes = value.notes || ''
  form.taxRate = value.taxRate
  form.lines = value.lines.map(line => ({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice }))
}, { immediate: true })

const money = (value: string | number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: doc.value?.currency || 'EUR' }).format(Number(value))
const date = (value: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(new Date(value)) : '—'
const kindLabel = computed(() => doc.value?.kind === 'QUOTE' ? 'Devis' : 'Facture')

function currentBusinessDateIso(): string {
  const timeZone = session.value?.data.association?.timezone || 'Europe/Paris'
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  catch {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  const parts = formatter.formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function paymentMethodLabel(value: string) {
  return ({
    BANK_TRANSFER: 'Virement bancaire',
    CARD: 'Carte bancaire',
    DIRECT_DEBIT: 'Prélèvement',
    CASH: 'Espèces',
    CHEQUE: 'Chèque',
    OTHER: 'Autre',
  } as Record<string, string>)[value] || value
}

async function loadPayments() {
  if (doc.value?.kind !== 'INVOICE') {
    paymentSummary.value = null
    return
  }
  loadingPayments.value = true
  try {
    const response = await $fetch<ApiSuccess<PaymentSummary>>(`/api/billing/${id.value}/payments`)
    paymentSummary.value = response.data
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      paymentForm.amount = response.data.remainingAmount
    }
    if (!paymentForm.paidAt) paymentForm.paidAt = currentBusinessDateIso()
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Les règlements de la facture n’ont pas pu être chargés.')
  }
  finally {
    loadingPayments.value = false
  }
}

watch(() => doc.value?.kind, async () => {
  await loadPayments()
}, { immediate: true })

const nextStatuses = computed(() => {
  if (!doc.value) return [] as string[]
  const quote: Record<string, string[]> = { DRAFT: ['ISSUED', 'CANCELLED'], ISSUED: ['SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'], SENT: ['ACCEPTED', 'REJECTED', 'CANCELLED'], ACCEPTED: ['CANCELLED'], REJECTED: ['CANCELLED'], CANCELLED: [] }
  const invoice: Record<string, string[]> = { DRAFT: ['ISSUED', 'CANCELLED'], ISSUED: ['SENT', 'CANCELLED'], SENT: ['OVERDUE', 'CANCELLED'], PARTIALLY_PAID: ['OVERDUE'], OVERDUE: ['CANCELLED'], PAID: [], CANCELLED: [] }
  return (doc.value.kind === 'QUOTE' ? quote : invoice)[doc.value.status] || []
})

function statusLabel(value: string) {
  return ({ DRAFT: 'Brouillon', ISSUED: 'Émis', SENT: 'Envoyé', ACCEPTED: 'Accepté', REJECTED: 'Refusé', PARTIALLY_PAID: 'Partiellement payé', PAID: 'Payé', OVERDUE: 'En retard', CANCELLED: 'Annulé' } as Record<string, string>)[value] || value
}

function addLine() { form.lines.push({ description: '', quantity: '1', unitPrice: '0' }) }
function removeLine(index: number) { if (form.lines.length > 1) form.lines.splice(index, 1) }

async function saveDraft() {
  if (!doc.value || doc.value.status !== 'DRAFT' || !canWrite.value || saving.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/billing/${id.value}/update`, { method: 'POST', body: { dueDate: form.dueDate || undefined, subject: form.subject, notes: form.notes, taxRate: form.taxRate, lines: form.lines } })
    await refresh()
    successMessage.value = 'Brouillon mis à jour.'
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Le brouillon n’a pas pu être enregistré.') }
  finally { saving.value = false }
}

async function changeStatus(status: string) {
  if (!canWrite.value || changing.value) return
  changing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/billing/${id.value}/status`, { method: 'POST', body: { status } })
    await refresh()
    successMessage.value = `Statut mis à jour : ${statusLabel(status)}.`
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Le statut n’a pas pu être modifié.') }
  finally { changing.value = false }
}

async function recordPayment() {
  if (!canWrite.value || recordingPayment.value || doc.value?.kind !== 'INVOICE') return
  recordingPayment.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/billing/${id.value}/payments`, {
      method: 'POST',
      body: {
        amount: paymentForm.amount,
        paidAt: paymentForm.paidAt,
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        note: paymentForm.note || undefined,
      },
    })
    paymentForm.reference = ''
    paymentForm.note = ''
    await Promise.all([refresh(), loadPayments()])
    successMessage.value = 'Règlement enregistré et solde de la facture recalculé.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Le règlement n’a pas pu être enregistré.')
  }
  finally {
    recordingPayment.value = false
  }
}

async function reversePayment(paymentId: string) {
  if (
    !canWrite.value
    || reversingPaymentId.value !== paymentId
    || !reversalReason.value.trim()
  ) return

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch(
      `/api/billing/${id.value}/payments/${paymentId}/reverse`,
      {
        method: 'POST',
        body: { reason: reversalReason.value },
      },
    )

    reversingPaymentId.value = null
    reversalReason.value = ''
    await Promise.all([refresh(), loadPayments()])
    successMessage.value = 'Le règlement a été annulé et le solde de la facture recalculé.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(
      err,
      'Le règlement n’a pas pu être annulé.',
    )
  }
}

function preparePaymentReversal(paymentId: string) {
  reversingPaymentId.value = paymentId
  reversalReason.value = ''
}

function cancelPaymentReversal() {
  reversingPaymentId.value = null
  reversalReason.value = ''
}

async function convertQuote() {
  if (!canWrite.value || converting.value) return
  converting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await $fetch<ApiSuccess<{ id: string; number: string }>>(`/api/billing/${id.value}/convert`, { method: 'POST' })
    await navigateTo(`/dashboard/billing/${response.data.id}?created=1`)
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Le devis n’a pas pu être converti en facture.') }
  finally { converting.value = false }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ kindLabel }} {{ doc?.number || '' }}</h1>
        <p v-if="doc">{{ doc.client.name }}<span v-if="doc.project"> · {{ doc.project.reference || doc.project.title }}</span></p>
      </div>
      <div class="actions">
        <a v-if="doc" class="btn btn-secondary" :href="`/api/billing/${doc.id}/pdf`" target="_blank" rel="noopener">PDF</a>
        <NuxtLink class="btn btn-secondary" to="/dashboard/billing">Retour</NuxtLink>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom:18px">Document créé avec succès.</div>
    <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>
    <div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">Impossible de charger ce document.</div>

    <template v-else-if="doc">
      <section class="billing-overview">
        <article class="card card-pad">
          <span class="eyebrow">Destinataire</span>
          <h2>{{ doc.client.name }}</h2>
          <p v-if="doc.client.serviceName">{{ doc.client.serviceName }}</p>
          <p>{{ doc.client.addressLine1 }}<span v-if="doc.client.addressLine2"><br>{{ doc.client.addressLine2 }}</span><br>{{ doc.client.postalCode }} {{ doc.client.city }} · {{ doc.client.country }}</p>
          <p><strong>SIRET :</strong> {{ doc.client.siret || 'Non renseigné' }}</p>
          <p v-if="doc.client.email"><strong>E-mail :</strong> {{ doc.client.email }}</p>
        </article>

        <article class="card card-pad">
          <span class="eyebrow">Montants</span>
          <div class="total-line"><span>Total HT</span><strong>{{ money(doc.subtotal) }}</strong></div>
          <div class="total-line"><span>TVA ({{ doc.taxRate }} %)</span><strong>{{ money(doc.taxAmount) }}</strong></div>
          <div class="total-line total-ttc"><span>Total TTC</span><strong>{{ money(doc.total) }}</strong></div>
          <p v-if="Number(doc.taxRate) === 0 && doc.finance?.taxExemptionText" class="muted tax-note">{{ doc.finance.taxExemptionText }}</p>
        </article>
      </section>

      <section class="card card-pad" style="margin-bottom:18px">
        <div class="actions" style="justify-content:space-between"><span class="badge">{{ statusLabel(doc.status) }}</span><strong>{{ money(doc.total) }} TTC</strong></div>
        <p><strong>Émission :</strong> {{ date(doc.issueDate) }} · <strong>Échéance :</strong> {{ date(doc.dueDate) }}</p>
        <p v-if="doc.subject"><strong>Objet :</strong> {{ doc.subject }}</p>
        <p v-if="doc.sourceQuote"><strong>Issu du devis :</strong> {{ doc.sourceQuote.number }}</p>
        <p v-if="doc.convertedInvoices.length"><strong>Facture générée :</strong> {{ doc.convertedInvoices.map(item => item.number).join(', ') }}</p>
      </section>

      <section v-if="doc.kind === 'INVOICE'" class="card card-pad payment-card">
        <h2>Règlements</h2>
        <div v-if="loadingPayments" class="empty-state">Chargement des règlements…</div>
        <template v-else-if="paymentSummary">
          <div class="payment-balance">
            <div><span>Total facture</span><strong>{{ money(doc.total) }}</strong></div>
            <div><span>Déjà encaissé</span><strong>{{ money(paymentSummary.paidAmount) }}</strong></div>
            <div><span>Reste à encaisser</span><strong>{{ money(paymentSummary.remainingAmount) }}</strong></div>
          </div>

          <form
            v-if="canWrite && Number(paymentSummary.remainingAmount) > 0 && ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(doc.status)"
            class="payment-entry"
            @submit.prevent="recordPayment"
          >
            <h3>Enregistrer un encaissement</h3>
            <div class="form-grid">
              <div class="field"><label for="payment-amount">Montant *</label><input id="payment-amount" v-model="paymentForm.amount" class="input" type="number" min="0.01" step="0.01" required></div>
              <div class="field"><label for="payment-date">Date du règlement *</label><input id="payment-date" v-model="paymentForm.paidAt" class="input" type="date" required></div>
              <div class="field"><label for="payment-method">Moyen *</label><select id="payment-method" v-model="paymentForm.method" class="select"><option value="BANK_TRANSFER">Virement bancaire</option><option value="CARD">Carte bancaire</option><option value="DIRECT_DEBIT">Prélèvement</option><option value="CHEQUE">Chèque</option><option value="CASH">Espèces</option><option value="OTHER">Autre</option></select></div>
              <div class="field"><label for="payment-reference">Référence</label><input id="payment-reference" v-model="paymentForm.reference" class="input" maxlength="120"></div>
              <div class="field field-full"><label for="payment-note">Note</label><textarea id="payment-note" v-model="paymentForm.note" class="textarea" rows="2" maxlength="5000" /></div>
            </div>
            <button class="btn btn-primary" type="submit" :disabled="recordingPayment">{{ recordingPayment ? 'Enregistrement…' : 'Enregistrer le règlement' }}</button>
          </form>

          <div v-if="paymentSummary.payments.length" class="payment-history">
            <h3>Historique</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Montant</th><th>Moyen</th><th>Référence</th><th>État</th><th v-if="canWrite">Action</th></tr>
                </thead>
                <tbody>
                  <tr v-for="payment in paymentSummary.payments" :key="payment.id" :class="{ 'payment-reversed': payment.reversedAt }">
                    <td>{{ date(payment.paidAt) }}</td>
                    <td>{{ money(payment.amount) }}</td>
                    <td>{{ paymentMethodLabel(payment.method) }}</td>
                    <td>{{ payment.reference || '—' }}</td>
                    <td>
                      <span v-if="payment.reversedAt" class="badge">Annulé</span>
                      <span v-else class="badge">Comptabilisé</span>
                    </td>
                    <td v-if="canWrite">
                      <button
                        v-if="!payment.reversedAt"
                        class="btn btn-secondary btn-small"
                        type="button"
                        @click="preparePaymentReversal(payment.id)"
                      >
                        Annuler le règlement
                      </button>
                      <span v-else class="muted">{{ payment.reversalReason || 'Annulation enregistrée' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <form
              v-if="reversingPaymentId"
              class="payment-reversal"
              @submit.prevent="reversePayment(reversingPaymentId)"
            >
              <div class="alert alert-warning">
                L’annulation conserve le règlement dans l’historique et recalcule le solde. Cette action est journalisée.
              </div>
              <div class="field">
                <label for="payment-reversal-reason">Motif d’annulation *</label>
                <textarea
                  id="payment-reversal-reason"
                  v-model="reversalReason"
                  class="textarea"
                  rows="3"
                  maxlength="2000"
                  required
                />
              </div>
              <div class="actions">
                <button class="btn btn-danger" type="submit" :disabled="!reversalReason.trim()">Confirmer l’annulation</button>
                <button class="btn btn-secondary" type="button" @click="cancelPaymentReversal">Conserver le règlement</button>
              </div>
            </form>
          </div>
        </template>

        <h3>Coordonnées bancaires</h3>
        <div v-if="doc.finance?.iban" class="payment-grid">
          <div><span class="muted">Titulaire</span><strong>{{ doc.finance.bankAccountHolder || doc.association.billingName || doc.association.legalName || doc.association.name }}</strong></div>
          <div><span class="muted">Banque</span><strong>{{ doc.finance.bankName || '—' }}</strong></div>
          <div class="payment-wide"><span class="muted">IBAN</span><strong class="mono">{{ doc.finance.iban }}</strong></div>
          <div><span class="muted">BIC</span><strong class="mono">{{ doc.finance.bic || '—' }}</strong></div>
        </div>
        <div v-else class="alert alert-warning">Aucun IBAN n’est encore configuré dans Paramètres IFICS.</div>
        <p v-if="doc.finance?.paymentTerms" class="payment-terms">{{ doc.finance.paymentTerms }}</p>
      </section>

      <form v-if="doc.status === 'DRAFT' && canWrite" class="card card-pad" style="margin-bottom:18px" @submit.prevent="saveDraft">
        <h2>Modifier le brouillon</h2>
        <div class="form-grid">
          <div class="field"><label for="billing-due">Échéance</label><input id="billing-due" v-model="form.dueDate" class="input" type="date"></div>
          <div class="field"><label for="billing-tax">TVA (%)</label><input id="billing-tax" v-model="form.taxRate" class="input" type="number" min="0" max="100" step="0.01"></div>
          <div class="field field-full"><label for="billing-subject">Objet</label><input id="billing-subject" v-model="form.subject" class="input" maxlength="255"></div>
        </div>
        <div class="table-wrap" style="margin-top:18px">
          <table>
            <thead><tr><th>Description</th><th>Quantité</th><th>Prix unitaire HT (€)</th><th>Action</th></tr></thead>
            <tbody>
              <tr v-for="(line, index) in form.lines" :key="index"><td><input v-model="line.description" class="input" required></td><td><input v-model="line.quantity" class="input" type="number" min="0.01" step="0.01" required></td><td><input v-model="line.unitPrice" class="input" type="number" min="0" step="0.01" required></td><td><button class="btn btn-secondary" type="button" :disabled="form.lines.length === 1" @click="removeLine(index)">Retirer</button></td></tr>
            </tbody>
          </table>
        </div>
        <button class="btn btn-secondary" type="button" style="margin-top:12px" @click="addLine">Ajouter une ligne</button>
        <div class="field" style="margin-top:18px"><label for="billing-notes">Notes</label><textarea id="billing-notes" v-model="form.notes" class="textarea" rows="4" /></div>
        <div class="actions" style="margin-top:18px"><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer le brouillon' }}</button></div>
      </form>

      <section class="card card-pad" style="margin-bottom:18px">
        <h2>Lignes</h2>
        <div class="table-wrap"><table><thead><tr><th>Description</th><th>Quantité</th><th>Prix unitaire HT</th><th>Total HT</th></tr></thead><tbody><tr v-for="line in doc.lines" :key="line.id"><td>{{ line.description }}</td><td>{{ line.quantity }}</td><td>{{ money(line.unitPrice) }}</td><td>{{ money(line.lineTotal) }}</td></tr></tbody></table></div>
        <div class="totals"><p><span>Total HT</span><strong>{{ money(doc.subtotal) }}</strong></p><p><span>TVA ({{ doc.taxRate }} %)</span><strong>{{ money(doc.taxAmount) }}</strong></p><p class="grand-total"><span>Total TTC</span><strong>{{ money(doc.total) }}</strong></p></div>
      </section>

      <section v-if="canWrite" class="card card-pad">
        <h2>Workflow</h2>
        <div v-if="nextStatuses.length" class="actions">
          <button v-for="status in nextStatuses" :key="status" class="btn" :class="status === 'CANCELLED' || status === 'REJECTED' ? 'btn-secondary' : 'btn-primary'" type="button" :disabled="changing" @click="changeStatus(status)">{{ statusLabel(status) }}</button>
        </div>
        <p v-else class="muted">Aucune transition supplémentaire disponible.</p>
        <div v-if="doc.kind === 'QUOTE' && doc.status === 'ACCEPTED' && !doc.convertedInvoices.length" class="actions" style="margin-top:18px"><button class="btn btn-primary" type="button" :disabled="converting" @click="convertQuote">{{ converting ? 'Conversion…' : 'Convertir en facture' }}</button></div>
      </section>
    </template>
    <PermanentDeletePanel v-if="doc" entity="billing" :entity-id="doc.id" :label="doc.number" return-to="/dashboard/billing" />
  </div>
</template>

<style scoped>
h2{margin-top:0}.billing-overview{display:grid;grid-template-columns:1.3fr .7fr;gap:18px;margin-bottom:18px}.billing-overview p{margin-bottom:0}.total-line{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-bottom:1px solid var(--ifics-border)}.total-ttc{font-size:1.15rem;border-bottom:0}.tax-note{font-size:.82rem}.payment-card{margin-bottom:18px}.payment-balance{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}.payment-balance>div{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid var(--ifics-border);border-radius:10px}.payment-entry{margin:18px 0;padding:18px;border:1px solid var(--ifics-border);border-radius:12px;background:#fafcfb}.payment-history{margin:18px 0}.payment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.payment-grid>div{display:flex;flex-direction:column;gap:4px}.payment-wide{grid-column:1/-1}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.payment-terms{white-space:pre-wrap;margin-bottom:0}.totals{max-width:390px;margin-left:auto;margin-top:18px}.totals p{display:flex;justify-content:space-between;gap:22px}.grand-total{font-size:1.15rem;padding-top:10px;border-top:1px solid var(--ifics-border)}@media(max-width:800px){.billing-overview,.payment-grid,.payment-balance{grid-template-columns:1fr}.payment-wide{grid-column:auto}}

.payment-reversal { margin-top: 16px; padding: 16px; border: 1px solid var(--ifics-border); border-radius: 12px; }
.payment-reversed { opacity: .68; }
.payment-reversed td:nth-child(2) { text-decoration: line-through; }
.btn-small { padding: 7px 10px; font-size: .82rem; }
</style>