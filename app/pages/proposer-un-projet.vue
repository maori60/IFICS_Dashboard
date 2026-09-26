<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

useHead({ title: 'Proposer un projet' })

const form = reactive({
  organizationName: '',
  contactName: '',
  email: '',
  phone: '',
  territory: '',
  audience: '',
  issue: '',
  proposalType: '',
  timeframe: '',
  budget: '',
  participantCount: '',
  comment: '',
})

const pending = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

async function submit() {
  pending.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    await $fetch('/api/public/proposals', {
      method: 'POST',
      body: {
        ...form,
        budget: form.budget || null,
        participantCount: form.participantCount || null,
      },
    })

    successMessage.value
      = 'Votre proposition a été transmise à IFICS. Elle sera qualifiée avant toute création de projet interne.'

    Object.assign(form, {
      organizationName: '',
      contactName: '',
      email: '',
      phone: '',
      territory: '',
      audience: '',
      issue: '',
      proposalType: '',
      timeframe: '',
      budget: '',
      participantCount: '',
      comment: '',
    })
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(
      error,
      'Impossible d’envoyer la proposition.',
    )
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="proposal-v8">

    <section class="proposal-v8-hero">
      <div class="proposal-v8-shell proposal-v8-hero-grid">

        <div>
          <p class="proposal-v8-kicker">
            PROPOSER UN PROJET
          </p>

          <h1>
            Commencez par<br>
            <span>le contexte.</span>
          </h1>

          <p class="proposal-v8-intro">
            Une problématique, un public et un objectif suffisent
            pour engager la réflexion. Le format vient ensuite.
          </p>
        </div>

        <div class="proposal-v8-process">

          <div>
            <span>01</span>
            <strong>Besoin</strong>
          </div>

          <i />

          <div>
            <span>02</span>
            <strong>Contexte</strong>
          </div>

          <i />

          <div>
            <span>03</span>
            <strong>Objectif</strong>
          </div>

          <i />

          <div>
            <span>04</span>
            <strong>Format</strong>
          </div>

        </div>

      </div>
    </section>

    <section class="proposal-v8-form-section">
      <div class="proposal-v8-shell proposal-v8-form-grid">

        <aside>
          <p class="proposal-v8-kicker">
            VOTRE PROPOSITION
          </p>

          <h2>
            Les informations<br>
            essentielles.
          </h2>

          <p>
            Les champs obligatoires restent volontairement limités.
            Les détails pourront être précisés ensuite avec l'équipe.
          </p>

          <div class="proposal-v8-mini-process">
            <span><i>01</i> Comprendre</span>
            <span><i>02</i> Qualifier</span>
            <span><i>03</i> Construire</span>
          </div>
        </aside>

        <form
          class="proposal-v8-form"
          @submit.prevent="submit"
        >
          <div
            v-if="successMessage"
            class="proposal-v8-alert proposal-v8-alert-success"
            role="status"
          >
            {{ successMessage }}
          </div>

          <div
            v-if="errorMessage"
            class="proposal-v8-alert proposal-v8-alert-error"
            role="alert"
          >
            {{ errorMessage }}
          </div>

          <div class="proposal-v8-fields">

            <div class="proposal-v8-field">
              <label for="organization">Organisation *</label>
              <input
                id="organization"
                v-model="form.organizationName"
                autocomplete="organization"
                required
              >
            </div>

            <div class="proposal-v8-field">
              <label for="contact-name">Contact *</label>
              <input
                id="contact-name"
                v-model="form.contactName"
                autocomplete="name"
                required
              >
            </div>

            <div class="proposal-v8-field">
              <label for="proposal-email">E-mail *</label>
              <input
                id="proposal-email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                required
              >
            </div>

            <div class="proposal-v8-field">
              <label for="proposal-phone">Téléphone</label>
              <input
                id="proposal-phone"
                v-model="form.phone"
                type="tel"
                autocomplete="tel"
              >
            </div>

            <div class="proposal-v8-field">
              <label for="territory">Territoire</label>
              <input
                id="territory"
                v-model="form.territory"
                placeholder="Ville, département…"
              >
            </div>

            <div class="proposal-v8-field">
              <label for="audience">Public concerné</label>
              <input
                id="audience"
                v-model="form.audience"
                placeholder="Âge, situation, effectif…"
              >
            </div>

            <div class="proposal-v8-field proposal-v8-field-full">
              <label for="issue">Besoin / problématique *</label>
              <textarea
                id="issue"
                v-model="form.issue"
                minlength="20"
                required
              />
              <small>
                Expliquez ce que vous souhaitez améliorer,
                résoudre ou rendre possible.
              </small>
            </div>

            <div class="proposal-v8-field">
              <label for="proposal-type">Type d'action envisagé</label>
              <input
                id="proposal-type"
                v-model="form.proposalType"
                placeholder="Atelier, prestation IT…"
              >
            </div>

            <div class="proposal-v8-field">
              <label for="timeframe">Période / calendrier</label>
              <input
                id="timeframe"
                v-model="form.timeframe"
                placeholder="Dates ou période souhaitée"
              >
            </div>

            <div class="proposal-v8-field">
              <label for="budget">Budget indicatif (€)</label>
              <input
                id="budget"
                v-model="form.budget"
                inputmode="decimal"
              >
            </div>

            <div class="proposal-v8-field">
              <label for="participants">Nombre de participants</label>
              <input
                id="participants"
                v-model="form.participantCount"
                type="number"
                min="0"
              >
            </div>

            <div class="proposal-v8-field proposal-v8-field-full">
              <label for="proposal-comment">
                Informations complémentaires
              </label>
              <textarea
                id="proposal-comment"
                v-model="form.comment"
                class="proposal-v8-comment"
              />
            </div>

          </div>

          <button
            class="proposal-v8-submit"
            type="submit"
            :disabled="pending"
          >
            <span>
              {{ pending ? 'Envoi…' : 'Transmettre la proposition' }}
            </span>
            <span aria-hidden="true">→</span>
          </button>

        </form>

      </div>
    </section>

  </main>
</template>
