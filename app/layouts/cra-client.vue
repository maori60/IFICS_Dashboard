<script setup lang="ts">
</script>

<template>
  <div class="client-shell">
    <header class="client-header">
      <div class="client-header-inner">
        <div
          class="client-brand"
          aria-label="IFICS"
        >
          <span class="brand-symbol">
            <span
              class="brand-fallback"
              aria-hidden="true"
            >
              I
            </span>
          </span>

          <span class="brand-copy">
            <strong>IFICS</strong>
            <small>
              Espace sécurisé de consultation
            </small>
          </span>
        </div>

        <span class="secure-label">
          Document sécurisé
        </span>
      </div>
    </header>

    <main class="client-main">
      <slot />
    </main>

    <footer class="client-footer">
      <span>
        © {{ new Date().getFullYear() }} IFICS
      </span>

      <span>
        Accès confidentiel au document
      </span>
    </footer>
  </div>
</template>

<style scoped>
.client-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    var(--ifics-green-50, #f4f8f5);
  color:
    var(--ifics-green-950, #173428);
}

.client-header {
  background: #fff;
  border-bottom: 1px solid
    var(--ifics-border, #dfe8e2);
}

.client-header-inner {
  width: min(1180px, calc(100% - 40px));
  min-height: 72px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.client-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}

.brand-symbol {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.brand-fallback {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background:
    var(--ifics-green-900, #173f2f);
  color: #fff;
  font-weight: 700;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.brand-copy strong {
  font-size: 1.05rem;
  letter-spacing: .03em;
}

.brand-copy small {
  margin-top: 3px;
  color:
    var(--ifics-muted, #68786f);
  font-size: .76rem;
}

.secure-label {
  padding: 7px 11px;
  border: 1px solid
    var(--ifics-border, #dfe8e2);
  border-radius: 999px;
  background:
    var(--ifics-green-50, #f4f8f5);
  color:
    var(--ifics-green-800, #24523d);
  font-size: .78rem;
  font-weight: 600;
}

.client-main {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 42px 0 54px;
  flex: 1;
}

.client-footer {
  min-height: 58px;
  padding: 14px max(20px, calc((100% - 1180px) / 2));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid
    var(--ifics-border, #dfe8e2);
  background: #fff;
  color:
    var(--ifics-muted, #68786f);
  font-size: .78rem;
}

@media (max-width: 640px) {
  .client-header-inner,
  .client-main {
    width: min(100% - 24px, 1180px);
  }

  .brand-copy small {
    display: none;
  }

  .secure-label {
    font-size: .7rem;
  }

  .client-main {
    padding-top: 24px;
  }

  .client-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
