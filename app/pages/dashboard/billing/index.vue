<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Facturation' })

type Billing = {
  id: string
  kind: string
  number: string
  status: string
  issueDate: string
  dueDate: string | null
  currency: string
  subject: string | null
  subtotal: string
  taxAmount: string
  total: string
  client: { id: string; name: string }
  project: { id: string; reference: string | null; title: string } | null
  _count: { lines: number }
}

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Billing[]>>('/api/billing')

const docs = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('billing:write'))
const created = computed(() => route.query.created === '1')
const money = (value: string, currency: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value))
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('fr-FR') : '—'
const kindLabel = (value: string) => value === 'QUOTE' ? 'Devis' : value === 'INVOICE' ? 'Facture' : value
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Facturation</h1>
        <p>Devis, factures et suivi des règlements.</p>
      </div>
      <div class="actions">
        <NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/billing/create">Nouveau document</NuxtLink>
        <button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom: 18px">Document de facturation créé.</div>
    <div v-if="error" class="alert alert-error">Impossible de charger la facturation.</div>
    <div v-else-if="!docs.length" class="empty-state">
      <p>Aucun document de facturation.</p>
      <NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/billing/create">Créer le premier devis ou facture</NuxtLink>
    </div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Échéance</th><th>Total</th><th>Statut</th><th>Action</th></tr></thead>
        <tbody>
          <tr v-for="doc in docs" :key="doc.id">
            <td><strong>{{ doc.number }}</strong><br><small>{{ kindLabel(doc.kind) }}</small></td>
            <td>{{ doc.client.name }}<br><small v-if="doc.project">{{ doc.project.reference || doc.project.title }}</small></td>
            <td>{{ date(doc.issueDate) }}</td>
            <td>{{ date(doc.dueDate) }}</td>
            <td>{{ money(doc.total, doc.currency) }}</td>
            <td><span class="badge">{{ doc.status }}</span></td>
            <td><NuxtLink class="btn btn-secondary" :to="`/dashboard/billing/${doc.id}`">Ouvrir</NuxtLink></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.empty-state p { margin-top: 0; }
</style>
