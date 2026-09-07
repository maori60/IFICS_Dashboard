<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
useHead({ title: 'Récupération MFA' })
const route = useRoute()
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const pending = ref(false)
const done = ref(false)
const errorMessage = ref('')
async function complete() {
  pending.value = true; errorMessage.value = ''
  try {
    await $fetch('/api/auth/mfa/recovery/complete', { method: 'POST', body: { token: token.value } })
    done.value = true
  }
  catch (error) { errorMessage.value = apiErrorMessage(error, 'Le lien est invalide ou expiré.') }
  finally { pending.value = false }
}
</script>
<template><section class="section"><div class="container recovery"><div class="card card-pad"><p class="eyebrow">Sécurité du compte</p><h1>Récupération MFA</h1><div v-if="!token" class="alert alert-error">Lien de récupération incomplet.</div><template v-else-if="done"><div class="alert alert-success">L’ancien MFA et tous les codes de récupération ont été révoqués. Vos sessions ont été fermées.</div><p>Reconnectez-vous : la plateforme vous demandera de configurer un nouveau second facteur.</p><NuxtLink to="/login" class="btn btn-primary">Se reconnecter</NuxtLink></template><template v-else><p>Cette opération invalidera l’ancien second facteur, tous les codes de secours et toutes les sessions actives.</p><div v-if="errorMessage" class="alert alert-error" role="alert">{{ errorMessage }}</div><button class="btn btn-danger" type="button" :disabled="pending" @click="complete">{{ pending ? 'Réinitialisation…' : 'Réinitialiser mon MFA' }}</button></template></div></div></section></template>
<style scoped>.recovery{max-width:620px}.card{display:flex;flex-direction:column;gap:16px}.card h1,.card p{margin:0}</style>
