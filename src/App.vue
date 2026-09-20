<script setup>
import { RouterView } from 'vue-router'
import { PhCheck, PhX } from '@phosphor-icons/vue'
import { useGastoteca } from './composables/useGastoteca.js'
import { provideGastoteca } from './composables/gastotecaContext.js'
import AppHeader from './components/layout/AppHeader.vue'
import WelcomeScreen from './components/layout/WelcomeScreen.vue'
import ExpenseDialog from './components/dialogs/ExpenseDialog.vue'
import SettlementDialog from './components/dialogs/SettlementDialog.vue'
import IconPickerDialog from './components/dialogs/IconPickerDialog.vue'
import DeleteDialogs from './components/dialogs/DeleteDialogs.vue'

const application = useGastoteca()
provideGastoteca(application)
const { loading, routeLoading, user, error, notice, dismissHeaderMenu, dismissSmartSelectOutside } = application
</script>

<template>
  <div class="app-shell" @click="dismissHeaderMenu" @pointerdown.capture="dismissSmartSelectOutside">
    <AppHeader />

    <div v-if="loading || routeLoading" class="loading-screen">
      <span class="loader"></span><p>{{ loading ? 'Preparando tus gastos…' : 'Cargando…' }}</p>
    </div>

    <WelcomeScreen v-else-if="!user" />

    <main v-else>
      <div v-if="notice" class="toast">
        <PhCheck :size="18" weight="bold" /> {{ notice }}
      </div>
      <div v-if="error" class="alert">
        <span>{{ error }}</span><button @click="error = ''">
          <PhX :size="18" />
        </button>
      </div>

      <RouterView />
    </main>

    <ExpenseDialog />

    <SettlementDialog />

    <IconPickerDialog />

    <DeleteDialogs />
  </div>
</template>
