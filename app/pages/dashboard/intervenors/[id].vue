<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Fiche intervenant' })

type IntervenorDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  specialty: string | null
  status: string
  siret: string | null
  ribIban: string | null
  ribBic: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  notes: string | null
  user: { id: string; status: string; mfaEnabled: boolean; lastLoginAt: string | null } | null
  projectLinks: { id: string; assignmentStatus: string; project: { id: string; reference: string | null; title: string; status: string } }[]
  documents: { id: string; type: string; status: string; title: string; version: number }[]
  accountingDocuments: { id: string; type: string; status: string; title: string; version: number }[]
  reports: { id: string; title: string; status: string }[]
}

const route = useRoute()
const intervenorId = computed(() => String(route.params.id || ''))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<IntervenorDetail>>(() => `/api/intervenors/${intervenorId.value}`)

const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('intervenor:write'))
const intervenor = computed(() => data.value?.data)

const form = reactive({
  firstName: '', lastName: '', email: '', phone: '', specialty: '', status: 'ACTIVE', siret: '', ribIban: '', ribBic: '',
  addressLine1: '', addressLine2: '', postalCode: '', city: '', country: 'France', notes: '',
})

const hydratedId = ref('')
watch(intervenor, (value) => {
  if (!value || hydratedId.value === value.id) return
  hydratedId.value = value.id
  Object.assign(form, {
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    phone: value.phone ?? '',
    specialty: value.specialty ?? '',
    status: value.status,
    siret: value.siret ?? '',
    ribIban: value.ribIban ?? '',
    ribBic: value.ribBic ?? '',
    addressLine1: value.addressLine1 ?? '',
    addressLine2: value.addressLine2 ?? '',
    postalCode: value.postalCode ?? '',
    city: value.city ?? '',
    country: value.country ?? 'France',
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
    await $fetch(`/api/intervenors/${intervenorId.value}/update`, { method: 'POST', body: { ...form } })
    await refresh()
    successMessage.value = 'Les informations de l’intervenant ont été mises à jour.'
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Impossible de mettre à jour l’intervenant.') }
  finally { saving.value = false }
}

async function archiveIntervenor() {
  if (!canWrite.value || archiving.value) return
  if (!confirm('Archiver cet intervenant ? Sa fiche restera dans l’historique mais ne sera plus active.')) return
  archiving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/intervenors/archive', { method: 'POST', body: { id: intervenorId.value } })
    await navigateTo('/dashboard/intervenors?archived=1')
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Impossible d’archiver l’intervenant.') }
  finally { archiving.value = false }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <p class="eyebrow">Intervenant</p>
        <h1>{{ intervenor ? `${intervenor.firstName} ${intervenor.lastName}` : 'Fiche intervenant' }}</h1>
        <p>Corrigez ou complétez les informations administratives et professionnelles.</p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/intervenors">Retour aux intervenants</NuxtLink>
    </div>

    <div v-if="error" class="alert alert-error">Impossible de charger cet intervenant.</div>
    <template v-else-if="intervenor">
      <div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div>
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>

      <form class="card card-pad" @submit.prevent="save">
        <div class="form-grid">
          <div class="field"><label for="edit-intervenor-first">Prénom *</label><input id="edit-intervenor-first" v-model="form.firstName" class="input" maxlength="100" :disabled="!canWrite" required></div>
          <div class="field"><label for="edit-intervenor-last">Nom *</label><input id="edit-intervenor-last" v-model="form.lastName" class="input" maxlength="100" :disabled="!canWrite" required></div>
          <div class="field"><label for="edit-intervenor-email">E-mail *</label><input id="edit-intervenor-email" v-model="form.email" class="input" type="email" maxlength="255" :disabled="!canWrite" required></div>
          <div class="field"><label for="edit-intervenor-phone">Téléphone</label><input id="edit-intervenor-phone" v-model="form.phone" class="input" maxlength="30" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-intervenor-specialty">Spécialité</label><input id="edit-intervenor-specialty" v-model="form.specialty" class="input" maxlength="150" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-intervenor-status">Statut</label><select id="edit-intervenor-status" v-model="form.status" class="select" :disabled="!canWrite"><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option><option value="SUSPENDED">Suspendu</option></select></div>
          <div class="field"><label for="edit-intervenor-siret">SIRET</label><input id="edit-intervenor-siret" v-model="form.siret" class="input" maxlength="18" :disabled="!canWrite"></div>
          <div class="field field-full"><label for="edit-intervenor-address1">Adresse</label><input id="edit-intervenor-address1" v-model="form.addressLine1" class="input" maxlength="255" :disabled="!canWrite"></div>
          <div class="field field-full"><label for="edit-intervenor-address2">Complément d’adresse</label><input id="edit-intervenor-address2" v-model="form.addressLine2" class="input" maxlength="255" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-intervenor-postal">Code postal</label><input id="edit-intervenor-postal" v-model="form.postalCode" class="input" maxlength="20" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-intervenor-city">Ville</label><input id="edit-intervenor-city" v-model="form.city" class="input" maxlength="120" :disabled="!canWrite"></div>
          <div class="field"><label for="edit-intervenor-country">Pays</label><input id="edit-intervenor-country" v-model="form.country" class="input" maxlength="100" :disabled="!canWrite"></div>
        </div>

        <h2 style="margin-top:28px">Coordonnées bancaires privées</h2>
        <div class="form-grid">
          <div class="field"><label for="edit-intervenor-bic">BIC</label><input id="edit-intervenor-bic" v-model="form.ribBic" class="input" maxlength="20" autocomplete="off" :disabled="!canWrite"></div>
          <div class="field field-full"><label for="edit-intervenor-iban">IBAN</label><input id="edit-intervenor-iban" v-model="form.ribIban" class="input" maxlength="50" autocomplete="off" :disabled="!canWrite"><span class="help">Donnée administrative privée, jamais publiée.</span></div>
          <div class="field field-full"><label for="edit-intervenor-notes">Notes internes</label><textarea id="edit-intervenor-notes" v-model="form.notes" class="textarea" :disabled="!canWrite" /></div>
        </div>

        <div v-if="canWrite" class="actions" style="margin-top:22px"><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer les modifications' }}</button><button class="btn btn-secondary" type="button" :disabled="archiving" @click="archiveIntervenor">{{ archiving ? 'Archivage…' : 'Archiver l’intervenant' }}</button></div>
      </form>

      <section class="grid grid-3" style="margin-top:18px">
        <div class="card card-pad"><h3>Missions</h3><p>{{ intervenor.projectLinks.length }}</p></div>
        <div class="card card-pad"><h3>Documents</h3><p>{{ intervenor.documents.length + intervenor.accountingDocuments.length }}</p></div>
        <div class="card card-pad"><h3>Bilans</h3><p>{{ intervenor.reports.length }}</p></div>
      </section>

      <section v-if="intervenor.projectLinks.length" class="card card-pad" style="margin-top:18px">
        <h2>Projets liés</h2>
        <div class="assignment-list">
          <NuxtLink v-for="link in intervenor.projectLinks" :key="link.id" :to="`/dashboard/projects/${link.project.id}`" class="assignment-row">
            <span>{{ link.project.title }} <small v-if="link.project.reference" class="muted">{{ link.project.reference }}</small></span>
            <span class="badge badge-muted">{{ link.assignmentStatus }}</span>
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.assignment-list{display:grid;gap:8px}.assignment-row{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--ifics-border);border-radius:10px;text-decoration:none;color:inherit}
</style>
