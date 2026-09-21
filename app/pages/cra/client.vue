<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({
  layout: 'cra-client',
})

useHead({
  title: 'CRA sécurisé — IFICS',

  meta: [
    {
      name: 'robots',
      content:
        'noindex, nofollow, noarchive',
    },
    {
      name: 'referrer',
      content:
        'no-referrer',
    },
  ],
})

type CraClientPayload = {
  access: {
    purpose:
      | 'INITIAL_CONFIRMATION'
      | 'REDOWNLOAD'

    expiresAt: string
    canViewDocument: boolean
    canDownloadDocument: boolean
    canDecide: boolean
  }

  report: {
    year: number
    month: number

    project: {
      reference: string
      title: string
    }

    intervenor: {
      firstName: string
      lastName: string
    }
  }

  document: {
    reference: string
    status: string
    originalName: string
    mimeType:
      | 'application/pdf'
      | 'image/png'
      | 'image/jpeg'
      | string

    fileSize: string
  }
}

const loading = ref(true)
const deciding = ref(false)

const decisionResult
  = ref<
    | 'ACCEPTED'
    | 'REFUSED'
    | null
  >(null)

const decisionFirstName = ref('')
const decisionLastName = ref('')
const decisionJobTitle = ref('')
const decisionComment = ref('')

const errorMessage = ref('')

const payload
  = ref<CraClientPayload | null>(
    null,
  )

const documentUrl
  = '/api/cra-client/document'

const downloadUrl
  = '/api/cra-client/document?download=1'

const viewerSurface
  = ref<HTMLElement | null>(null)

const imageZoom = ref(1)

const canUseFullscreen
  = ref(false)

const isFullscreen
  = ref(false)

const periodLabel = computed(() => {
  if (!payload.value) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      month: 'long',
      year: 'numeric',
    },
  ).format(
    new Date(
      payload.value.report.year,
      payload.value.report.month - 1,
      1,
    ),
  )
})

const expiresLabel = computed(() => {
  if (!payload.value) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle: 'long',
      timeStyle: 'short',
    },
  ).format(
    new Date(
      payload.value.access.expiresAt,
    ),
  )
})

const intervenorName = computed(() => {
  if (!payload.value) {
    return ''
  }

  return [
    payload.value.report.intervenor
      .firstName,

    payload.value.report.intervenor
      .lastName,
  ]
    .filter(Boolean)
    .join(' ')
})

const isPdf = computed(
  () =>
    payload.value?.document.mimeType
    === 'application/pdf',
)

const isImage = computed(
  () =>
    payload.value?.document.mimeType
    === 'image/png'
    || payload.value?.document.mimeType
    === 'image/jpeg',
)

