<script setup>
import { computed } from 'vue'
import FormError from './components/forms/FormError.vue'
import { focusElement } from './utils/focus.js'
import { usePageAccessibility } from './composables/usePageAccessibility.js'
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
const { loading, routeLoading, user, error, notice, dismissHeaderMenu, dismissSmartSelectOutside, routeLoadFailed, retryRouteLoad } = application
const { pageTitle, pageBusy } = usePageAccessibility(application)
const modalVisible = computed(() => application.modalOpen.value || application.settlementTarget.value || application.iconPickerOpen.value || application.deleteTarget.value || application.tagDeleteTarget.value || application.recurringDeleteTarget.value)
</script>

<template>
  <div class="app-shell" @click="dismissHeaderMenu" @pointerdown.capture="dismissSmartSelectOutside">
    <a class="skip-link" href="#main-content" @click.prevent="focusElement('#main-content')">Saltar al contenido</a>
    <AppHeader />

    <main v-if="loading" id="main-content" class="loading-screen" tabindex="-1" aria-busy="true">
      <span class="loader" aria-hidden="true"></span><p role="status">Preparando tus gastos…</p>
    </main>
    <WelcomeScreen v-else-if="!user" />
    <main v-else id="main-content" tabindex="-1" :aria-busy="pageBusy" :aria-label="pageTitle">
      <div v-if="error && !modalVisible" class="page-error">
        <FormError :message="error" />
        <button v-if="routeLoadFailed" type="button" class="secondary" @click="retryRouteLoad">Volver a cargar</button>
        <button type="button" class="ghost" @click="error = ''">Cerrar aviso</button>
      </div>
      <div v-if="routeLoading" class="loading-screen" role="status">
        <span class="loader" aria-hidden="true"></span><p>Cargando {{ pageTitle.toLocaleLowerCase('es') }}…</p>
      </div>
      <RouterView v-else />
    </main>
    <div class="feedback-live" role="status" aria-live="polite" aria-atomic="true">
      <div v-if="notice" class="toast">
        <PhCheck :size="18" weight="bold" aria-hidden="true" /> {{ notice }}
        <button type="button" class="icon-button" aria-label="Cerrar confirmación" @click="notice = ''"><PhX :size="18" /></button>
      </div>
    </div>

    <ExpenseDialog />

    <SettlementDialog />

    <IconPickerDialog />

    <DeleteDialogs />
  </div>
</template>
