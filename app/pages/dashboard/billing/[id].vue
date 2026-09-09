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
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('fr-FR') : '—'
const kindLabel = computed(() => doc.value?.kind === 'QUOTE' ? 'Devis' : 'Facture')

const nextStatuses = computed(() => {
  if (!doc.value) return [] as string[]
  const quote: Record<string, string[]> = { DRAFT: ['ISSUED', 'CANCELLED'], ISSUED: ['SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'], SENT: ['ACCEPTED', 'REJECTED', 'CANCELLED'], ACCEPTED: ['CANCELLED'], REJECTED: ['CANCELLED'], CANCELLED: [] }
  const invoice: Record<string, string[]> = { DRAFT: ['ISSUED', 'CANCELLED'], ISSUED: ['SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'], SENT: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'], PARTIALLY_PAID: ['PAID', 'OVERDUE'], OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'], PAID: [], CANCELLED: [] }
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
        <h2>Règlement</h2>
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
  </div>
</template>

<style scoped>
h2{margin-top:0}.billing-overview{display:grid;grid-template-columns:1.3fr .7fr;gap:18px;margin-bottom:18px}.billing-overview p{margin-bottom:0}.total-line{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-bottom:1px solid var(--ifics-border)}.total-ttc{font-size:1.15rem;border-bottom:0}.tax-note{font-size:.82rem}.payment-card{margin-bottom:18px}.payment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.payment-grid>div{display:flex;flex-direction:column;gap:4px}.payment-wide{grid-column:1/-1}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.payment-terms{white-space:pre-wrap;margin-bottom:0}.totals{max-width:390px;margin-left:auto;margin-top:18px}.totals p{display:flex;justify-content:space-between;gap:22px}.grand-total{font-size:1.15rem;padding-top:10px;border-top:1px solid var(--ifics-border)}@media(max-width:800px){.billing-overview,.payment-grid{grid-template-columns:1fr}.payment-wide{grid-column:auto}}
</style>