<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Créer un client' })

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canCreate = computed(() => permissions.value.includes('*') || permissions.value.includes('client:write'))

const form = reactive({
  type: 'MAIRIE',
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
  notes: '',
})

const saving = ref(false)
const errorMessage = ref('')

async function submit() {
  if (!canCreate.value || saving.value) return
  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/clients/create', {
      method: 'POST',
      body: { ...form },
    })
    await navigateTo('/dashboard/clients?created=1')
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Le client n’a pas pu être créé.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Créer un client</h1>
        <p>Ajoutez une structure, une collectivité ou une organisation avant de lui rattacher des projets.</p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/clients">
        Retour aux clients
      </NuxtLink>
    </div>

    <div v-if="!canCreate" class="alert alert-error">
      Votre rôle ne permet pas de créer un client.
    </div>

    <form v-else class="card card-pad" @submit.prevent="submit">
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom: 18px">
        {{ errorMessage }}
      </div>

      <div class="form-grid">
        <div class="field">
          <label for="client-type">Type *</label>
          <select id="client-type" v-model="form.type" class="select" required>
            <option value="MAIRIE">Mairie / collectivité</option>
            <option value="SERVICE_MUNICIPAL">Service municipal</option>
            <option value="ETABLISSEMENT_SCOLAIRE">Établissement scolaire</option>
            <option value="ASSOCIATION">Association</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>

        <div class="field">
          <label for="client-name">Nom de l’organisation *</label>
          <input id="client-name" v-model="form.name" class="input" maxlength="150" required placeholder="Ex. Ville de Compiègne">
        </div>

        <div class="field">
          <label for="client-service">Service</label>
          <input id="client-service" v-model="form.serviceName" class="input" maxlength="150" placeholder="Ex. Service jeunesse">
        </div>

        <div class="field">
          <label for="client-siret">SIRET</label>
          <input id="client-siret" v-model="form.siret" class="input" inputmode="numeric" maxlength="30" placeholder="14 chiffres">
        </div>

        <div class="field">
          <label for="client-email">E-mail</label>
          <input id="client-email" v-model="form.email" class="input" type="email" maxlength="255">
        </div>

        <div class="field">
          <label for="client-phone1">Téléphone principal</label>
          <input id="client-phone1" v-model="form.phone1" class="input" type="tel" maxlength="30">
        </div>

        <div class="field">
          <label for="client-phone2">Téléphone secondaire</label>
          <input id="client-phone2" v-model="form.phone2" class="input" type="tel" maxlength="30">
        </div>

        <div class="field field-full">
          <label for="client-address1">Adresse *</label>
          <input id="client-address1" v-model="form.addressLine1" class="input" maxlength="255" required>
        </div>

        <div class="field field-full">
          <label for="client-address2">Complément d’adresse</label>
          <input id="client-address2" v-model="form.addressLine2" class="input" maxlength="255">
        </div>

        <div class="field">
          <label for="client-postal">Code postal *</label>
          <input id="client-postal" v-model="form.postalCode" class="input" maxlength="20" required>
        </div>

        <div class="field">
          <label for="client-city">Ville *</label>
          <input id="client-city" v-model="form.city" class="input" maxlength="120" required>
        </div>

        <div class="field">
          <label for="client-country">Pays *</label>
          <input id="client-country" v-model="form.country" class="input" maxlength="100" required>
        </div>

        <div class="field field-full">
          <label for="client-notes">Notes internes</label>
          <textarea id="client-notes" v-model="form.notes" class="textarea" placeholder="Informations utiles à l’équipe IFICS." />
        </div>
      </div>

      <div class="actions" style="margin-top: 22px">
        <button class="btn btn-primary" type="submit" :disabled="saving">
          {{ saving ? 'Création…' : 'Créer le client' }}
        </button>
        <NuxtLink class="btn btn-secondary" to="/dashboard/clients">
          Annuler
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
