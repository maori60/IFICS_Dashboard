<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Contact' })

const form = reactive({ reason: 'PROJECT', name: '', email: '', organization: '', phone: '', message: '' })
const pending = ref(false)
const sent = ref(false)
const errorMessage = ref('')

async function submit() {
  pending.value = true
  sent.value = false
  errorMessage.value = ''
  try {
    await $fetch('/api/public/contact', { method: 'POST', body: form })
    sent.value = true
    Object.assign(form, { reason: 'PROJECT', name: '', email: '', organization: '', phone: '', message: '' })
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Impossible d’envoyer le message.')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <section class="section contact-hero">
      <div class="container split-section">
        <div class="split-copy">
          <p class="eyebrow">Contact</p>
          <h1 class="display-title">Parlons de votre besoin.</h1>
          <p class="lead">Projet, partenariat, mécénat, candidature, R&D, demande institutionnelle ou support : choisissez le motif le plus proche et donnez-nous suffisamment de contexte pour vous orienter correctement.</p>
          <div class="contact-points"><div><strong>Un besoin précis ?</strong><span>Décrivez le public, le territoire et l’objectif.</span></div><div><strong>Une idée encore ouverte ?</strong><span>Nous pouvons commencer par qualifier le besoin avant de parler solution.</span></div></div>
        </div>
        <div class="split-media"><img :src="publicVisuals.insertion" alt="Échange professionnel autour d'un projet et d'un parcours"></div>
      </div>
    </section>

    <section class="section form-section">
      <div class="container form-shell">
        <div class="form-intro"><p class="eyebrow">Votre message</p><h2 class="section-title">Donnez-nous le contexte utile.</h2><p class="lead">Les informations transmises sont utilisées uniquement pour traiter votre demande et vous recontacter.</p></div>
        <form class="card card-pad" @submit.prevent="submit">
          <div v-if="sent" class="alert alert-success" role="status">Votre message a été transmis. L’équipe IFICS pourra vous recontacter si nécessaire.</div>
          <div v-if="errorMessage" class="alert alert-error" role="alert">{{ errorMessage }}</div>
          <div class="field"><label for="reason">Objet *</label><select id="reason" v-model="form.reason" class="select"><option value="PROJECT">Projet</option><option value="PARTNERSHIP">Partenariat</option><option value="SPONSORSHIP">Mécénat</option><option value="APPLICATION">Candidature</option><option value="RND">Innovation / R&D</option><option value="INSTITUTIONAL">Demande institutionnelle</option><option value="SUPPORT">Support</option><option value="OTHER">Autre</option></select></div>
          <div class="form-grid"><div class="field"><label for="contact-name-public">Nom *</label><input id="contact-name-public" v-model="form.name" class="input" autocomplete="name" required></div><div class="field"><label for="contact-email">E-mail *</label><input id="contact-email" v-model="form.email" class="input" type="email" autocomplete="email" required></div><div class="field"><label for="contact-org">Organisation</label><input id="contact-org" v-model="form.organization" class="input" autocomplete="organization"></div><div class="field"><label for="contact-phone">Téléphone</label><input id="contact-phone" v-model="form.phone" class="input" type="tel" autocomplete="tel"></div><div class="field field-full"><label for="contact-message">Message *</label><textarea id="contact-message" v-model="form.message" class="textarea" minlength="10" required></textarea></div></div>
          <button class="btn btn-primary" type="submit" :disabled="pending">{{ pending ? 'Envoi…' : 'Envoyer le message' }}</button>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.contact-hero { background: #fff; }
.contact-points { display: grid; gap: 16px; margin-top: 28px; }
.contact-points div { display: flex; flex-direction: column; gap: 2px; padding-left: 14px; border-left: 3px solid var(--ifics-green-100); }
.contact-points span { color: var(--ifics-muted); font-size: .9rem; }
.form-section { background: #f1f5f2; border-block: 1px solid #e5ece7; }
.form-shell { display: grid; grid-template-columns: .72fr 1.28fr; gap: 48px; align-items: start; }
.form-intro { position: sticky; top: 110px; }
form { display: flex; flex-direction: column; gap: 18px; }
@media (max-width: 850px) { .form-shell { grid-template-columns: 1fr; } .form-intro { position: static; } }
</style>
