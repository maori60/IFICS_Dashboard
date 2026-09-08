<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Intervenants' })

type Intervenor = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  specialty: string | null
  status: string
  siret: string | null
  city: string | null
  country: string | null
  user: { id: string; status: string; mfaEnabled: boolean } | null
  _count: { projectLinks: number; documents: number; accountingDocuments: number; reports: number }
}

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Intervenor[]>>('/api/intervenors')

const items = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canCreate = computed(() => permissions.value.includes('*') || permissions.value.includes('intervenor:write'))
const created = computed(() => route.query.created === '1')
const archived = computed(() => route.query.archived === '1')
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Intervenants</h1>
        <p>Prestataires et professionnels mobilisés sur les actions.</p>
      </div>
      <div class="actions">
        <NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/intervenors/create">
          Nouvel intervenant
        </NuxtLink>
        <button class="btn btn-secondary" type="button" @click="refresh()">
          Actualiser
        </button>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom: 18px">
      L’intervenant a été créé avec succès.
    </div>
    <div v-if="archived" class="alert alert-success" style="margin-bottom: 18px">
      L’intervenant a été archivé.
    </div>

    <div v-if="error" class="alert alert-error">
      Impossible de charger les intervenants.
    </div>

    <div v-else-if="!items.length" class="empty-state">
      <p>Aucun intervenant accessible.</p>
      <NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/intervenors/create">
        Créer le premier intervenant
      </NuxtLink>
    </div>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Intervenant</th>
            <th>Spécialité</th>
            <th>Localisation</th>
            <th>Missions</th>
            <th>Documents</th>
            <th>Compte</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <strong>{{ item.firstName }} {{ item.lastName }}</strong><br>
              <small>{{ item.email }}</small>
            </td>
            <td>{{ item.specialty || '—' }}</td>
            <td>{{ [item.city, item.country].filter(Boolean).join(', ') || '—' }}</td>
            <td>{{ item._count.projectLinks }}</td>
            <td>{{ item._count.documents + item._count.accountingDocuments }}</td>
            <td>
              <span v-if="item.user" class="badge" :class="item.user.mfaEnabled ? '' : 'badge-warning'">
                {{ item.user.mfaEnabled ? 'MFA actif' : 'MFA à configurer' }}
              </span>
              <span v-else class="badge badge-muted">Sans compte</span>
            </td>
            <td><NuxtLink class="btn btn-secondary btn-small" :to="`/dashboard/intervenors/${item.id}`">Ouvrir / modifier</NuxtLink></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.empty-state p { margin-top: 0; }
.btn-small { padding: 8px 12px; white-space: nowrap; }
</style>
