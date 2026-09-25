<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Administration — IFICS' })

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  status: string
  mfaEnabled: boolean
  lastLoginAt: string | null
  role: { code: string; name: string }
  _count: { sessions: number }
}

type IntervenorOption = {
  id: string
  firstName: string
  lastName: string
  email: string
  specialty: string | null
}

type Invitation = {
  expiresAt: string
  emailDelivered: boolean
  activationUrl: string | null
}

type InvitationResult = {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  invitation: Invitation
}

type Audit = {
  id: string
  action: string
  outcome: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

type AuditPage = {
  items: Audit[]
  total: number
  page: number
  pages: number
  limit: number
}

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>(
  '/api/auth/me',
  { key: 'session-me' },
)

function hasPermission(permission: string): boolean {
  const permissions = session.value?.data.user.permissions ?? []
  return permissions.includes('*') || permissions.includes(permission)
}

const canManageUsers = computed(() => hasPermission('user:manage'))
const canReadAudit = computed(() => hasPermission('audit:read'))

// L’API d’options des intervenants exige actuellement project:assign.
const canInviteIntervenor = computed(
  () => canManageUsers.value && hasPermission('project:assign'),
)

const {
  data: usersData,
  error: usersError,
  status: usersStatus,
  refresh: refreshUsers,
} = await useFetch<ApiSuccess<User[]>>('/api/users', {
  immediate: canManageUsers.value,
})

const users = computed(() => usersData.value?.data ?? [])

const {
  data: intervenorsData,
  error: intervenorsError,
  status: intervenorsStatus,
  refresh: refreshIntervenors,
} = await useFetch<ApiSuccess<IntervenorOption[]>>(
  '/api/intervenors/options',
  { immediate: canInviteIntervenor.value },
)

const intervenors = computed(() => intervenorsData.value?.data ?? [])

const invitationForm = reactive({
  intervenorId: '',
  firstName: '',
  lastName: '',
  email: '',
})

const selectedIntervenor = computed(() =>
  intervenors.value.find(
    item => item.id === invitationForm.intervenorId,
  ) ?? null,
)

watch(selectedIntervenor, (value) => {
  invitationForm.firstName = value?.firstName ?? ''
  invitationForm.lastName = value?.lastName ?? ''
  invitationForm.email = value?.email ?? ''
})

const inviting = ref(false)
const invitationError = ref('')
const invitationResult = ref<InvitationResult | null>(null)

const canSubmitInvitation = computed(() =>
  canInviteIntervenor.value
  && Boolean(selectedIntervenor.value)
  && Boolean(invitationForm.firstName.trim())
  && Boolean(invitationForm.lastName.trim())
  && Boolean(invitationForm.email.trim())
  && !inviting.value
  && !invitationResult.value
  && !intervenorsError.value
  && intervenorsStatus.value !== 'pending',
)

const page = ref(1)
const filters = reactive({
  action: '',
  entityType: '',
  entityId: '',
  userId: '',
  outcome: '',
  from: '',
  to: '',
})

const auditQuery = computed(() => ({
  page: page.value,
  limit: 25,
  action: filters.action || undefined,
  entityType: filters.entityType || undefined,
  entityId: filters.entityId || undefined,
  userId: filters.userId || undefined,
  outcome: filters.outcome || undefined,
  from: filters.from || undefined,
  to: filters.to || undefined,
}))

const {
  data: auditData,
  error: auditError,
  refresh: refreshAudit,
  pending: auditPending,
} = await useFetch<ApiSuccess<AuditPage>>('/api/audit', {
  query: auditQuery,
  watch: false,
  immediate: canReadAudit.value,
})

const auditPage = computed(() => auditData.value?.data ?? {
  items: [],
  total: 0,
  page: 1,
  pages: 1,
  limit: 25,
})

const audit = computed(() => auditPage.value.items)

function date(value: string | null): string {
  if (!value) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: session.value?.data.association?.timezone || 'Europe/Paris',
  }).format(new Date(value))
}

