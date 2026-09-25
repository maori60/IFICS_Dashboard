<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

const props = defineProps<{
  entity: 'client' | 'partner' | 'intervenor' | 'project' | 'asset' | 'rnd' | 'content' | 'billing' | 'expense' | 'cra' | 'report'
  entityId: string
  label: string
  returnTo: string
}>()

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const isAdmin = computed(() => session.value?.data.user.roleCode === 'ADMIN')
const deleting = ref(false)
const errorMessage = ref('')

async function permanentlyDelete() {
  if (!isAdmin.value || deleting.value) return

  const first = window.confirm(
    `Supprimer définitivement « ${props.label} » ?\n\nCette action n’est proposée que lorsque les règles de conservation le permettent.`,
  )
  if (!first) return

  const confirmation = window.prompt('Pour confirmer, saisissez exactement : SUPPRIMER')
  if (confirmation !== 'SUPPRIMER') return

  deleting.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/delete/${props.entity}/${props.entityId}`, {
      method: 'DELETE',
      body: { confirmation },
    })
    await navigateTo(`${props.returnTo}${props.returnTo.includes('?') ? '&' : '?'}deleted=1`)
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(
      error,
      'La suppression définitive n’a pas pu être effectuée.',
    )
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <section v-if="isAdmin" class="card card-pad permanent-delete-panel">
    <div>
      <p class="eyebrow">Zone sensible</p>
      <h2>Suppression définitive</h2>
      <p>Réservée aux données de test ou sans historique à conserver. Le serveur bloque automatiquement la suppression lorsqu’une dépendance métier, financière ou documentaire l’interdit.</p>
      <p v-if="errorMessage" class="alert alert-error" role="alert">{{ errorMessage }}</p>
    </div>
    <button class="btn btn-danger" type="button" :disabled="deleting" @click="permanentlyDelete">
      {{ deleting ? 'Suppression…' : 'Supprimer définitivement' }}
    </button>
  </section>
</template>

<style scoped>
.permanent-delete-panel { display:flex; align-items:center; justify-content:space-between; gap:24px; margin-top:22px; border-color:#eccaca; background:#fffafa; }
.permanent-delete-panel h2 { margin:5px 0 8px; font-size:1.12rem; }
.permanent-delete-panel p { max-width:820px; margin:0; color:var(--ifics-muted); }
.permanent-delete-panel .alert { margin-top:14px; }
@media (max-width:760px) { .permanent-delete-panel { align-items:stretch; flex-direction:column; } .permanent-delete-panel .btn { width:100%; } }
</style>
