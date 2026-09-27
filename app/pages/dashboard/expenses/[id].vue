<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Dépense — IFICS' })

type Expense = {
  id: string
  category: string
  status: string
  expenseDate: string
  supplierName: string | null
  description: string
  reference: string | null
  currency: string
  amountExclTax: string
  taxRate: string
  taxAmount: string
  amountInclTax: string
  paymentMethod: string | null
  reimbursable: boolean

  taxDeductibility: 'PENDING' | 'DEDUCTIBLE' | 'NON_DEDUCTIBLE'
  deductibleTaxAmount: string
  taxReviewNote: string | null
  taxReviewedAt: string | null
  taxReviewedByUser: {
    id: string
    firstName: string
    lastName: string
  } | null

  submittedAt: string | null
  reviewedAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  rejectionReason: string | null
  cancellationReason: string | null
  project: { id: string; reference: string | null; title: string; status: string } | null
  intervenor: { id: string; firstName: string; lastName: string; email: string } | null
  createdByUser: { id: string; firstName: string; lastName: string } | null
  reviewedByUser: { id: string; firstName: string; lastName: string } | null
  paidByUser: { id: string; firstName: string; lastName: string } | null
  cancelledByUser: { id: string; firstName: string; lastName: string } | null
  attachments: Array<{ id: string; originalName: string; mimeType: string; fileSize: string; sha256: string | null; createdAt: string }>
}

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const can = (permission: string) => permissions.value.includes('*') || permissions.value.includes(permission)
const canManage = computed(() => can('expense:manage'))
const canReview = computed(() => canManage.value || can('expense:review'))
const canWriteOwn = computed(() => can('expense:write:own'))
const canWriteAccounting = computed(() => can('accounting:write'))

const { data, error, refresh } = await useFetch<ApiSuccess<Expense>>(() => `/api/expenses/${id.value}`)
const expense = computed(() => data.value?.data ?? null)
const created = computed(() => route.query.created === '1')
const working = ref(false)
const uploading = ref(false)
const file = ref<File | null>(null)
const errorMessage = ref('')
const successMessage = ref('')
const rejectionReason = ref('')
const cancellationReason = ref('')

const taxDeductibility = ref<
  'PENDING' | 'DEDUCTIBLE' | 'NON_DEDUCTIBLE'
>('PENDING')

const deductibleTaxAmount = ref('0.00')
const taxReviewNote = ref('')

const taxEditable = computed(
  () =>
    Boolean(expense.value)
    && canWriteAccounting.value
    && ['APPROVED', 'PAID'].includes(
      expense.value?.status || '',
    ),
)

watch(
  expense,
  (current) => {
    if (!current) return

    taxDeductibility.value =
      current.taxDeductibility

    deductibleTaxAmount.value =
      current.deductibleTaxAmount

    taxReviewNote.value =
      current.taxReviewNote || ''
  },
  { immediate: true },
)

watch(
  taxDeductibility,
  (value) => {
    if (value !== 'DEDUCTIBLE') {
      deductibleTaxAmount.value = '0.00'
    }
  },
)

const taxStatusLabel = (
  value: Expense['taxDeductibility'],
) =>
  ({
    PENDING: 'À vérifier',
    DEDUCTIBLE: 'Déductible',
    NON_DEDUCTIBLE: 'Non déductible',
  } as const)[value]

const money = (value: string | number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: expense.value?.currency || 'EUR' }).format(Number(value))
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '—'
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: session.value?.data.association?.timezone || 'Europe/Paris' }).format(new Date(value)) : '—'
const statusLabel = (value: string) => ({ DRAFT: 'Brouillon', SUBMITTED: 'Soumise', APPROVED: 'Approuvée', REJECTED: 'Rejetée', PAID: 'Payée', CANCELLED: 'Annulée' } as Record<string, string>)[value] || value
const categoryLabel = (value: string) => ({ FUEL: 'Carburant', TOLL: 'Péage', PARKING: 'Stationnement', TRANSPORT: 'Transport', MEAL: 'Repas', ACCOMMODATION: 'Hébergement', INTERNET: 'Internet', PHONE: 'Téléphonie', HARDWARE: 'Matériel', SOFTWARE: 'Logiciel', PRINTING: 'Impression', SUPPLIES: 'Fournitures', TRAINING: 'Formation', INSURANCE: 'Assurance', MILEAGE: 'Indemnités kilométriques', BANK_FEES: 'Frais bancaires', PROFESSIONAL_SERVICE: 'Prestation professionnelle', OTHER: 'Autre' } as Record<string, string>)[value] || value
const paymentLabel = (value: string | null) => ({ CARD: 'Carte', BANK_TRANSFER: 'Virement', DIRECT_DEBIT: 'Prélèvement', CASH: 'Espèces', CHEQUE: 'Chèque', PERSONAL_ADVANCE: 'Avance personnelle', OTHER: 'Autre' } as Record<string, string>)[value || ''] || '—'
const canEditAttachments = computed(() => expense.value && ['DRAFT', 'REJECTED'].includes(expense.value.status) && (canManage.value || canWriteOwn.value))

