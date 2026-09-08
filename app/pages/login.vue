<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'default' })
useHead({ title: 'Connexion' })

const form = reactive({ email: '', password: '' })
const pending = ref(false)
const checkingSession = ref(true)
const errorMessage = ref('')

type LoginResponse = {
  user: { id: string; email: string; firstName: string; lastName: string; roleCode: string; roleName: string }
  mfaRequired: boolean
  mfaSetupRequired: boolean
}

onMounted(async () => {
  try {
    const current = await $fetch<ApiSuccess<SessionPayload>>('/api/auth/me')
    if (current.data.mfa.setupRequired || (current.data.mfa.enabled && !current.data.mfa.verified)) {
      await navigateTo('/mfa')
      return
    }
    await navigateTo('/dashboard')
  }
  catch {
    checkingSession.value = false
  }
})

async function submit() {
  if (pending.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<ApiSuccess<LoginResponse>>('/api/auth/login', { method: 'POST', body: form })
    if (response.data.mfaRequired || response.data.mfaSetupRequired) await navigateTo('/mfa')
    else await navigateTo('/dashboard')
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Connexion impossible. Vérifiez vos identifiants.')
  }
  finally { pending.value = false }
}
</script>

<template>
  <section class="section auth-section">
    <div class="container auth-grid">
      <div><p class="eyebrow">Espace sécurisé</p><h1 class="section-title">Piloter IFICS avec une plateforme unique.</h1><p class="lead">Projets, intervenants, partenaires, documents, facturation, support et fonctions internes sont protégés par des droits d’accès et le MFA lorsque requis.</p></div>
      <div v-if="checkingSession" class="card card-pad auth-card"><h2>Vérification de la session…</h2><p class="muted">Si votre session IFICS est encore valide, vous serez redirigé sans nouvelle authentification.</p></div>
      <form v-else class="card card-pad auth-card" @submit.prevent="submit">
        <h2>Connexion</h2>
        <p class="muted">Utilisez le compte créé ou invité par IFICS.</p>
        <div v-if="errorMessage" class="alert alert-error" role="alert">{{ errorMessage }}</div>
        <div class="field"><label for="email">Adresse e-mail</label><input id="email" v-model="form.email" class="input" type="email" autocomplete="username" required></div>
        <div class="field"><label for="password">Mot de passe</label><input id="password" v-model="form.password" class="input" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary" type="submit" :disabled="pending">{{ pending ? 'Connexion…' : 'Se connecter' }}</button>
        <NuxtLink to="/mot-de-passe-oublie" class="forgot-link">Mot de passe oublié ?</NuxtLink>
      </form>
    </div>
  </section>
</template>

<style scoped>
.auth-section { min-height: 72vh; display: grid; align-items: center; }
.auth-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 56px; align-items: center; }
.auth-card { display: flex; flex-direction: column; gap: 17px; max-width: 470px; width: 100%; justify-self: end; }
.auth-card h2, .auth-card p { margin: 0; }
.forgot-link { color: var(--ifics-green-700); font-weight: 700; font-size: .9rem; }
@media (max-width: 850px) { .auth-grid { grid-template-columns: 1fr; gap: 28px; }.auth-card { justify-self: stretch; max-width: none; } }
</style>