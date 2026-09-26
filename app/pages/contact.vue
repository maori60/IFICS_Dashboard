<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

usePublicSeo({
  title: 'Contact',
  description: 'Contactez IFICS pour proposer un partenariat, présenter un besoin, échanger sur une mission KREATORTECH ou obtenir des informations sur nos actions.',
  path: '/contact',
})

const form = reactive({
  reason: 'PROJECT',
  name: '',
  email: '',
  organization: '',
  phone: '',
  message: '',
})

const pending = ref(false)
const sent = ref(false)
const errorMessage = ref('')

async function submit() {
  pending.value = true
  sent.value = false
  errorMessage.value = ''

  try {
    await $fetch('/api/public/contact', {
      method: 'POST',
      body: form,
    })

    sent.value = true

    Object.assign(form, {
      reason: 'PROJECT',
      name: '',
      email: '',
      organization: '',
      phone: '',
      message: '',
    })
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(
      error,
      'Impossible d’envoyer le message.',
    )
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="contact-v8">

    <section class="contact-v8-hero">
      <div class="contact-v8-shell contact-v8-hero-grid">

        <div>
          <p class="contact-v8-kicker">
            CONTACT
          </p>

          <h1>
            Parlons de<br>
            <span>votre besoin.</span>
          </h1>

          <p class="contact-v8-intro">
            Projet, prestation IT, partenariat ou demande institutionnelle :
            quelques informations suffisent pour commencer.
          </p>
        </div>

        <div class="contact-v8-paths">

          <div>
            <span>01</span>
            <div>
              <strong>Projet IFICS</strong>
              <p>Public, territoire, objectif ou action à construire.</p>
            </div>
          </div>

          <div>
            <span>02</span>
            <div>
              <strong>KREATORTECH</strong>
              <p>Développement, support, infrastructure ou expertise IT.</p>
            </div>
          </div>

          <div>
            <span>03</span>
            <div>
              <strong>Partenariat</strong>
              <p>Coopération, financement, compétence ou ressource.</p>
            </div>
          </div>

        </div>

      </div>
    </section>

    <section class="contact-v8-form-section">
      <div class="contact-v8-shell contact-v8-form-grid">

        <aside>
          <p class="contact-v8-kicker">
            VOTRE MESSAGE
          </p>

          <h2>
            Donnez-nous<br>
            le contexte utile.
          </h2>

          <p>
            Nous utilisons ces informations uniquement
            pour comprendre votre demande et vous recontacter.
          </p>

          <div class="contact-v8-aside-line" />

          <small>
            Les champs marqués d'un * sont obligatoires.
          </small>
        </aside>

        <form
          class="contact-v8-form"
          @submit.prevent="submit"
        >
          <div
            v-if="sent"
            class="contact-v8-alert contact-v8-alert-success"
            role="status"
          >
            Votre message a été transmis. L'équipe IFICS pourra vous
            recontacter si nécessaire.
          </div>

          <div
            v-if="errorMessage"
            class="contact-v8-alert contact-v8-alert-error"
            role="alert"
          >
            {{ errorMessage }}
          </div>

          <div class="contact-v8-field contact-v8-field-full">
            <label for="reason">Objet *</label>

            <select
              id="reason"
              v-model="form.reason"
            >
              <option value="PROJECT">Projet IFICS</option>
              <option value="PARTNERSHIP">Partenariat</option>
              <option value="SPONSORSHIP">Mécénat</option>
              <option value="APPLICATION">Candidature</option>
              <option value="RND">KREATORTECH / Innovation & R&D</option>
              <option value="INSTITUTIONAL">Demande institutionnelle</option>
              <option value="SUPPORT">Support</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>

          <div class="contact-v8-fields">
            <div class="contact-v8-field">
              <label for="contact-name-public">Nom *</label>
              <input
                id="contact-name-public"
                v-model="form.name"
                autocomplete="name"
                required
              >
            </div>

            <div class="contact-v8-field">
              <label for="contact-email">E-mail *</label>
              <input
                id="contact-email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                required
              >
            </div>

            <div class="contact-v8-field">
              <label for="contact-org">Organisation</label>
              <input
                id="contact-org"
                v-model="form.organization"
                autocomplete="organization"
              >
            </div>

            <div class="contact-v8-field">
              <label for="contact-phone">Téléphone</label>
              <input
                id="contact-phone"
                v-model="form.phone"
                type="tel"
                autocomplete="tel"
              >
            </div>

            <div class="contact-v8-field contact-v8-field-full">
              <label for="contact-message">Message *</label>
              <textarea
                id="contact-message"
                v-model="form.message"
                minlength="10"
                required
              />
            </div>
          </div>

          <button
            class="contact-v8-submit"
            type="submit"
            :disabled="pending"
          >
            <span>{{ pending ? 'Envoi…' : 'Envoyer le message' }}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

      </div>
    </section>

  </main>
</template>