async function action(fn: () => Promise<unknown>, success: string) {
  if (working.value) return
  working.value = true; errorMessage.value = ''; successMessage.value = ''
  try { await fn(); await refresh(); successMessage.value = success }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'L’opération n’a pas pu être réalisée.') }
  finally { working.value = false }
}

const submitExpense = () => action(() => $fetch(`/api/expenses/${id.value}/submit`, { method: 'POST' }), 'Dépense transmise pour validation.')
const approveExpense = () => action(() => $fetch(`/api/expenses/${id.value}/review`, { method: 'POST', body: { decision: 'APPROVED' } }), 'Dépense approuvée.')
const rejectExpense = () => action(async () => { if (!rejectionReason.value.trim()) throw new Error('Le motif du rejet est obligatoire.'); await $fetch(`/api/expenses/${id.value}/review`, { method: 'POST', body: { decision: 'REJECTED', rejectionReason: rejectionReason.value } }); rejectionReason.value = '' }, 'Dépense rejetée.')
const markPaid = () => action(() => $fetch(`/api/expenses/${id.value}/mark-paid`, { method: 'POST' }), 'Dépense marquée comme payée.')
const cancelExpense = () => action(async () => { if (!cancellationReason.value.trim()) throw new Error('Le motif d’annulation est obligatoire.'); await $fetch(`/api/expenses/${id.value}/cancel`, { method: 'POST', body: { cancellationReason: cancellationReason.value } }); cancellationReason.value = '' }, 'Dépense annulée.')

const saveTaxReview = () =>
  action(
    async () => {
      if (!taxEditable.value) return

      const selectedDeductibility =
        taxDeductibility.value

      const selectedAmount =
        selectedDeductibility === 'DEDUCTIBLE'
          ? deductibleTaxAmount.value
          : '0.00'

      const selectedNote =
        taxReviewNote.value.trim() || null

      if (
        selectedDeductibility === 'DEDUCTIBLE'
        && Number(selectedAmount) <= 0
      ) {
        throw new Error(
          'Le montant de TVA déductible doit être supérieur à zéro.',
        )
      }

      await $fetch(
        `/api/expenses/${id.value}/tax-review`,
        {
          method: 'POST',

          body: {
            taxDeductibility:
              selectedDeductibility,

            deductibleTaxAmount:
              selectedAmount,

            taxReviewNote:
              selectedNote,
          },
        },
      )
    },
    'Qualification fiscale enregistrée.',
  )

function chooseFile(event: Event) { file.value = (event.target as HTMLInputElement).files?.[0] ?? null }
async function uploadAttachment() {
  if (!file.value || uploading.value) return
  uploading.value = true; errorMessage.value = ''; successMessage.value = ''
  try { const body = new FormData(); body.append('file', file.value); await $fetch(`/api/expenses/${id.value}/attachments`, { method: 'POST', body }); file.value = null; await refresh(); successMessage.value = 'Justificatif ajouté après contrôle antivirus.' }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Le justificatif n’a pas pu être ajouté.') }
  finally { uploading.value = false }
}
async function deleteAttachment(attachmentId: string) {
  if (!window.confirm('Supprimer ce justificatif ?')) return
  await action(() => $fetch(`/api/expenses/${id.value}/attachments/${attachmentId}`, { method: 'DELETE' }), 'Justificatif supprimé.')
}
</script>

