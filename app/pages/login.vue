<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'default' })
useHead({
  title: 'Connexion',
  meta: [
    {
      name: 'robots',
      content: 'noindex, nofollow, noarchive',
    },
  ],
})

const form = reactive({ email: '', password: '' })
const pending = ref(false)
const checkingSession = ref(true)
const errorMessage = ref('')

type LoginResponse = {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    roleCode: string
    roleName: string
  }
  mfaRequired: boolean
  mfaSetupRequired: boolean
}

onMounted(async () => {
  try {
    const current = await $fetch<ApiSuccess<SessionPayload>>('/api/auth/me')

    if (
      current.data.mfa.setupRequired
      || (current.data.mfa.enabled && !current.data.mfa.verified)
    ) {
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
    const response = await $fetch<ApiSuccess<LoginResponse>>(
      '/api/auth/login',
      {
        method: 'POST',
        body: form,
      },
    )

    if (response.data.mfaRequired || response.data.mfaSetupRequired) {
      await navigateTo('/mfa')
    }
    else {
      await navigateTo('/dashboard')
    }
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(
      error,
      'Connexion impossible. Vérifiez vos identifiants.',
    )
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="v9-page v9-login">
    <section class="v9-login-section">
      <div class="container v9-login-grid">
        <div class="v9-login-copy">
          <p class="v9-eyebrow">Espace sécurisé</p>

          <h1>
            Piloter IFICS avec<br>
            une plateforme unique.
          </h1>

          <p class="v9-lead">
            Projets, intervenants, partenaires, documents, facturation,
            support et fonctions internes sont protégés par des droits
            d’accès et le MFA lorsque requis.
          </p>

          <div class="v9-security-line">
            <span>✓</span>
            <p>
              Accès réservé aux comptes créés ou invités par IFICS.
            </p>
          </div>
        </div>

        <div
          v-if="checkingSession"
          class="v9-login-card"
        >
          <div class="v9-login-card-head">
            <span class="v9-login-lock">◇</span>
            <div>
              <h2>Vérification de la session…</h2>
              <p>
                Si votre session IFICS est encore valide,
                vous serez redirigé automatiquement.
              </p>
            </div>
          </div>

          <div class="v9-session-loader">
            <span />
          </div>
        </div>

        <form
          v-else
          class="v9-login-card"
          @submit.prevent="submit"
        >
          <div class="v9-login-card-head">
            <span class="v9-login-lock">◇</span>

            <div>
              <h2>Connexion</h2>
              <p>Utilisez le compte créé ou invité par IFICS.</p>
            </div>
          </div>

          <div
            v-if="errorMessage"
            class="v9-login-error"
            role="alert"
          >
            {{ errorMessage }}
          </div>

          <div class="v9-field">
            <label for="email">Adresse e-mail</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="username"
              required
            >
          </div>

          <div class="v9-field">
            <label for="password">Mot de passe</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
            >
          </div>

          <button
            class="v9-btn v9-btn-primary v9-login-submit"
            type="submit"
            :disabled="pending"
          >
            {{ pending ? 'Connexion…' : 'Se connecter' }}
          </button>

          <NuxtLink
            to="/mot-de-passe-oublie"
            class="v9-forgot"
          >
            Mot de passe oublié ?
          </NuxtLink>
        </form>
      </div>
    </section>

    <section class="v9-login-bottom">
      <div class="container">
        <div class="v9-login-help">
          <div>
            <p class="v9-eyebrow">Besoin d’un accès ?</p>
            <h2>Votre accès dépend de votre rôle dans IFICS.</h2>
          </div>

          <div>
            <p>
              Les accès sont gérés par l’équipe IFICS.
              Si vous participez à un projet, contactez votre référent.
            </p>

            <NuxtLink to="/contact" class="v9-btn v9-btn-secondary">
              Nous contacter
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
