import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'vue/multi-word-component-names': 'off',
    // M1.4 records the existing explicit-any debt as warnings so CI can prevent
    // new lint debt before the business-model typing cleanup in later steps.
    '@typescript-eslint/no-explicit-any': 'warn',
  },
})