<template><div><div class="page-head"><div><p class="eyebrow">Dépense</p><h1>{{ expense?.supplierName || (expense ? categoryLabel(expense.category) : 'Dépense') }}</h1><p v-if="expense">{{ date(expense.expenseDate) }} · {{ statusLabel(expense.status) }}</p></div><NuxtLink class="btn btn-secondary" to="/dashboard/expenses">Retour</NuxtLink></div><div v-if="created" class="alert alert-success" style="margin-bottom:18px">Brouillon créé. Ajoutez le justificatif puis transmettez la dépense.</div><div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div><div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div><div v-if="error" class="alert alert-error">Impossible de charger cette dépense.</div><template v-else-if="expense"><section class="grid grid-2"><article class="card card-pad"><h2>Détail</h2><dl class="details"><div><dt>Catégorie</dt><dd>{{ categoryLabel(expense.category) }}</dd></div><div><dt>Fournisseur</dt><dd>{{ expense.supplierName || '—' }}</dd></div><div><dt>Référence</dt><dd>{{ expense.reference || '—' }}</dd></div><div><dt>Paiement</dt><dd>{{ paymentLabel(expense.paymentMethod) }}</dd></div><div><dt>Projet</dt><dd>{{ expense.project ? (expense.project.reference || expense.project.title) : '—' }}</dd></div><div><dt>Intervenant</dt><dd>{{ expense.intervenor ? `${expense.intervenor.firstName} ${expense.intervenor.lastName}` : '—' }}</dd></div><div class="full"><dt>Description</dt><dd>{{ expense.description }}</dd></div></dl></article><article class="card card-pad"><h2>Montants</h2><div class="amount"><span>HT</span><strong>{{ money(expense.amountExclTax) }}</strong></div><div class="amount"><span>TVA ({{ expense.taxRate }} %)</span><strong>{{ money(expense.taxAmount) }}</strong></div><div class="amount total"><span>TTC</span><strong>{{ money(expense.amountInclTax) }}</strong></div><p v-if="expense.reimbursable" class="badge">À rembourser à l’intervenant</p></article></section><section class="card card-pad" style="margin-top:18px"><h2>Justificatifs</h2><div v-if="canEditAttachments" class="upload"><input class="input" type="file" accept="application/pdf,image/png,image/jpeg" @change="chooseFile"><button class="btn btn-secondary" type="button" :disabled="!file || uploading" @click="uploadAttachment">{{ uploading ? 'Contrôle…' : 'Ajouter' }}</button></div><div v-if="!expense.attachments.length" class="empty-state">Aucun justificatif enregistré.</div><div v-else class="table-wrap"><table><thead><tr><th>Fichier</th><th>Taille</th><th>Ajout</th><th /></tr></thead><tbody><tr v-for="item in expense.attachments" :key="item.id"><td>{{ item.originalName }}</td><td>{{ Math.ceil(Number(item.fileSize) / 1024) }} Ko</td><td>{{ dateTime(item.createdAt) }}</td><td><div class="actions"><a class="btn btn-secondary" :href="`/api/expenses/${expense.id}/attachments/${item.id}`" target="_blank" rel="noopener">Voir</a><button v-if="canEditAttachments" class="btn btn-secondary" type="button" @click="deleteAttachment(item.id)">Supprimer</button></div></td></tr></tbody></table></div></section><section class="card card-pad tax-review" style="margin-top:18px">
  <div class="tax-review-head">
    <div>
      <p class="eyebrow">Comptabilité</p>
      <h2>Qualification fiscale TVA</h2>
      <p class="muted">
        Cette qualification est distincte de l’approbation opérationnelle
        de la dépense.
      </p>
    </div>

    <span class="badge">
      {{ taxStatusLabel(expense.taxDeductibility) }}
    </span>
  </div>

  <div class="tax-summary">
    <div>
      <span>TVA enregistrée</span>
      <strong>{{ money(expense.taxAmount) }}</strong>
    </div>

    <div>
      <span>TVA qualifiée déductible</span>
      <strong>{{ money(expense.deductibleTaxAmount) }}</strong>
    </div>

    <div>
      <span>Dernière qualification</span>
      <strong>{{ dateTime(expense.taxReviewedAt) }}</strong>
    </div>

    <div>
      <span>Par</span>
      <strong>
        {{
          expense.taxReviewedByUser
            ? `${expense.taxReviewedByUser.firstName} ${expense.taxReviewedByUser.lastName}`
            : '—'
        }}
      </strong>
    </div>
  </div>

  <div
    v-if="taxEditable"
    class="tax-form"
  >
    <div class="field">
      <label for="tax-deductibility">
        Traitement de la TVA
      </label>

      <select
        id="tax-deductibility"
        v-model="taxDeductibility"
        class="select"
      >
        <option value="PENDING">
          À vérifier
        </option>

        <option value="DEDUCTIBLE">
          Déductible
        </option>

        <option value="NON_DEDUCTIBLE">
          Non déductible
        </option>
      </select>
    </div>

    <div
      v-if="taxDeductibility === 'DEDUCTIBLE'"
      class="field"
    >
      <label for="deductible-tax-amount">
        Montant de TVA déductible
      </label>

      <input
        id="deductible-tax-amount"
        v-model="deductibleTaxAmount"
        class="input"
        type="number"
        min="0"
        :max="expense.taxAmount"
        step="0.01"
        inputmode="decimal"
      >

      <span class="help">
        Maximum : {{ money(expense.taxAmount) }}.
        Si le montant est inférieur à la TVA enregistrée,
        une justification est obligatoire.
      </span>
    </div>

    <div class="field field-full">
      <label for="tax-review-note">
        Note fiscale
      </label>

      <textarea
        id="tax-review-note"
        v-model="taxReviewNote"
        class="textarea"
        rows="3"
        maxlength="5000"
        placeholder="Justification ou information utile à la qualification fiscale."
      />
    </div>

    <div class="actions">
      <button
        class="btn btn-primary"
        type="button"
        :disabled="
          working
          || (
            taxDeductibility === 'DEDUCTIBLE'
            && Number(deductibleTaxAmount) <= 0
          )
        "
        @click="saveTaxReview"
      >
        {{
          working
            ? 'Enregistrement…'
            : 'Enregistrer la qualification'
        }}
      </button>
    </div>
  </div>

  <div
    v-else-if="!canWriteAccounting"
    class="alert alert-warning tax-info"
  >
    Consultation uniquement : la modification de la qualification fiscale
    nécessite le droit comptable approprié.
  </div>

  <div
    v-else-if="!['APPROVED', 'PAID'].includes(expense.status)"
    class="alert alert-warning tax-info"
  >
    La qualification fiscale devient disponible après approbation de la dépense.
  </div>

  <div
    v-if="expense.taxReviewNote"
    class="tax-note"
  >
    <strong>Note fiscale enregistrée</strong>
    <p>{{ expense.taxReviewNote }}</p>
  </div>
