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

    <section class="contact-v9-hero">
      <div class="contact-v8-shell contact-v9-hero-grid">

        <div class="contact-v9-copy">
          <p class="contact-v8-kicker">
            CONTACT
          </p>

          <h1>
            Transmettons<br>
            <span>vos idées en actions.</span>
          </h1>

          <p class="contact-v9-intro">
            Une question, un projet, un partenariat ?
            Notre équipe vous répond et vous accompagne à chaque étape.
          </p>

          <div class="contact-v9-promises">
            <div>
              <span class="contact-v9-promise-icon">✓</span>
              <p>
                <strong>Comprendre</strong>
                votre besoin
              </p>
            </div>

            <div>
              <span class="contact-v9-promise-icon">↗</span>
              <p>
                <strong>Vous orienter</strong>
                vers la bonne équipe
              </p>
            </div>

            <div>
              <span class="contact-v9-promise-icon">◎</span>
              <p>
                <strong>Construire</strong>
                des solutions concrètes
              </p>
            </div>
          </div>
        </div>

        <ContactTransmissionField />

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

<style scoped>
.contact-v9-hero {
  position: relative;
  overflow: hidden;
  min-height: 570px;
  padding: 62px 0 30px;
  border-bottom: 1px solid rgba(71, 143, 121, .22);
  background:
    radial-gradient(circle at 67% 45%, rgba(0, 190, 153, .075), transparent 31%),
    radial-gradient(circle at 28% 26%, rgba(0, 116, 92, .07), transparent 26%);
}

.contact-v9-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(rgba(34, 230, 168, .018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 230, 168, .018) 1px, transparent 1px);
  background-size: 58px 58px;
  mask-image: linear-gradient(to bottom, transparent, #000 22%, #000 72%, transparent);
}

.contact-v9-hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: .82fr 1.18fr;
  align-items: center;
  gap: 32px;
}

.contact-v9-copy {
  position: relative;
  z-index: 3;
  padding-left: 2px;
}

.contact-v9-copy h1 {
  margin: 17px 0 20px;
  color: #f6f9f7;
  font-family: Montserrat, sans-serif;
  font-size: clamp(46px, 4.7vw, 72px);
  font-weight: 700;
  line-height: .98;
  letter-spacing: -.048em;
}

.contact-v9-copy h1 span {
  color: #9ebeb3;
}

.contact-v9-intro {
  max-width: 510px;
  margin: 0;
  color: rgba(220, 235, 230, .72);
  font-size: 15px;
  line-height: 1.72;
}

.contact-v9-promises {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  max-width: 535px;
  margin-top: 34px;
}

.contact-v9-promises > div {
  display: grid;
  grid-template-columns: 38px 1fr;
  align-items: center;
  gap: 9px;
}

.contact-v9-promise-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(40, 240, 193, .54);
  border-radius: 50%;
  color: #35e8bd;
  background: rgba(9, 64, 52, .28);
  box-shadow: 0 0 20px rgba(38, 226, 182, .08);
  font-size: 14px;
}

.contact-v9-promises p {
  margin: 0;
  color: rgba(205, 225, 218, .62);
  font-size: 10px;
  line-height: 1.35;
}

.contact-v9-promises strong {
  display: block;
  color: #e9f5f1;
  font-size: 10px;
  font-weight: 650;
}

.contact-v8-form-section {
  padding-top: 48px;
  background:
    radial-gradient(circle at 61% 15%, rgba(14, 136, 108, .055), transparent 30%);
}

.contact-v8-form {
  position: relative;
  overflow: hidden;
  border-color: rgba(43, 217, 171, .34);
  background:
    linear-gradient(145deg, rgba(5, 43, 35, .74), rgba(2, 27, 23, .92));
  box-shadow:
    0 18px 60px rgba(0, 0, 0, .18),
    inset 0 1px rgba(255, 255, 255, .025);
}

.contact-v8-form::before {
  content: "";
  position: absolute;
  top: 0;
  left: 8%;
  width: 44%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(55, 239, 194, .82),
    transparent
  );
  box-shadow: 0 0 15px rgba(55, 239, 194, .32);
}

.contact-v8-field input,
.contact-v8-field select,
.contact-v8-field textarea {
  transition:
    border-color .2s ease,
    box-shadow .2s ease,
    background .2s ease;
}

.contact-v8-field input:focus,
.contact-v8-field select:focus,
.contact-v8-field textarea:focus {
  outline: none;
  border-color: rgba(50, 232, 187, .68);
  background: rgba(2, 32, 27, .92);
  box-shadow:
    0 0 0 3px rgba(35, 221, 174, .07),
    0 0 20px rgba(35, 221, 174, .04);
}

.contact-v8-submit {
  box-shadow: 0 0 25px rgba(31, 213, 166, .11);
}

@media (max-width: 1050px) {
  .contact-v9-hero-grid {
    grid-template-columns: 1fr;
  }

  .contact-v9-copy {
    max-width: 680px;
  }

  .contact-v9-hero {
    padding-bottom: 20px;
  }

  .contact-transmission {
    margin-inline: auto;
  }
}

@media (max-width: 620px) {
  .contact-v9-hero {
    padding-top: 48px;
  }

  .contact-v9-copy h1 {
    font-size: clamp(42px, 13vw, 58px);
  }

  .contact-v9-promises {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