function formatBytes(
  raw: string,
): string {
  const bytes = Number(raw)

  if (
    !Number.isFinite(bytes)
    || bytes < 0
  ) {
    return '—'
  }

  if (bytes < 1024) {
    return `${bytes} o`
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} Ko`
  }

  return `${(
    bytes
    / (1024 * 1024)
  ).toFixed(1)} Mo`
}

function zoomImage(
  delta: number,
) {
  imageZoom.value
    = Math.min(
      3,
      Math.max(
        0.5,
        Number(
          (
            imageZoom.value
            + delta
          ).toFixed(2),
        ),
      ),
    )
}

async function toggleFullscreen() {
  const surface
    = viewerSurface.value

  if (!surface) {
    return
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
    else {
      await surface.requestFullscreen()
    }
  }
  catch {
    // Le navigateur peut refuser le plein écran.
  }
}

function handleFullscreenChange() {
  isFullscreen.value
    = Boolean(
      document.fullscreenElement,
    )
}

async function exchangeTokenFromFragment() {
  const rawHash
    = window.location.hash
      .replace(/^#/, '')

  const params
    = new URLSearchParams(
      rawHash,
    )

  const token
    = params
      .get('token')
      ?.trim()
      ?? ''

  /*
   * Le secret disparaît de la barre d'adresse
   * avant tout appel réseau.
   */
  if (window.location.hash) {
    window.history.replaceState(
      window.history.state,
      document.title,
      `${window.location.pathname}${window.location.search}`,
    )
  }

  if (!token) {
    return
  }

  await $fetch(
    '/api/cra-client/exchange',
    {
      method: 'POST',

      body: {
        token,
      },
    },
  )
}

async function loadClientSession() {
  const response
    = await $fetch<
      ApiSuccess<CraClientPayload>
    >(
      '/api/cra-client/me',
    )

  payload.value
    = response.data
}

async function initialize() {
  loading.value = true
  errorMessage.value = ''

  try {
    await exchangeTokenFromFragment()
    await loadClientSession()
  }
  catch (error) {
    payload.value = null

    errorMessage.value
      = apiErrorMessage(
        error,
        'Ce lien CRA est invalide, expiré ou a déjà été utilisé.',
      )
  }
  finally {
    loading.value = false
  }
}

async function submitDecision(
  decision:
    | 'ACCEPTED'
    | 'REFUSED',
) {
  if (
    deciding.value
    || !payload.value?.access.canDecide
  ) {
    return
  }

  const firstName
    = decisionFirstName.value.trim()

  const lastName
    = decisionLastName.value.trim()

  const jobTitle
    = decisionJobTitle.value.trim()

  const comment
    = decisionComment.value.trim()

  if (
    !firstName
    || !lastName
    || !jobTitle
  ) {
    errorMessage.value
      = 'Le prénom, le nom et la fonction sont obligatoires.'

    return
  }

  if (
    decision === 'REFUSED'
    && !comment
  ) {
    errorMessage.value
      = 'Le commentaire est obligatoire pour refuser le CRA.'

    return
  }

  const accepted
    = window.confirm(
      decision === 'ACCEPTED'
        ? [
            'Confirmer l’acceptation de ce CRA ?',
            '',
            'Votre décision sera enregistrée définitivement',
            'et une attestation horodatée sera générée.',
          ].join('\n')
        : [
            'Confirmer le refus de ce CRA ?',
            '',
            'Votre refus et votre commentaire seront enregistrés',
            'définitivement dans une attestation horodatée.',
          ].join('\n'),
    )

  if (!accepted) {
    return
  }

  deciding.value = true
  errorMessage.value = ''

  try {
    await $fetch(
      '/api/cra-client/decision',
      {
        method: 'POST',

        body: {
          decision,
          firstName,
          lastName,
          jobTitle,

          comment:
            comment || null,
        },
      },
    )

    decisionResult.value
      = decision

    payload.value
      = null
  }
  catch (error) {
    errorMessage.value
      = apiErrorMessage(
        error,
        'La décision n’a pas pu être enregistrée.',
      )
  }
  finally {
    deciding.value = false
  }
}

onMounted(() => {
  canUseFullscreen.value
    = Boolean(
      document.fullscreenEnabled,
    )

  document.addEventListener(
    'fullscreenchange',
    handleFullscreenChange,
  )

  void initialize()
})

onBeforeUnmount(() => {
  document.removeEventListener(
    'fullscreenchange',
    handleFullscreenChange,
  )
})
</script>

<template>
  <section class="cra-client-page">
    <div
      v-if="loading"
      class="state-card"
      aria-live="polite"
    >
      <span
        class="loader"
        aria-hidden="true"
      />

      <div>
        <h1>
          Ouverture du document sécurisé
        </h1>

        <p>
          Vérification du lien en cours…
        </p>
      </div>
    </div>

    <div
      v-else-if="decisionResult"
      class="state-card"
      :class="{
        'success-card':
          decisionResult === 'ACCEPTED',

        'refusal-card':
          decisionResult === 'REFUSED',
      }"
      role="status"
    >
      <span
        class="state-icon"
        aria-hidden="true"
      >
        {{
          decisionResult === 'ACCEPTED'
            ? '✓'
            : '×'
        }}
      </span>

      <div>
        <h1>
          {{
            decisionResult === 'ACCEPTED'
              ? 'CRA accepté'
              : 'CRA refusé'
          }}
        </h1>

        <p v-if="decisionResult === 'ACCEPTED'">
          Votre acceptation a bien été enregistrée.
          Une attestation horodatée de votre décision
          a été créée. Ce lien sécurisé est maintenant
          clôturé.
        </p>

        <p v-else>
          Votre refus et votre commentaire ont bien été
          enregistrés. Une attestation horodatée de votre
          décision a été créée et IFICS pourra examiner
          votre retour. Ce lien sécurisé est maintenant
          clôturé.
        </p>

        <p class="state-hint">
          Vous pouvez fermer cette page.
        </p>
      </div>
    </div>

    <div
      v-else-if="!payload"
      class="state-card error-card"
      role="alert"
    >
      <span
        class="state-icon"
        aria-hidden="true"
      >
        !
      </span>

      <div>
        <h1>
          Accès au CRA impossible
        </h1>

        <p>
          {{ errorMessage }}
        </p>

        <p class="state-hint">
          Si vous devez consulter de nouveau
          le document, demandez à IFICS un
          nouveau lien sécurisé.
        </p>
      </div>
    </div>

    <template v-else>
      <header class="document-heading">
        <div>
          <p class="eyebrow">
            Compte-rendu d’activité
          </p>

          <h1>
            CRA — {{ periodLabel }}
          </h1>

          <p class="heading-copy">
            Document transmis par IFICS pour
            consultation sécurisée.
          </p>
        </div>

        <div class="access-status">
          <strong>
            {{
              payload.access.purpose
                === 'INITIAL_CONFIRMATION'
                ? 'Décision attendue'
                : 'Consultation'
            }}
          </strong>

          <span>
            Accès valable jusqu’au
            {{ expiresLabel }}
          </span>
        </div>
      </header>

      <section
        class="metadata-card"
        aria-label="Informations du CRA"
      >
        <div>
          <span>Intervenant</span>
          <strong>
            {{ intervenorName }}
          </strong>
        </div>

        <div>
          <span>Projet</span>
          <strong>
            {{ payload.report.project.title }}
          </strong>

          <small>
            {{ payload.report.project.reference }}
          </small>
        </div>

        <div>
          <span>Document</span>
          <strong>
            {{ payload.document.reference }}
          </strong>

          <small>
            {{ payload.document.originalName }}
            ·
            {{ formatBytes(payload.document.fileSize) }}
          </small>
        </div>
      </section>

      <div
        v-if="errorMessage"
        class="inline-error"
        role="alert"
      >
        {{ errorMessage }}
      </div>

      <section class="viewer-card">
        <div class="viewer-toolbar">
          <div>
            <strong>
              Document signé
            </strong>

            <span>
              Lecture seule
            </span>
          </div>

          <div class="viewer-actions">
            <div
              v-if="isImage"
              class="zoom-controls"
              aria-label="Zoom de l’image"
            >
              <button
                type="button"
                aria-label="Réduire le zoom"
                :disabled="imageZoom <= 0.5"
                @click="zoomImage(-0.25)"
              >
                −
              </button>

              <span>
                {{ Math.round(imageZoom * 100) }} %
              </span>

              <button
                type="button"
                aria-label="Augmenter le zoom"
                :disabled="imageZoom >= 3"
                @click="zoomImage(0.25)"
              >
                +
              </button>
            </div>

            <button
              v-if="canUseFullscreen"
              type="button"
              class="viewer-button"
              @click="toggleFullscreen"
            >
              {{
                isFullscreen
                  ? 'Quitter le plein écran'
                  : 'Plein écran'
              }}
            </button>

            <a
              v-if="payload.access.canDownloadDocument"
              :href="downloadUrl"
              class="download-button"
            >
              Télécharger
            </a>
          </div>
        </div>

        <div
          ref="viewerSurface"
          class="viewer-surface"
        >
          <iframe
            v-if="isPdf"
            :src="documentUrl"
            class="document-frame"
            title="CRA signé"
            allowfullscreen
          />

          <img
            v-else-if="isImage"
            :src="documentUrl"
            class="document-image"
            :style="{
              width: `${imageZoom * 100}%`,
            }"
            alt="CRA signé"
          >

          <div
            v-else
            class="viewer-unavailable"
          >
            Ce format ne peut pas être affiché
            directement dans le navigateur.
          </div>
        </div>
      </section>

      <section
        v-if="payload.access.canDecide"
        class="decision-card"
        aria-labelledby="cra-client-decision-title"
      >
        <div class="decision-intro">
          <p class="eyebrow">
            Décision client
          </p>

          <h2 id="cra-client-decision-title">
            Accepter ou refuser ce CRA
          </h2>

          <p>
            Après examen du document signé, renseignez
            votre identité professionnelle puis indiquez
            votre décision.
          </p>

          <p class="decision-notice">
            Votre décision sera horodatée et conservée
            dans une attestation distincte. Le document
            signé affiché ci-dessus ne sera pas modifié.
          </p>
        </div>

        <div class="decision-fields">
          <label class="decision-field">
            <span>
              Prénom
              <strong aria-hidden="true">*</strong>
            </span>

            <input
              v-model="decisionFirstName"
              type="text"
              autocomplete="given-name"
              maxlength="120"
              :disabled="deciding"
              required
            >
          </label>

          <label class="decision-field">
            <span>
              Nom
              <strong aria-hidden="true">*</strong>
            </span>

            <input
              v-model="decisionLastName"
              type="text"
              autocomplete="family-name"
              maxlength="120"
              :disabled="deciding"
              required
            >
          </label>

          <label class="decision-field decision-field-wide">
            <span>
              Fonction
              <strong aria-hidden="true">*</strong>
            </span>

            <input
              v-model="decisionJobTitle"
              type="text"
              autocomplete="organization-title"
              maxlength="180"
              :disabled="deciding"
              placeholder="Ex. Responsable informatique"
              required
            >
          </label>

          <label class="decision-field decision-field-wide">
            <span>
              Commentaire
            </span>

            <textarea
              v-model="decisionComment"
              rows="5"
              maxlength="2000"
              :disabled="deciding"
              placeholder="Facultatif en cas d’acceptation. Obligatoire en cas de refus."
            />

            <small>
              Le commentaire est obligatoire si vous
              refusez le CRA.
            </small>
          </label>
        </div>

        <div class="decision-actions">
          <button
            type="button"
            class="decision-button refusal-button"
            :disabled="deciding"
            @click="submitDecision('REFUSED')"
          >
            {{
              deciding
                ? 'Enregistrement…'
                : 'Refuser le CRA'
            }}
          </button>

          <button
            type="button"
            class="decision-button acceptance-button"
            :disabled="deciding"
            @click="submitDecision('ACCEPTED')"
          >
            {{
              deciding
                ? 'Enregistrement…'
                : 'Accepter le CRA'
            }}
          </button>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.cra-client-page {
  display: grid;
  gap: 22px;
}

.document-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 30px;
}

.eyebrow {
  margin: 0 0 8px;
  color:
    var(--ifics-green-700, #31704f);
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.document-heading h1 {
  margin: 0;
  font-size: clamp(1.7rem, 4vw, 2.5rem);
  line-height: 1.1;
}

.heading-copy {
  margin: 10px 0 0;
  color:
    var(--ifics-muted, #68786f);
}

.access-status {
  min-width: 250px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 16px;
  border: 1px solid
    var(--ifics-border, #dfe8e2);
  border-radius: 12px;
  background: #fff;
}

.access-status strong {
  color:
    var(--ifics-green-800, #24523d);
  font-size: .86rem;
}

.access-status span {
  color:
    var(--ifics-muted, #68786f);
  font-size: .78rem;
}

.metadata-card {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid
    var(--ifics-border, #dfe8e2);
  border-radius: 14px;
  background:
    var(--ifics-border, #dfe8e2);
}

.metadata-card > div {
  min-width: 0;
  padding: 17px 18px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: #fff;
}

.metadata-card span {
  color:
    var(--ifics-muted, #68786f);
  font-size: .75rem;
}

.metadata-card strong,
.metadata-card small {
  overflow-wrap: anywhere;
}

.metadata-card small {
  color:
    var(--ifics-muted, #68786f);
}

.viewer-card {
  overflow: hidden;
  border: 1px solid
    var(--ifics-border, #dfe8e2);
  border-radius: 14px;
  background: #fff;
}

.viewer-toolbar {
  min-height: 62px;
  padding: 11px 15px 11px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid
    var(--ifics-border, #dfe8e2);
}

.viewer-toolbar > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.viewer-toolbar span {
  color:
    var(--ifics-muted, #68786f);
  font-size: .75rem;
}

.viewer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px;
  border: 1px solid
    var(--ifics-border, #dfe8e2);
  border-radius: 9px;
}

.zoom-controls button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background:
    var(--ifics-green-50, #f4f8f5);
  color:
    var(--ifics-green-900, #173f2f);
  font-size: 1.1rem;
  cursor: pointer;
}

.zoom-controls button:disabled {
  opacity: .4;
  cursor: default;
}

.zoom-controls span {
  min-width: 52px;
  text-align: center;
}

.viewer-button {
  min-height: 42px;
  padding: 8px 14px;
  border: 1px solid
    var(--ifics-border, #dfe8e2);
  border-radius: 9px;
  background: #fff;
  color:
    var(--ifics-green-800, #24523d);
  font-weight: 650;
  cursor: pointer;
}

.download-button,
.confirm-button {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
}

.download-button {
  padding: 8px 15px;
  border: 1px solid
    var(--ifics-green-700, #31704f);
  background: #fff;
  color:
    var(--ifics-green-800, #24523d);
}

.viewer-surface {
  min-height: 650px;
  overflow: auto;
  background: #eef2ef;
}

.viewer-surface:fullscreen {
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  background: #eef2ef;
}

.viewer-surface:fullscreen .document-frame {
  height: 100vh;
  min-height: 100vh;
}

.document-frame {
  width: 100%;
  height: min(78vh, 920px);
  min-height: 650px;
  display: block;
  border: 0;
  background: #fff;
}

.document-image {
  max-width: none;
  height: auto;
  display: block;
  margin: 0 auto;
  object-fit: contain;
  transition: width .15s ease;
}

.viewer-unavailable {
  min-height: 400px;
  display: grid;
  place-items: center;
  padding: 30px;
  text-align: center;
  color:
    var(--ifics-muted, #68786f);
}

.decision-card {
  padding: 24px;
  display: grid;
  gap: 24px;
  border: 1px solid
    var(--ifics-green-200, #cfe2d7);
  border-radius: 14px;
  background:
    var(--ifics-green-50, #f4f8f5);
}

.decision-intro h2 {
  margin: 0 0 8px;
  font-size: 1.18rem;
}

.decision-intro > p:not(.eyebrow) {
  max-width: 780px;
  margin: 0;
  color:
    var(--ifics-muted, #68786f);
  line-height: 1.55;
}

.decision-intro .decision-notice {
  margin-top: 10px !important;
  font-size: .88rem;
}

.decision-fields {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.decision-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.decision-field-wide {
  grid-column: 1 / -1;
}

.decision-field > span {
  color:
    var(--ifics-green-950, #173428);
  font-size: .84rem;
  font-weight: 650;
}

.decision-field > span strong {
  color: #9d2d25;
}

.decision-field input,
.decision-field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid
    var(--ifics-border, #dfe8e2);
  border-radius: 9px;
  background: #fff;
  color:
    var(--ifics-green-950, #173428);
  font: inherit;
}

.decision-field textarea {
  resize: vertical;
  min-height: 118px;
  line-height: 1.45;
}

.decision-field input:focus,
.decision-field textarea:focus {
  outline: 2px solid
    var(--ifics-green-200, #cfe2d7);
  border-color:
    var(--ifics-green-700, #31704f);
}

.decision-field input:disabled,
.decision-field textarea:disabled {
  opacity: .65;
  cursor: wait;
}

.decision-field small {
  color:
    var(--ifics-muted, #68786f);
  font-size: .76rem;
}

.decision-actions {
  display: flex;
  justify-content: flex-end;
  gap: 11px;
  padding-top: 4px;
}

.decision-button {
  min-height: 44px;
  padding: 9px 18px;
  border-radius: 9px;
  font-weight: 700;
  cursor: pointer;
}

.acceptance-button {
  border: 1px solid
    var(--ifics-green-800, #24523d);
  background:
    var(--ifics-green-800, #24523d);
  color: #fff;
}

.refusal-button {
  border: 1px solid #b4473d;
  background: #fff;
  color: #96362e;
}

.decision-button:disabled {
  opacity: .6;
  cursor: wait;
}

.state-card {
  max-width: 720px;
  margin: 9vh auto 0;
  padding: 28px;
  display: flex;
  gap: 18px;
  border: 1px solid
    var(--ifics-border, #dfe8e2);
  border-radius: 16px;
  background: #fff;
}

.state-card h1 {
  margin: 0 0 8px;
  font-size: 1.35rem;
}

.state-card p {
  margin: 0;
  color:
    var(--ifics-muted, #68786f);
  line-height: 1.55;
}

.state-hint {
  margin-top: 10px !important;
  font-size: .88rem;
}

.state-icon,
.loader {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
}

.state-icon {
  background:
    var(--ifics-green-100, #e5f0e9);
  color:
    var(--ifics-green-800, #24523d);
  font-size: 1.15rem;
  font-weight: 700;
}

.loader {
  border: 3px solid #dbe5df;
  border-top-color:
    var(--ifics-green-700, #31704f);
  animation: spin .8s linear infinite;
}

.error-card .state-icon,
.refusal-card .state-icon {
  background: #fff0ee;
  color: #9d2d25;
}

.inline-error {
  padding: 12px 15px;
  border: 1px solid #efc3be;
  border-radius: 10px;
  background: #fff3f1;
  color: #8f2e27;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .document-heading {
    flex-direction: column;
  }

  .access-status {
    width: 100%;
    min-width: 0;
  }

  .metadata-card {
    grid-template-columns: 1fr;
  }

  .decision-fields {
    grid-template-columns: 1fr;
  }

  .decision-field-wide {
    grid-column: auto;
  }

  .decision-actions {
    flex-direction: column-reverse;
  }

  .decision-button {
    width: 100%;
  }

  .viewer-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .viewer-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .zoom-controls {
    justify-content: center;
  }

  .viewer-button,
  .download-button {
    width: 100%;
  }

  .viewer-surface,
  .document-frame {
    min-height: 520px;
  }

  .document-frame {
    height: 70vh;
  }
}
</style>
