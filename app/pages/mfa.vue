<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'default' })
useHead({ title: 'Double authentification' })

type SetupData = { secret: string; uri: string; qrDataUrl: string }
type ConfirmData = { enabled: true; recoveryCodes: string[] }

const { data: me, error: sessionError, refresh } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me')
const session = computed(() => me.value?.data ?? null)
const setupData = ref<SetupData | null>(null)
const recoveryCodes = ref<string[]>([])
const code = ref('')
const pending = ref(false)
const errorMessage = ref('')

if (sessionError.value) await navigateTo('/login')
if (session.value?.mfa.enabled && session.value.mfa.verified) await navigateTo('/dashboard')

async function startSetup() {
  pending.value = true; errorMessage.value = ''
  try { setupData.value = (await $fetch<ApiSuccess<SetupData>>('/api/auth/mfa/setup', { method: 'POST' })).data }
  catch (error) { errorMessage.value = apiErrorMessage(error, 'Impossible de démarrer la configuration MFA.') }
  finally { pending.value = false }
}

async function confirmSetup() {
  pending.value = true; errorMessage.value = ''
  try {
    const result = await $fetch<ApiSuccess<ConfirmData>>('/api/auth/mfa/confirm', { method: 'POST', body: { code: code.value } })
    recoveryCodes.value = result.data.recoveryCodes
    setupData.value = null
    code.value = ''
    await refresh()
  }
  catch (error) { errorMessage.value = apiErrorMessage(error, 'Code incorrect.') }
  finally { pending.value = false }
}

async function verify() {
  pending.value = true; errorMessage.value = ''
  try {
    await $fetch('/api/auth/mfa/verify', { method: 'POST', body: { code: code.value } })
    await navigateTo('/dashboard')
  }
  catch (error) { errorMessage.value = apiErrorMessage(error, 'Code MFA ou code de récupération invalide.') }
  finally { pending.value = false }
}
</script>

<template>
  <section class="section">
    <div class="container mfa-wrap">
      <div class="card card-pad mfa-card">
        <p class="eyebrow">Sécurité du compte</p>
        <h1>Double authentification</h1>
        <p class="muted">Le MFA protège les comptes sensibles même si un mot de passe est compromis.</p>
        <div v-if="errorMessage" class="alert alert-error" role="alert">{{ errorMessage }}</div>

        <template v-if="recoveryCodes.length">
          <div class="alert alert-warning"><strong>Codes de récupération</strong><br>Conservez-les hors ligne. Chaque code est à usage unique.</div>
          <ul class="recovery-list"><li v-for="recoveryCode in recoveryCodes" :key="recoveryCode"><code>{{ recoveryCode }}</code></li></ul>
          <NuxtLink to="/dashboard" class="btn btn-primary">J’ai enregistré mes codes</NuxtLink>
        </template>

        <template v-else-if="session?.mfa.setupRequired">
          <template v-if="!setupData">
            <p>Installez une application TOTP (Microsoft Authenticator, Google Authenticator, 2FAS, etc.), puis démarrez l’enrôlement.</p>
            <button class="btn btn-primary" type="button" :disabled="pending" @click="startSetup">Configurer le MFA</button>
          </template>
          <template v-else>
            <img class="qr" :src="setupData.qrDataUrl" alt="QR code de configuration MFA">
            <p class="secret"><span>Clé manuelle</span><code>{{ setupData.secret }}</code></p>
            <div class="field"><label for="mfa-confirm-code">Code à 6 chiffres</label><input id="mfa-confirm-code" v-model="code" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>
            <button class="btn btn-primary" type="button" :disabled="pending || code.length !== 6" @click="confirmSetup">Activer le MFA</button>
          </template>
        </template>

        <template v-else>
          <div class="field"><label for="mfa-code">Code MFA ou code de récupération</label><input id="mfa-code" v-model="code" class="input" autocomplete="one-time-code" maxlength="32"></div>
          <button class="btn btn-primary" type="button" :disabled="pending || code.length < 6" @click="verify">Valider</button>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mfa-wrap { display: grid; place-items: center; min-height: 68vh; }
.mfa-card { width: min(560px, 100%); display: flex; flex-direction: column; gap: 16px; }
.mfa-card h1, .mfa-card p { margin: 0; }
.qr { width: 280px; max-width: 100%; align-self: center; border: 1px solid var(--ifics-border); border-radius: 12px; }
.secret { display: flex; flex-direction: column; gap: 5px; word-break: break-all; }
.recovery-list { columns: 2; margin: 0; padding-left: 20px; }
@media (max-width: 520px) { .recovery-list { columns: 1; } }
</style>
