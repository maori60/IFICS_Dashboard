<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Nouvel intervenant' })

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canCreate = computed(() => permissions.value.includes('*') || permissions.value.includes('intervenor:write'))

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  specialty: '',
  siret: '',
  ribIban: '',
  ribBic: '',
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
    await $fetch('/api/intervenors/create', {
      method: 'POST',
      body: form,
    })
    await navigateTo('/dashboard/intervenors?created=1')
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Impossible de créer l’intervenant.')
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
        <p class="eyebrow">Intervenants</p>
        <h1>Nouvel intervenant</h1>
        <p>Créer la fiche administrative d’un prestataire ou professionnel.</p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/intervenors">
        Retour
      </NuxtLink>
    </div>

    <div v-if="!canCreate" class="alert alert-error">
      Vous n’avez pas la permission de créer un intervenant.
    </div>

    <form v-else class="card card-pad" @submit.prevent="submit">
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom: 18px">
        {{ errorMessage }}
      </div>

      <div class="form-grid">
        <div class="field">
          <label for="firstName">Prénom *</label>
          <input id="firstName" v-model="form.firstName" class="input" required maxlength="100">
        </div>
        <div class="field">
          <label for="lastName">Nom *</label>
          <input id="lastName" v-model="form.lastName" class="input" required maxlength="100">
        </div>
        <div class="field">
          <label for="email">E-mail *</label>
          <input id="email" v-model="form.email" class="input" type="email" required maxlength="255">
        </div>
        <div class="field">
          <label for="phone">Téléphone</label>
          <input id="phone" v-model="form.phone" class="input" maxlength="30">
        </div>
        <div class="field">
          <label for="specialty">Spécialité</label>
          <input id="specialty" v-model="form.specialty" class="input" maxlength="150" placeholder="Capoeira, slam, développement…">
        </div>
        <div class="field">
          <label for="siret">SIRET</label>
          <input id="siret" v-model="form.siret" class="input" inputmode="numeric" maxlength="18" placeholder="14 chiffres">
        </div>
        <div class="field field-full">
          <label for="addressLine1">Adresse</label>
          <input id="addressLine1" v-model="form.addressLine1" class="input" maxlength="255">
        </div>
        <div class="field field-full">
          <label for="addressLine2">Complément d’adresse</label>
          <input id="addressLine2" v-model="form.addressLine2" class="input" maxlength="255">
        </div>
        <div class="field">
          <label for="postalCode">Code postal</label>
          <input id="postalCode" v-model="form.postalCode" class="input" maxlength="20">
        </div>
        <div class="field">
          <label for="city">Ville</label>
          <input id="city" v-model="form.city" class="input" maxlength="120">
        </div>
        <div class="field">
          <label for="country">Pays</label>
          <input id="country" v-model="form.country" class="input" maxlength="100">
        </div>
        <div class="field">
          <label for="ribBic">BIC</label>
          <input id="ribBic" v-model="form.ribBic" class="input" maxlength="20" autocomplete="off">
        </div>
        <div class="field field-full">
          <label for="ribIban">IBAN</label>
          <input id="ribIban" v-model="form.ribIban" class="input" maxlength="50" autocomplete="off">
          <span class="help">Donnée administrative privée, jamais publiée sur le site.</span>
        </div>
        <div class="field field-full">
          <label for="notes">Notes internes</label>
          <textarea id="notes" v-model="form.notes" class="textarea" />
        </div>
      </div>

      <div class="actions" style="margin-top: 22px">
        <button class="btn btn-primary" type="submit" :disabled="saving">
          {{ saving ? 'Création…' : 'Créer l’intervenant' }}
        </button>
        <NuxtLink class="btn btn-secondary" to="/dashboard/intervenors">
          Annuler
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
