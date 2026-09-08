<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Administration' })

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  status: string
  mfaEnabled: boolean
  lastLoginAt: string | null
  role: { code: string; name: string }
  _count: { sessions: number }
}

type Audit = {
  id: string
  action: string
  outcome: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string } | null
}

type AuditPage = { items: Audit[]; total: number; page: number; pages: number; limit: number }

const { data: usersData, error: usersError } = await useFetch<ApiSuccess<User[]>>('/api/users')
const users = computed(() => usersData.value?.data ?? [])

const page = ref(1)
const filters = reactive({ action: '', entityType: '', entityId: '', userId: '', outcome: '', from: '', to: '' })
const auditQuery = computed(() => ({
  page: page.value,
  limit: 25,
  action: filters.action || undefined,
  entityType: filters.entityType || undefined,
  entityId: filters.entityId || undefined,
  userId: filters.userId || undefined,
  outcome: filters.outcome || undefined,
  from: filters.from || undefined,
  to: filters.to || undefined,
}))
const { data: auditData, refresh: refreshAudit, pending: auditPending } = await useFetch<ApiSuccess<AuditPage>>('/api/audit', { query: auditQuery, watch: false })
const auditPage = computed(() => auditData.value?.data ?? { items: [], total: 0, page: 1, pages: 1, limit: 25 })
const audit = computed(() => auditPage.value.items)

const date = (value: string | null) => value ? new Date(value).toLocaleString('fr-FR') : '—'

async function applyFilters() {
  page.value = 1
  await refreshAudit()
}

async function resetFilters() {
  Object.assign(filters, { action: '', entityType: '', entityId: '', userId: '', outcome: '', from: '', to: '' })
  page.value = 1
  await refreshAudit()
}

async function goToPage(next: number) {
  if (next < 1 || next > auditPage.value.pages || next === page.value) return
  page.value = next
  await refreshAudit()
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Administration</h1><p>Comptes, MFA, sessions et journal d’audit.</p></div>
    </div>

    <section class="card card-pad admin-section">
      <h2>Utilisateurs</h2>
      <div v-if="usersError" class="alert alert-error">Vous n’avez pas accès à la gestion des utilisateurs.</div>
      <div v-else-if="users.length" class="table-wrap">
        <table>
          <thead><tr><th>Utilisateur</th><th>Rôle</th><th>MFA</th><th>Sessions</th><th>Dernière connexion</th><th>Statut</th></tr></thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td><strong>{{ user.firstName }} {{ user.lastName }}</strong><br><small>{{ user.email }}</small></td>
              <td>{{ user.role.name }}</td>
              <td><span class="badge" :class="user.mfaEnabled ? '' : 'badge-warning'">{{ user.mfaEnabled ? 'Actif' : 'Non activé' }}</span></td>
              <td>{{ user._count.sessions }}</td>
              <td>{{ date(user.lastLoginAt) }}</td>
              <td>{{ user.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card card-pad admin-section">
      <div class="audit-heading">
        <div><h2>Journal d’audit</h2><p class="muted">L’historique reste conservé ; l’interface n’affiche que 25 traces par page.</p></div>
        <strong>{{ auditPage.total }} trace(s)</strong>
      </div>

      <form class="audit-filters" @submit.prevent="applyFilters">
        <div class="field"><label for="audit-action">Action</label><input id="audit-action" v-model="filters.action" class="input" placeholder="ex. TICKET_MANAGED"></div>
        <div class="field"><label for="audit-entity">Ressource</label><input id="audit-entity" v-model="filters.entityType" class="input" placeholder="ex. SupportTicket"></div>
        <div class="field"><label for="audit-entity-id">ID ressource</label><input id="audit-entity-id" v-model="filters.entityId" class="input"></div>
        <div class="field"><label for="audit-user">Acteur</label><select id="audit-user" v-model="filters.userId" class="select"><option value="">Tous</option><option v-for="user in users" :key="user.id" :value="user.id">{{ user.firstName }} {{ user.lastName }}</option></select></div>
        <div class="field"><label for="audit-outcome">Résultat</label><select id="audit-outcome" v-model="filters.outcome" class="select"><option value="">Tous</option><option value="SUCCESS">Succès</option><option value="FAILURE">Échec</option></select></div>
        <div class="field"><label for="audit-from">Du</label><input id="audit-from" v-model="filters.from" class="input" type="date"></div>
        <div class="field"><label for="audit-to">Au</label><input id="audit-to" v-model="filters.to" class="input" type="date"></div>
        <div class="actions audit-actions"><button class="btn btn-primary" type="submit" :disabled="auditPending">Filtrer</button><button class="btn btn-secondary" type="button" :disabled="auditPending" @click="resetFilters">Réinitialiser</button></div>
      </form>

      <div v-if="auditPending" class="empty-state">Chargement des traces…</div>
      <div v-else-if="!audit.length" class="empty-state">Aucune entrée d’audit pour ces critères.</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Action</th><th>Acteur</th><th>Ressource</th><th>Résultat</th><th>Détails</th></tr></thead>
          <tbody>
            <tr v-for="item in audit" :key="item.id">
              <td>{{ date(item.createdAt) }}</td>
              <td><strong>{{ item.action }}</strong></td>
              <td>{{ item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Système/public' }}</td>
              <td>{{ item.entityType || '—' }} {{ item.entityId || '' }}</td>
              <td><span class="badge" :class="item.outcome === 'FAILURE' ? 'badge-danger' : ''">{{ item.outcome }}</span></td>
              <td><details v-if="item.metadata"><summary>Voir</summary><pre>{{ JSON.stringify(item.metadata, null, 2) }}</pre></details><span v-else>—</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="btn btn-secondary" type="button" :disabled="page <= 1 || auditPending" @click="goToPage(page - 1)">Précédent</button>
        <span>Page <strong>{{ auditPage.page }}</strong> / {{ auditPage.pages }}</span>
        <button class="btn btn-secondary" type="button" :disabled="page >= auditPage.pages || auditPending" @click="goToPage(page + 1)">Suivant</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-section{margin-bottom:22px}.admin-section h2{margin-top:0}.audit-heading{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.audit-heading p{margin-top:-6px}.audit-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.audit-actions{align-self:end}.pagination{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:18px}details{min-width:80px}summary{cursor:pointer;font-weight:700}pre{white-space:pre-wrap;max-width:420px;font-size:.75rem;background:#f5f7f5;padding:10px;border-radius:8px;overflow:auto}@media(max-width:1100px){.audit-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.audit-filters{grid-template-columns:1fr}.audit-heading{flex-direction:column}}
</style>