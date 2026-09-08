<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Fiche client' })

type ClientDetail = {
  id: string
  type: string
  status: string
  name: string
  serviceName: string | null
  email: string | null
  phone1: string | null
  phone2: string | null
  siret: string | null
  addressLine1: string
  addressLine2: string | null
  postalCode: string
  city: string
  country: string
  billingAddressLine1: string | null
  billingAddressLine2: string | null
  billingPostalCode: string | null
  billingCity: string | null
  billingCountry: string | null
  notes: string | null
  projectClients: { isMainClient: boolean; project: { id: string; reference: string | null; title: string; status: string } }[]
}

const route = useRoute()
const clientId = computed(() => String(route.params.id || ''))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<ClientDetail>>(() => `/api/clients/${clientId.value}`)

const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('client:write'))
const client = computed(() => data.value?.data)

const form = reactive({
  type: 'MAIRIE',
  status: 'ACTIVE',
  name: '',
  serviceName: '',
  email: '',
  phone1: '',
  phone2: '',
  siret: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: 'France',
  billingAddressLine1: '',
  billingAddressLine2: '',
  billingPostalCode: '',
  billingCity: '',
  billingCountry: '',
  notes: '',
})

const hydratedId = ref('')
watch(client, (value) => {
  if (!value || hydratedId.value === value.id) return
  hydratedId.value = value.id
  Object.assign(form, {
    type: value.type,
    status: value.status,
    name: value.name,
    serviceName: value.serviceName ?? '',
    email: value.email ?? '',
    phone1: value.phone1 ?? '',
    phone2: value.phone2 ?? '',
    siret: value.siret ?? '',
    addressLine1: value.addressLine1,
    addressLine2: value.addressLine2 ?? '',
    postalCode: value.postalCode,
    city: value.city,
    country: value.country,
    billingAddressLine1: value.billingAddressLine1 ?? '',
    billingAddressLine2: value.billingAddressLine2 ?? '',
    billingPostalCode: value.billingPostalCode ?? '',
    billingCity: value.billingCity ?? '',
    billingCountry: value.billingCountry ?? '',
    notes: value.notes ?? '',
  })
}, { immediate: true })

const saving = ref(false)
const archiving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

async function save() {
  if (!canWrite.value || saving.value) return
  saving.value = true
  successMessage.value = ''
  errorMessage.value = ''
  try {
    await $fetch(`/api/clients/${clientId.value}`, { method: 'PUT', body: { ...form } })
    await refresh()
    successMessage.value = 'Les informations du client ont été mises à jour.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible de mettre à jour le client.')
  }
  finally {
    saving.value = false
  }
}

