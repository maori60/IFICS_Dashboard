<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Proposer un projet' })

const form = reactive({ organizationName: '', contactName: '', email: '', phone: '', territory: '', audience: '', issue: '', proposalType: '', timeframe: '', budget: '', participantCount: '', comment: '' })
const pending = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

async function submit() {
  pending.value = true
  successMessage.value = ''
  errorMessage.value = ''
  try {
    await $fetch('/api/public/proposals', { method: 'POST', body: { ...form, budget: form.budget || null, participantCount: form.participantCount || null } })
    successMessage.value = 'Votre proposition a été transmise à IFICS. Elle sera qualifiée avant toute création de projet interne.'
    Object.assign(form, { organizationName: '', contactName: '', email: '', phone: '', territory: '', audience: '', issue: '', proposalType: '', timeframe: '', budget: '', participantCount: '', comment: '' })
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Impossible d’envoyer la proposition.')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <section class="section proposal-hero">
      <div class="container split-section reverse">
        <div class="split-copy">
          <p class="eyebrow">Proposer un projet</p>
          <h1 class="display-title">Présentez le besoin, le public et le contexte.</h1>
          <p class="lead">Un projet pertinent commence par une compréhension claire du terrain. IFICS peut ensuite qualifier la demande et construire une réponse adaptée avec vous.</p>
          <ul class="feature-list"><li><span><strong>Une demande structurée</strong><br>Les informations utiles sont centralisées dès le départ.</span></li><li><span><strong>Une réponse construite après analyse</strong><br>Le format n’est pas imposé avant d’avoir compris le besoin.</span></li><li><span><strong>Un interlocuteur identifié</strong><br>L’équipe peut vous recontacter pour approfondir certains points.</span></li></ul>
        </div>
        <div class="split-media"><img :src="publicVisuals.proposal" alt="Préparation structurée d’une proposition de projet"></div>
      </div>
    </section>

    <section class="section proposal-form-section">
      <div class="container proposal">
        <div class="proposal-intro"><p class="eyebrow">Votre proposition</p><h2 class="section-title">Les informations essentielles pour comprendre la demande.</h2><p class="lead">Les champs obligatoires restent volontairement limités. Ajoutez les détails dont vous disposez déjà ; le reste pourra être précisé avec l’équipe.</p></div>
        <form class="card card-pad" @submit.prevent="submit">
          <div v-if="successMessage" class="alert alert-success" role="status">{{ successMessage }}</div>
          <div v-if="errorMessage" class="alert alert-error" role="alert">{{ errorMessage }}</div>
          <div class="form-grid"><div class="field"><label for="organization">Organisation *</label><input id="organization" v-model="form.organizationName" class="input" autocomplete="organization" required></div><div class="field"><label for="contact-name">Contact *</label><input id="contact-name" v-model="form.contactName" class="input" autocomplete="name" required></div><div class="field"><label for="proposal-email">E-mail *</label><input id="proposal-email" v-model="form.email" class="input" type="email" autocomplete="email" required></div><div class="field"><label for="proposal-phone">Téléphone</label><input id="proposal-phone" v-model="form.phone" class="input" type="tel" autocomplete="tel"></div><div class="field"><label for="territory">Territoire</label><input id="territory" v-model="form.territory" class="input" placeholder="Ville, intercommunalité, département…"></div><div class="field"><label for="audience">Public concerné</label><input id="audience" v-model="form.audience" class="input" placeholder="Âge, situation, effectif…"></div><div class="field field-full"><label for="issue">Besoin / problématique *</label><textarea id="issue" v-model="form.issue" class="textarea" minlength="20" required /><span class="help">Expliquez ce que vous souhaitez améliorer, résoudre ou rendre possible.</span></div><div class="field"><label for="proposal-type">Type d’action envisagé</label><input id="proposal-type" v-model="form.proposalType" class="input" placeholder="Atelier, stage, accompagnement…"></div><div class="field"><label for="timeframe">Période / calendrier</label><input id="timeframe" v-model="form.timeframe" class="input" placeholder="Dates ou période souhaitée"></div><div class="field"><label for="budget">Budget indicatif (€)</label><input id="budget" v-model="form.budget" class="input" inputmode="decimal"></div><div class="field"><label for="participants">Nombre de participants</label><input id="participants" v-model="form.participantCount" class="input" type="number" min="0"></div><div class="field field-full"><label for="proposal-comment">Informations complémentaires</label><textarea id="proposal-comment" v-model="form.comment" class="textarea" /></div></div>
          <button class="btn btn-primary" type="submit" :disabled="pending">{{ pending ? 'Envoi…' : 'Transmettre la proposition' }}</button>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.proposal-hero { background: #fff; }
.proposal-form-section { background: #f3f6f4; border-block: 1px solid #e5ece7; }
.proposal { display: grid; grid-template-columns: .72fr 1.28fr; gap: 48px; align-items: start; }
.proposal-intro { position: sticky; top: 110px; }
form { display: flex; flex-direction: column; gap: 20px; }
@media (max-width: 850px) { .proposal { grid-template-columns: 1fr; } .proposal-intro { position: static; } }
</style>