async function inviteIntervenor() {
  if (!canSubmitInvitation.value) return

  inviting.value = true
  invitationError.value = ''

  try {
    const response = await $fetch<ApiSuccess<InvitationResult>>(
      '/api/users/create',
      {
        method: 'POST',
        body: {
          firstName: invitationForm.firstName.trim(),
          lastName: invitationForm.lastName.trim(),
          email: invitationForm.email.trim(),
          roleCode: 'INTERVENOR',
          intervenorId: invitationForm.intervenorId,
        },
      },
    )

    invitationResult.value = response.data
  }
  catch (err) {
    invitationError.value = apiErrorMessage(
      err,
      'La création du compte n’a pas pu être confirmée. Vérifiez la liste des utilisateurs avant de réessayer.',
    )
  }
  finally {
    const updates = [refreshUsers()]

    if (canReadAudit.value) updates.push(refreshAudit())

    await Promise.allSettled(updates)
    inviting.value = false
  }
}

function startAnotherInvitation() {
  invitationResult.value = null
  invitationError.value = ''

  Object.assign(invitationForm, {
    intervenorId: '',
    firstName: '',
    lastName: '',
    email: '',
  })
}

async function applyFilters() {
  if (auditPending.value || !canReadAudit.value) return
  page.value = 1
  await refreshAudit()
}

async function resetFilters() {
  if (auditPending.value || !canReadAudit.value) return

  Object.assign(filters, {
    action: '',
    entityType: '',
    entityId: '',
    userId: '',
    outcome: '',
    from: '',
    to: '',
  })

  page.value = 1
  await refreshAudit()
}

