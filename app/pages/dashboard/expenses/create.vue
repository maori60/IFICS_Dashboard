<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Nouvelle dépense — IFICS' })

type Project = { id: string; reference: string | null; title: string; status: string }
type Intervenor = { id: string; firstName: string; lastName: string }
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const can = (permission: string) => permissions.value.includes('*') || permissions.value.includes(permission)
const canManage = computed(() => can('expense:manage'))
const canCreate = computed(() => canManage.value || can('expense:write:own'))
const { data: projectsData } = await useFetch<ApiSuccess<Project[]>>('/api/projects/options', { immediate: can('project:read') })
const { data: intervenorsData } = await useFetch<ApiSuccess<Intervenor[]>>('/api/intervenors/options', { immediate: canManage.value && can('project:assign') })
const projects = computed(() => projectsData.value?.data ?? [])
const intervenors = computed(() => intervenorsData.value?.data ?? [])

function currentBusinessDateIso() {
  const timeZone = session.value?.data.association?.timezone || 'Europe/Paris'
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = formatter.formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const form = reactive({ category: 'OTHER', expenseDate: currentBusinessDateIso(), supplierName: '', description: '', reference: '', amountExclTax: '', taxRate: '20', currency: 'EUR', paymentMethod: 'CARD', projectId: '', intervenorId: '', reimbursable: false })
const saving = ref(false)
const errorMessage = ref('')
const previewTax = computed(() => Math.round(Number(form.amountExclTax || 0) * Number(form.taxRate || 0)) / 100)
const previewTotal = computed(() => Number(form.amountExclTax || 0) + previewTax.value)
const money = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: form.currency || 'EUR' }).format(value)

async function submit() {
  if (!canCreate.value || saving.value) return
  saving.value = true; errorMessage.value = ''
  try {
    const response = await $fetch<ApiSuccess<{ id: string }>>('/api/expenses/create', { method: 'POST', body: { ...form, projectId: form.projectId || undefined, intervenorId: canManage.value ? (form.intervenorId || undefined) : undefined, supplierName: form.supplierName || undefined, reference: form.reference || undefined, paymentMethod: form.paymentMethod || undefined } })
    await navigateTo(`/dashboard/expenses/${response.data.id}?created=1`)
  }
  catch (error) { errorMessage.value = apiErrorMessage(error, 'La dépense n’a pas pu être créée.') }
  finally { saving.value = false }
}
</script>

<template><div><div class="page-head"><div><p class="eyebrow">Finances</p><h1>Nouvelle dépense</h1><p>Enregistrez la dépense puis ajoutez son justificatif avant soumission.</p></div><NuxtLink class="btn btn-secondary" to="/dashboard/expenses">Retour</NuxtLink></div><div v-if="!canCreate" class="alert alert-error">Votre compte ne permet pas de saisir une dépense.</div><form v-else class="card card-pad" @submit.prevent="submit"><div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div><div class="form-grid"><div class="field"><label for="expense-date">Date *</label><input id="expense-date" v-model="form.expenseDate" class="input" type="date" required></div><div class="field"><label for="expense-category">Catégorie *</label><select id="expense-category" v-model="form.category" class="select"><option value="FUEL">Carburant</option><option value="TOLL">Péage</option><option value="PARKING">Stationnement</option><option value="TRANSPORT">Transport</option><option value="MEAL">Repas</option><option value="ACCOMMODATION">Hébergement</option><option value="INTERNET">Internet</option><option value="PHONE">Téléphonie</option><option value="HARDWARE">Matériel</option><option value="SOFTWARE">Logiciel</option><option value="PRINTING">Impression</option><option value="SUPPLIES">Fournitures</option><option value="TRAINING">Formation</option><option value="INSURANCE">Assurance</option><option value="MILEAGE">Indemnités kilométriques</option><option value="BANK_FEES">Frais bancaires</option><option value="PROFESSIONAL_SERVICE">Prestation professionnelle</option><option value="OTHER">Autre</option></select></div><div class="field"><label for="expense-supplier">Fournisseur</label><input id="expense-supplier" v-model="form.supplierName" class="input" maxlength="255"></div><div class="field"><label for="expense-reference">Référence</label><input id="expense-reference" v-model="form.reference" class="input" maxlength="120"></div><div class="field field-full"><label for="expense-description">Description *</label><textarea id="expense-description" v-model="form.description" class="textarea" rows="4" required maxlength="10000" /></div><div class="field"><label for="expense-ht">Montant HT *</label><input id="expense-ht" v-model="form.amountExclTax" class="input" type="number" min="0.01" step="0.01" required></div><div class="field"><label for="expense-tax">TVA (%)</label><input id="expense-tax" v-model="form.taxRate" class="input" type="number" min="0" max="100" step="0.01"></div><div class="field"><label for="expense-method">Paiement</label><select id="expense-method" v-model="form.paymentMethod" class="select"><option value="CARD">Carte</option><option value="BANK_TRANSFER">Virement</option><option value="DIRECT_DEBIT">Prélèvement</option><option value="CASH">Espèces</option><option value="CHEQUE">Chèque</option><option value="PERSONAL_ADVANCE">Avance personnelle</option><option value="OTHER">Autre</option></select></div><div class="field"><label for="expense-project">Projet</label><select id="expense-project" v-model="form.projectId" class="select"><option value="">Aucun</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.reference || project.title }} — {{ project.title }}</option></select></div><div v-if="canManage" class="field"><label for="expense-intervenor">Intervenant</label><select id="expense-intervenor" v-model="form.intervenorId" class="select"><option value="">Aucun</option><option v-for="person in intervenors" :key="person.id" :value="person.id">{{ person.firstName }} {{ person.lastName }}</option></select></div><label class="check"><input v-model="form.reimbursable" type="checkbox"> Dépense à rembourser à l’intervenant</label></div><div class="preview"><span>TVA : <strong>{{ money(previewTax) }}</strong></span><span>Total TTC : <strong>{{ money(previewTotal) }}</strong></span></div><div class="actions"><button class="btn btn-primary" type="submit" :disabled="saving || !form.description.trim() || Number(form.amountExclTax) <= 0">{{ saving ? 'Création…' : 'Créer le brouillon' }}</button></div></form></div></template>
<style scoped>.preview{display:flex;gap:24px;justify-content:flex-end;margin:18px 0}.check{display:flex;align-items:center;gap:8px}</style>
