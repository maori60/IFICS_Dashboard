<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Créer un partenaire' })

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('partner:write'))

const form = reactive({
  name: '',
  type: 'INSTITUTIONAL',
  stage: 'IDENTIFIED',
  website: '',
  logoUrl: '',
  descriptionFr: '',
  descriptionEn: '',
  publicEnabled: false,
  notes: '',
})
const saving = ref(false)
const errorMessage = ref('')

async function submit() {
  if (!canWrite.value || saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<ApiSuccess<{ id: string }>>('/api/partners/create', { method: 'POST', body: form })
    await navigateTo(`/dashboard/partners/${response.data.id}?created=1`)
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Le partenaire n’a pas pu être créé.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Nouveau partenaire</h1><p>Créez une organisation dans le CRM IFICS.</p></div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/partners">Retour</NuxtLink>
    </div>
    <div v-if="!canWrite" class="alert alert-error">Votre rôle ne permet pas de créer un partenaire.</div>
    <form v-else class="card card-pad" @submit.prevent="submit">
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>
      <div class="form-grid">
        <div class="field field-full"><label for="partner-name">Nom *</label><input id="partner-name" v-model="form.name" class="input" maxlength="200" required></div>
        <div class="field"><label for="partner-type">Type *</label><select id="partner-type" v-model="form.type" class="select" required><option value="INSTITUTIONAL">Institutionnel</option><option value="COLLECTIVITY">Collectivité</option><option value="COMPANY">Entreprise</option><option value="PATRON">Mécène</option><option value="OPERATIONAL">Opérationnel</option><option value="TECHNICAL">Technique</option></select></div>
        <div class="field"><label for="partner-stage">Étape *</label><select id="partner-stage" v-model="form.stage" class="select" required><option value="IDENTIFIED">Identifié</option><option value="CONTACTED">Contacté</option><option value="MEETING">Rendez-vous</option><option value="PROPOSAL">Proposition</option><option value="NEGOTIATION">Négociation</option><option value="WON">Partenaire actif</option><option value="LOST">Perdu</option></select></div>
        <div class="field"><label for="partner-website">Site web</label><input id="partner-website" v-model="form.website" class="input" maxlength="500" placeholder="https://"></div>
        <div class="field"><label for="partner-logo">URL du logo</label><input id="partner-logo" v-model="form.logoUrl" class="input" maxlength="500" placeholder="https://"></div>
        <div class="field field-full"><label for="partner-description-fr">Description FR</label><textarea id="partner-description-fr" v-model="form.descriptionFr" class="textarea" rows="5" /></div>
        <div class="field field-full"><label for="partner-description-en">Description EN</label><textarea id="partner-description-en" v-model="form.descriptionEn" class="textarea" rows="4" /></div>
        <div class="field field-full"><label for="partner-notes">Notes internes</label><textarea id="partner-notes" v-model="form.notes" class="textarea" rows="4" /></div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:16px"><input v-model="form.publicEnabled" type="checkbox"> Autoriser l’affichage public du partenaire</label>
      <div class="actions" style="margin-top:22px"><button class="btn btn-primary" type="submit" :disabled="saving || !form.name.trim()">{{ saving ? 'Création…' : 'Créer le partenaire' }}</button><NuxtLink class="btn btn-secondary" to="/dashboard/partners">Annuler</NuxtLink></div>
    </form>
  </div>
</template>