async function goToPage(next: number) {
  if (
    auditPending.value
    || !canReadAudit.value
    || next < 1
    || next > auditPage.value.pages
    || next === page.value
  ) return

  page.value = next
  await refreshAudit()
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Administration</h1>
        <p>Comptes, MFA, sessions et journal d’audit.</p>
      </div>
    </div>

    <section
      v-if="canInviteIntervenor"
      class="card card-pad admin-section"
      :aria-busy="inviting"
    >
      <h2>Inviter un intervenant</h2>
      <p class="muted">
        Créez un compte de connexion rattaché à une fiche intervenant existante.
        Le destinataire choisira son mot de passe lors de l’activation.
      </p>

      <div v-if="invitationResult" class="invitation-result">
        <div class="alert alert-success" role="status">
          Le compte de
          {{ invitationResult.user.firstName }}
          {{ invitationResult.user.lastName }}
          a été créé et rattaché à la fiche intervenant.
        </div>

        <p>
          Adresse du compte :
          <strong>{{ invitationResult.user.email }}</strong>
        </p>

        <p v-if="invitationResult.invitation.emailDelivered">
          L’invitation a été transmise au serveur de messagerie.
        </p>
        <p v-else>
          L’invitation n’a pas été envoyée par email.
          Utilisez le lien d’activation ci-dessous.
        </p>

        <div
          v-if="invitationResult.invitation.activationUrl"
          class="field"
        >
          <label for="activation-url">Lien d’activation personnel</label>
          <input
            id="activation-url"
            class="input activation-input"
            :value="invitationResult.invitation.activationUrl"
            readonly
            autocomplete="off"
            spellcheck="false"
          >
          <small class="muted">
            Copiez ce lien pour activer le compte.
            Il permet de définir le mot de passe : ne le publiez pas.
          </small>
        </div>

        <p>
          Expiration :
          {{ date(invitationResult.invitation.expiresAt) }}
        </p>

        <button
          class="btn btn-secondary"
          type="button"
          :disabled="inviting"
          @click="startAnotherInvitation"
        >
          Préparer une autre invitation
        </button>
      </div>

      <template v-else>
        <p v-if="intervenorsStatus === 'pending'" role="status">
          Chargement des intervenants…
        </p>

        <div
          v-else-if="intervenorsError"
          class="alert alert-error"
          role="alert"
        >
          <p>Impossible de charger les intervenants.</p>
          <button
            class="btn btn-secondary"
            type="button"
            @click="refreshIntervenors()"
          >
            Réessayer
          </button>
        </div>

        <p v-else-if="!intervenors.length" class="empty-state">
          Aucun intervenant actif disponible. Créez d’abord sa fiche
          dans la rubrique Intervenants.
        </p>

        <form
          v-else
          class="invitation-form"
          @submit.prevent="inviteIntervenor"
        >
          <fieldset :disabled="inviting">
            <div class="form-grid">
              <div class="field field-full">
                <label for="invite-intervenor">Intervenant associé *</label>
                <select
                  id="invite-intervenor"
                  v-model="invitationForm.intervenorId"
                  class="select"
                  required
                >
                  <option value="" disabled>Sélectionner un intervenant</option>
                  <option
                    v-for="intervenor in intervenors"
                    :key="intervenor.id"
                    :value="intervenor.id"
                  >
                    {{ intervenor.firstName }} {{ intervenor.lastName }}
                    — {{ intervenor.email }}
                  </option>
                </select>
                <small class="muted">
                  Une fiche ne peut être rattachée qu’à un seul compte.
                </small>
              </div>

              <div class="field">
                <label for="invite-first-name">Prénom *</label>
                <input
                  id="invite-first-name"
                  v-model="invitationForm.firstName"
                  class="input"
                  maxlength="100"
                  autocomplete="off"
                  required
                >
              </div>

              <div class="field">
                <label for="invite-last-name">Nom *</label>
                <input
                  id="invite-last-name"
                  v-model="invitationForm.lastName"
                  class="input"
                  maxlength="100"
                  autocomplete="off"
                  required
                >
              </div>

              <div class="field">
                <label for="invite-email">Email de connexion *</label>
                <input
                  id="invite-email"
                  v-model="invitationForm.email"
                  class="input"
                  type="email"
                  maxlength="254"
                  autocomplete="off"
                  required
                >
              </div>

              <div class="field">
                <label for="invite-role">Rôle</label>
                <input
                  id="invite-role"
                  class="input"
                  value="Intervenant"
                  readonly
                >
              </div>
            </div>

            <p v-if="selectedIntervenor" class="muted">
              Ce compte sera lié à
              <strong>
                {{ selectedIntervenor.firstName }}
                {{ selectedIntervenor.lastName }}
              </strong>
              et permettra de répondre à ses propositions de mission.
            </p>

            <button
              class="btn btn-primary"
              type="submit"
              :disabled="!canSubmitInvitation"
            >
              {{ inviting ? 'Création en cours…' : 'Créer le compte et inviter' }}
            </button>
          </fieldset>
        </form>

        <div
          v-if="invitationError"
          class="alert alert-error invitation-error"
          role="alert"
        >
          {{ invitationError }}
        </div>
      </template>
    </section>

    <section class="card card-pad admin-section">
      <div class="audit-heading">
        <h2>Utilisateurs</h2>
        <button
          v-if="canManageUsers"
          class="btn btn-secondary"
          type="button"
          :disabled="usersStatus === 'pending' || inviting"
          @click="refreshUsers()"
        >
          Actualiser
        </button>
      </div>

      <p v-if="!canManageUsers" class="alert alert-error">
        Vous n’avez pas accès à la gestion des utilisateurs.
      </p>
      <p v-else-if="usersStatus === 'pending'" role="status">
        Chargement des utilisateurs…
      </p>
      <div v-else-if="usersError" class="alert alert-error" role="alert">
        Impossible de charger les utilisateurs.
      </div>
      <div v-else-if="users.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Utilisateur</th>
              <th scope="col">Rôle</th>
              <th scope="col">MFA</th>
              <th scope="col">Sessions</th>
              <th scope="col">Dernière connexion</th>
              <th scope="col">Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <strong>{{ user.firstName }} {{ user.lastName }}</strong>
                <br>
                <small>{{ user.email }}</small>
              </td>
              <td>{{ user.role.name }}</td>
              <td>
                <span
                  class="badge"
                  :class="user.mfaEnabled ? '' : 'badge-warning'"
                >
                  {{ user.mfaEnabled ? 'Actif' : 'Non activé' }}
                </span>
              </td>
              <td>{{ user._count.sessions }}</td>
              <td>{{ date(user.lastLoginAt) }}</td>
              <td>{{ user.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-state">Aucun utilisateur accessible.</p>
    </section>

    <section
      v-if="canReadAudit"
      class="card card-pad admin-section"
    >
      <div class="audit-heading">
        <div>
          <h2>Journal d’audit</h2>
          <p class="muted">
            L’historique reste conservé ; l’interface n’affiche que
            25 traces par page.
          </p>
        </div>
        <strong>{{ auditPage.total }} {{ auditPage.total === 1 ? 'trace' : 'traces' }}</strong>
      </div>

      <form class="audit-filters" @submit.prevent="applyFilters">
        <div class="field">
          <label for="audit-action">Action</label>
          <input
            id="audit-action"
            v-model="filters.action"
            class="input"
            placeholder="ex. TICKET_MANAGED"
            :disabled="auditPending"
          >
        </div>
        <div class="field">
          <label for="audit-entity">Ressource</label>
          <input
            id="audit-entity"
            v-model="filters.entityType"
            class="input"
            placeholder="ex. SupportTicket"
            :disabled="auditPending"
          >
        </div>
        <div class="field">
          <label for="audit-entity-id">ID ressource</label>
          <input
            id="audit-entity-id"
            v-model="filters.entityId"
            class="input"
            :disabled="auditPending"
          >
        </div>
        <div class="field">
          <label for="audit-user">Acteur</label>
          <select
            id="audit-user"
            v-model="filters.userId"
            class="select"
            :disabled="auditPending"
          >
            <option value="">Tous</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.firstName }} {{ user.lastName }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="audit-outcome">Résultat</label>
          <select
            id="audit-outcome"
            v-model="filters.outcome"
            class="select"
            :disabled="auditPending"
          >
            <option value="">Tous</option>
            <option value="SUCCESS">Succès</option>
            <option value="FAILURE">Échec</option>
          </select>
        </div>
        <div class="field">
          <label for="audit-from">Du</label>
          <input
            id="audit-from"
            v-model="filters.from"
            class="input"
            type="date"
            :disabled="auditPending"
          >
        </div>
        <div class="field">
          <label for="audit-to">Au</label>
          <input
            id="audit-to"
            v-model="filters.to"
            class="input"
            type="date"
            :disabled="auditPending"
          >
        </div>
        <div class="actions audit-actions">
          <button
            class="btn btn-primary"
            type="submit"
            :disabled="auditPending"
          >
            Filtrer
          </button>
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="auditPending"
            @click="resetFilters"
          >
            Réinitialiser
          </button>
        </div>
      </form>

      <div v-if="auditPending" class="empty-state" role="status">
        Chargement des traces…
      </div>
      <div v-else-if="auditError" class="alert alert-error" role="alert">
        Impossible de charger le journal d’audit.
      </div>
      <div v-else-if="!audit.length" class="empty-state">
        Aucune entrée d’audit pour ces critères.
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Action</th>
              <th scope="col">Acteur</th>
              <th scope="col">Ressource</th>
              <th scope="col">Résultat</th>
              <th scope="col">Détails</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in audit" :key="item.id">
              <td>{{ date(item.createdAt) }}</td>
              <td><strong>{{ item.action }}</strong></td>
              <td>
                {{
                  item.user
                    ? `${item.user.firstName} ${item.user.lastName}`
                    : 'Système/public'
                }}
              </td>
              <td>{{ item.entityType || '—' }} {{ item.entityId || '' }}</td>
              <td>
                <span
                  class="badge"
                  :class="item.outcome === 'FAILURE' ? 'badge-danger' : ''"
                >
                  {{ item.outcome }}
                </span>
              </td>
              <td>
                <details v-if="item.metadata">
                  <summary>Voir</summary>
                  <pre>{{ JSON.stringify(item.metadata, null, 2) }}</pre>
                </details>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button
          class="btn btn-secondary"
          type="button"
          :disabled="page <= 1 || auditPending"
          @click="goToPage(page - 1)"
        >
          Précédent
        </button>
        <span>
          Page <strong>{{ auditPage.page }}</strong>
          / {{ Math.max(1, auditPage.pages) }}
        </span>
        <button
          class="btn btn-secondary"
          type="button"
          :disabled="page >= auditPage.pages || auditPending || Boolean(auditError)"
          @click="goToPage(page + 1)"
        >
          Suivant
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-section {
  margin-bottom: 22px;
}

.admin-section h2 {
  margin-top: 0;
}

.audit-heading {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.audit-heading p {
  margin-top: -6px;
}

.audit-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}

.audit-actions {
  align-self: end;
}

.actions {
  flex-wrap: wrap;
}

.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 18px;
}

.invitation-form {
  margin-top: 18px;
}

.invitation-form fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.invitation-result {
  display: grid;
  gap: 12px;
}

.invitation-result p {
  margin: 0;
}

.invitation-result button {
  justify-self: start;
}

.invitation-error {
  margin-top: 16px;
}

.activation-input {
  font-family: monospace;
}

details {
  min-width: 80px;
}

summary {
  cursor: pointer;
  font-weight: 700;
}

pre {
  white-space: pre-wrap;
  max-width: 420px;
  font-size: .75rem;
  background: #f5f7f5;
  padding: 10px;
  border-radius: 8px;
  overflow: auto;
}

@media (max-width: 1100px) {
  .audit-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .audit-filters {
    grid-template-columns: 1fr;
  }

  .audit-heading {
    flex-direction: column;
  }
}
</style>