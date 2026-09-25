<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Dépenses — IFICS' })

type Expense = {
  id: string
  category: string
  status: string
  expenseDate: string
  supplierName: string | null
  description: string
  amountInclTax: string
  currency: string
  reimbursable: boolean
  project: { id: string; reference: string | null; title: string } | null
  intervenor: { id: string; firstName: string; lastName: string } | null
  _count: { attachments: number }
}

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const can = (permission: string) => permissions.value.includes('*') || permissions.value.includes(permission)
const canCreate = computed(() => can('expense:manage') || can('expense:write:own'))
const canExport = computed(() => can('expense:export') || can('expense:manage'))
const { data, error, refresh } = await useFetch<ApiSuccess<Expense[]>>('/api/expenses')
const expenses = computed(() => data.value?.data ?? [])
const status = ref('')
const search = ref('')

const filtered = computed(() => expenses.value.filter((expense) => {
  if (status.value && expense.status !== status.value) return false
  const q = search.value.trim().toLocaleLowerCase('fr')
  if (!q) return true
  return [expense.supplierName, expense.description, expense.project?.reference, expense.project?.title, expense.intervenor ? `${expense.intervenor.firstName} ${expense.intervenor.lastName}` : null]
    .filter(Boolean)
    .some(value => String(value).toLocaleLowerCase('fr').includes(q))
}))

const total = computed(() => filtered.value.reduce((sum, item) => sum + Number(item.amountInclTax), 0))
const money = (value: string | number, currency = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value))
const date = (value: string) => new Date(value).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
const statusLabel = (value: string) => ({ DRAFT: 'Brouillon', SUBMITTED: 'Soumise', APPROVED: 'Approuvée', REJECTED: 'Rejetée', PAID: 'Payée', CANCELLED: 'Annulée' } as Record<string, string>)[value] || value
const categoryLabel = (value: string) => ({ FUEL: 'Carburant', TOLL: 'Péage', PARKING: 'Stationnement', TRANSPORT: 'Transport', MEAL: 'Repas', ACCOMMODATION: 'Hébergement', INTERNET: 'Internet', PHONE: 'Téléphonie', HARDWARE: 'Matériel', SOFTWARE: 'Logiciel', PRINTING: 'Impression', SUPPLIES: 'Fournitures', TRAINING: 'Formation', INSURANCE: 'Assurance', MILEAGE: 'Indemnités kilométriques', BANK_FEES: 'Frais bancaires', PROFESSIONAL_SERVICE: 'Prestation professionnelle', OTHER: 'Autre' } as Record<string, string>)[value] || value
</script>

<template>
  <div>
    <div class="page-head">
      <div><p class="eyebrow">Finances</p><h1>Dépenses</h1><p>Suivi des frais, justificatifs, validations et règlements.</p></div>
      <div class="actions"><a v-if="canExport" class="btn btn-secondary" href="/api/expenses/export">Exporter CSV</a><button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button><NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/expenses/create">Nouvelle dépense</NuxtLink></div>
    </div>

    <div v-if="error" class="alert alert-error">Impossible de charger les dépenses.</div>
    <template v-else>
      <section class="grid grid-3 expense-kpis">
        <article class="card card-pad"><span class="muted">Résultats</span><strong>{{ filtered.length }}</strong></article>
        <article class="card card-pad"><span class="muted">Montant TTC affiché</span><strong>{{ money(total) }}</strong></article>
        <article class="card card-pad"><span class="muted">À valider</span><strong>{{ expenses.filter(item => item.status === 'SUBMITTED').length }}</strong></article>
      </section>

      <section class="card card-pad filters">
        <div class="field"><label for="expense-search">Recherche</label><input id="expense-search" v-model="search" class="input" placeholder="Fournisseur, projet, intervenant…"></div>
        <div class="field"><label for="expense-status">Statut</label><select id="expense-status" v-model="status" class="select"><option value="">Tous</option><option value="DRAFT">Brouillon</option><option value="SUBMITTED">Soumise</option><option value="APPROVED">Approuvée</option><option value="REJECTED">Rejetée</option><option value="PAID">Payée</option><option value="CANCELLED">Annulée</option></select></div>
      </section>

      <div v-if="!filtered.length" class="empty-state">Aucune dépense ne correspond aux critères.</div>
      <div v-else class="table-wrap card">
        <table>
          <thead><tr><th>Date</th><th>Dépense</th><th>Projet</th><th>Intervenant</th><th>Justificatifs</th><th>Statut</th><th>Montant TTC</th><th /></tr></thead>
          <tbody><tr v-for="expense in filtered" :key="expense.id"><td>{{ date(expense.expenseDate) }}</td><td><strong>{{ expense.supplierName || categoryLabel(expense.category) }}</strong><br><small>{{ expense.description }}</small></td><td>{{ expense.project ? (expense.project.reference || expense.project.title) : '—' }}</td><td>{{ expense.intervenor ? `${expense.intervenor.firstName} ${expense.intervenor.lastName}` : '—' }}</td><td>{{ expense._count.attachments }}</td><td><span class="badge">{{ statusLabel(expense.status) }}</span></td><td><strong>{{ money(expense.amountInclTax, expense.currency) }}</strong></td><td><NuxtLink class="btn btn-secondary btn-small" :to="`/dashboard/expenses/${expense.id}`">Ouvrir</NuxtLink></td></tr></tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>.expense-kpis{margin-bottom:18px}.expense-kpis article{display:flex;flex-direction:column;gap:6px}.expense-kpis strong{font-size:1.35rem}.filters{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:18px}.btn-small{padding:7px 10px}@media(max-width:760px){.filters{grid-template-columns:1fr}}</style>