</section>

<section class="card card-pad workflow" style="margin-top:18px"><h2>Workflow</h2><div class="timeline"><span>Soumise : {{ dateTime(expense.submittedAt) }}</span><span>Revue : {{ dateTime(expense.reviewedAt) }}</span><span>Payée : {{ dateTime(expense.paidAt) }}</span></div><div v-if="expense.rejectionReason" class="alert alert-warning">Motif du rejet : {{ expense.rejectionReason }}</div><div v-if="expense.cancellationReason" class="alert alert-warning">Motif de l’annulation : {{ expense.cancellationReason }}</div><div class="actions"><button v-if="expense.status === 'DRAFT' && (canManage || canWriteOwn)" class="btn btn-primary" type="button" :disabled="working || !expense.attachments.length" @click="submitExpense">Transmettre</button><button v-if="expense.status === 'SUBMITTED' && canReview" class="btn btn-primary" type="button" :disabled="working" @click="approveExpense">Approuver</button><button v-if="expense.status === 'APPROVED' && canManage" class="btn btn-primary" type="button" :disabled="working" @click="markPaid">Marquer payée</button></div><div v-if="expense.status === 'SUBMITTED' && canReview" class="decision"><div class="field"><label for="reject-reason">Motif du rejet</label><textarea id="reject-reason" v-model="rejectionReason" class="textarea" rows="3" /></div><button class="btn btn-secondary" type="button" :disabled="working || !rejectionReason.trim()" @click="rejectExpense">Rejeter</button></div><div v-if="!['PAID','CANCELLED'].includes(expense.status) && canManage" class="decision"><div class="field"><label for="cancel-reason">Motif d’annulation</label><textarea id="cancel-reason" v-model="cancellationReason" class="textarea" rows="3" /></div><button class="btn btn-secondary" type="button" :disabled="working || !cancellationReason.trim()" @click="cancelExpense">Annuler la dépense</button></div></section></template><PermanentDeletePanel v-if="expense" entity="expense" :entity-id="expense.id" :label="expense.description" return-to="/dashboard/expenses" /></div></template>
<style scoped>h2{margin-top:0}.details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.details div{display:flex;flex-direction:column;gap:3px}.details .full{grid-column:1/-1}.details dt{color:var(--ifics-muted);font-size:.82rem}.details dd{margin:0}.amount{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--ifics-border)}.amount.total{font-size:1.15rem;border-bottom:0}.upload{display:flex;gap:12px;align-items:end;margin-bottom:16px}.timeline{display:flex;gap:20px;flex-wrap:wrap;color:var(--ifics-muted);margin-bottom:16px}.decision{margin-top:18px;padding-top:18px;border-top:1px solid var(--ifics-border)}.tax-review-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.tax-review-head h2{margin-bottom:6px}.tax-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.tax-summary>div{display:flex;flex-direction:column;gap:4px;padding:14px;border:1px solid var(--ifics-border);border-radius:10px}.tax-summary span{font-size:.82rem;color:var(--ifics-muted)}.tax-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:20px;padding-top:20px;border-top:1px solid var(--ifics-border)}.tax-form .field-full,.tax-form .actions{grid-column:1/-1}.tax-info,.tax-note{margin-top:18px}.tax-note p{margin-bottom:0;white-space:pre-wrap}@media(max-width:760px){.details{grid-template-columns:1fr}.details .full{grid-column:auto}.upload{align-items:stretch;flex-direction:column}.tax-review-head{flex-direction:column}.tax-summary,.tax-form{grid-template-columns:1fr}.tax-form .field-full,.tax-form .actions{grid-column:auto}}</style>
