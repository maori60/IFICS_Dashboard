<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary'
}>()
</script>

<template>
  <button
    :class="[
      'btn',
      variant === 'primary' ? 'btn-primary' : 'btn-secondary'
    ]"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.25);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(99, 102, 241, 0.35);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}
</style>