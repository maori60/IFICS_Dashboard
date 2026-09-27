// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      titleTemplate: '%s · IFICS',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#073f35' },
        { name: 'description', content: 'IFICS — projets de terrain, éducation, inclusion, culture et sport. KREATORTECH porte les prestations IT, le numérique et l’ingénierie.' },
      ],
    },
  },
  devtools: {
    enabled: process.env.NODE_ENV !== 'production',
  },
})