async function archiveClient() {
  if (!canWrite.value || archiving.value) return
  if (!confirm('Archiver ce client ? Il disparaîtra des listes actives sans être supprimé de l’historique.')) return
  archiving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/clients/archive', { method: 'POST', body: { id: clientId.value } })
    await navigateTo('/dashboard/clients?archived=1')
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible d’archiver le client.')
  }
  finally {
    archiving.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <p class="eyebrow">Client</p>
        <h1>{{ client?.name || 'Fiche client' }}</h1>
        <p>Consultez, corrigez ou complétez les informations de l’organisation.</p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/clients">Retour aux clients</NuxtLink>
    </div>

    <div v-if="error" class="alert alert-error">Impossible de charger ce client.</div>
    <template v-else-if="client">
      <div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div>
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>

      <form class="card card-pad" @submit.prevent="save">
        <div class="form-grid">
          <div class="field"><label for="edit-client-type">Type *</label><select id="edit-client-type" v-model="form.type" class="select" :disabled="!canWrite" required><option value="MAIRIE">Mairie / collectivité</option><option value="SERVICE_MUNICIPAL">Service municipal</option><option value="ETABLISSEMENT_SCOLAIRE">Établissement scolaire</option><option value="ASSOCIATION">Association</option><option value="AUTRE">Autre</option></select></div>
          <div class="field"><label for="edit-client-status">Statut *</label><select id="edit-client-status" v-model="form.status" class="select" :disabled="!canWrite" required><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option></select></div>
          <div class="field"><label for="edit-client-name">Organisation *</label><input id="edit-client-name" v-model="form.name" class="input" maxlength="150" :disabled="!canWrite" required></div>
          <div class="field"><label for="edit-client-service">Service</label><input id="edit-client-service" v-model="form.serviceName" class="input" maxlength="150" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-client-email">E-mail</label><input id="edit-client-email" v-model="form.email" class="input" type="email" maxlength="255" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-client-phone1">Téléphone principal</label><input id="edit-client-phone1" v-model="form.phone1" class="input" maxlength="30" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-client-phone2">Téléphone secondaire</label><input id="edit-client-phone2" v-model="form.phone2" class="input" maxlength="30" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-client-siret">SIRET</label><input id="edit-client-siret" v-model="form.siret" class="input" maxlength="30" :disabled="!canWrite"></div>
          <div class="field field-full"><label for="edit-client-address1">Adresse *</label><input id="edit-client-address1" v-model="form.addressLine1" class="input" maxlength="255" :disabled="!canWrite" required></div>
          <div class="field field-full"><label for="edit-client-address2">Complément d’adresse</label><input id="edit-client-address2" v-model="form.addressLine2" class="input" maxlength="255" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-client-postal">Code postal *</label><input id="edit-client-postal" v-model="form.postalCode" class="input" maxlength="20" :disabled="!canWrite" required></div>
          <div class="field"><label for="edit-client-city">Ville *</label><input id="edit-client-city" v-model="form.city" class="input" maxlength="120" :disabled="!canWrite" required></div>
          <div class="field"><label for="edit-client-country">Pays *</label><input id="edit-client-country" v-model="form.country" class="input" maxlength="100" :disabled="!canWrite" required></div>
        </div>

        <h2 style="margin-top:28px">Facturation</h2>
        <div class="form-grid">
          <div class="field field-full"><label for="edit-billing-address1">Adresse de facturation</label><input id="edit-billing-address1" v-model="form.billingAddressLine1" class="input" maxlength="255" :disabled="!canWrite"></div>
          <div class="field field-full"><label for="edit-billing-address2">Complément</label><input id="edit-billing-address2" v-model="form.billingAddressLine2" class="input" maxlength="255" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-billing-postal">Code postal</label><input id="edit-billing-postal" v-model="form.billingPostalCode" class="input" maxlength="20" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-billing-city">Ville</label><input id="edit-billing-city" v-model="form.billingCity" class="input" maxlength="120" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-billing-country">Pays</label><input id="edit-billing-country" v-model="form.billingCountry" class="input" maxlength="100" :disabled="!canWrite"></div>
          <div class="field field-full"><label for="edit-client-notes">Notes internes</label><textarea id="edit-client-notes" v-model="form.notes" class="textarea" :disabled="!canWrite"></textarea></div>
        </div>

        <div v-if="canWrite" class="actions" style="margin-top:22px">
          <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer les modifications' }}</button>
          <button class="btn btn-secondary" type="button" :disabled="archiving" @click="archiveClient">{{ archiving ? 'Archivage…' : 'Archiver le client' }}</button>
        </div>
      </form>

      <section v-if="client.projectClients.length" class="card card-pad" style="margin-top:18px">
        <h2>Projets liés</h2>
        <div class="assignment-list">
          <NuxtLink v-for="link in client.projectClients" :key="link.project.id" :to="`/dashboard/projects/${link.project.id}`" class="assignment-row">
            <span>{{ link.project.title }} <small v-if="link.project.reference" class="muted">{{ link.project.reference }}</small></span>
            <span class="badge badge-muted">{{ link.project.status }}</span>
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.assignment-list{display:grid;gap:8px}.assignment-row{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--ifics-border);border-radius:10px;text-decoration:none;color:inherit}
</style>
