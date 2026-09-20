<script setup>
import { useGastotecaContext } from '../../composables/gastotecaContext.js'
import { PhCoins, PhGoogleLogo } from '@phosphor-icons/vue'

const {
  signingIn,
  error,
  login,
} = useGastotecaContext()
</script>

<template>
  <main id="main-content" class="welcome" tabindex="-1">
    <div class="welcome-art">
      <PhCoins aria-hidden="true" :size="64" weight="duotone" />
    </div>
    <p class="eyebrow">
      GASTOS COMPARTIDOS, SIN LÍOS
    </p>
    <h1>Todo lo que gastáis.<br /><em>Claro para todos.</em></h1>
    <p>Guarda los gastos del grupo, reparte cada compra entre quien corresponda y entiende en qué se va el dinero.</p>
    <button class="primary big" :disabled="signingIn" @click="login">
      <PhGoogleLogo aria-hidden="true" :size="20" weight="bold" /> {{ signingIn ? 'Conectando…' : 'Continuar con Google' }}
    </button>
    <p v-if="error" class="inline-error" role="alert">
      {{ error }}
    </p>
  </main>
</template>
