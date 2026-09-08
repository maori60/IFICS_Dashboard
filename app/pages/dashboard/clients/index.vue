<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Clients' })

type Client = {
  id: string
  type: string
  status: string
  name: string
  serviceName: string | null
  email: string | null
  phone1: string | null
  city: string
  country: string
  _count: { projectClients: number }
}

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Client[]>>('/api/clients')

const clients = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canCreate = computed(() => permissions.value.includes('*') || permissions.value.includes('client:write'))
const created = computed(() => route.query.created === '1')
const archived = computed(() => route.query.archived === '1')
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Clients</h1>
        <p>Structures, collectivités et organisations accompagnées.</p>
      </div>
      <div class="actions">
        <NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/clients/create">
          Nouveau client
        </NuxtLink>
        <button class="btn btn-secondary" type="button" @click="refresh()">
          Actualiser
        </button>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom: 18px">
      Le client a été créé avec succès.
    </div>
    <div v-if="archived" class="alert alert-success" style="margin-bottom: 18px">
      Le client a été archivé.
    </div>

    <div v-if="error" class="alert alert-error">
      Impossible de charger les clients.
    </div>

    <div v-else-if="!clients.length" class="empty-state">
      <p>Aucun client enregistré.</p>
      <NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/clients/create">
        Créer le premier client
      </NuxtLink>
    </div>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Organisation</th>
            <th>Type</th>
            <th>Ville</th>
            <th>Contact</th>
            <th>Projets</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="client in clients" :key="client.id">
            <td><strong>{{ client.name }}</strong><br><small class="muted">{{ client.serviceName }}</small></td>
            <td>{{ client.type }}</td>
            <td>{{ client.city }}, {{ client.country }}</td>
            <td>{{ client.email || client.phone1 || '—' }}</td>
            <td>{{ client._count.projectClients }}</td>
            <td><span class="badge" :class="client.status === 'ACTIVE' ? '' : 'badge-muted'">{{ client.status }}</span></td>
            <td><NuxtLink class="btn btn-secondary btn-small" :to="`/dashboard/clients/${client.id}`">Ouvrir / modifier</NuxtLink></td>
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
