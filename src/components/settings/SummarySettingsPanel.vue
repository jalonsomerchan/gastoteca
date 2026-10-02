<script setup>
import { PhCheck, PhChartBar, PhPaperPlaneTilt } from '@phosphor-icons/vue'

defineProps({
  schedules: { type: Object, required: true }, status: { type: Object, required: true },
  options: { type: Array, required: true }, period: { type: String, required: true },
  connected: Boolean, configured: Boolean, saving: Boolean, sending: String,
})
const emit = defineEmits(['update-schedule', 'update:period', 'save', 'send'])
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const dateLabel = value => new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
}).format(new Date(value))
const change = (period, field, value) => emit('update-schedule', { period, field, value })
</script>

<template>
  <form class="feature-panel feature-form settings-backup-panel" aria-label="Resúmenes de gastos por Telegram" :aria-busy="saving || Boolean(sending)" @submit.prevent="emit('save')">
    <div class="feature-panel-heading">
      <div><p class="eyebrow">TUS GASTOS, DE UN VISTAZO</p><h2>Resúmenes de gastos</h2></div>
      <PhChartBar aria-hidden="true" :size="26" />
    </div>
    <p class="feature-hint settings-intro">
      Recibe un mensaje en Telegram con los gastos del grupo, las principales categorías, tu parte del reparto, los ingresos y la comparación con el periodo anterior. Puedes activar varios resúmenes a la vez.
    </p>
    <p v-if="!connected" class="feature-hint">
      {{ configured ? 'Conecta tu cuenta en la sección Telegram para recibir resúmenes.' : 'Telegram debe estar configurado en el servidor para enviar resúmenes.' }}
    </p>
    <fieldset class="summary-manual settings-backup-fields" :disabled="saving || Boolean(sending) || !connected">
      <legend class="sr-only">Envío manual de un resumen</legend>
      <label for="summary-period">
        <span>Resumen que quieres enviar</span>
        <select id="summary-period" :value="period" @change="emit('update:period', $event.target.value)">
          <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }} · {{ option.description }}</option>
        </select>
      </label>
      <button type="button" class="secondary" @click="emit('send')">
        <PhPaperPlaneTilt aria-hidden="true" :size="17" /> {{ sending ? 'Enviando resumen…' : 'Enviar resumen ahora' }}
      </button>
    </fieldset>
    <div class="summary-schedules">
      <fieldset v-for="option in options" :key="option.value" class="summary-schedule" :disabled="saving || Boolean(sending)">
        <legend class="sr-only">Resumen {{ option.label.toLowerCase() }}</legend>
        <label class="summary-toggle" :for="`summary-${option.value}-enabled`">
          <input :id="`summary-${option.value}-enabled`" type="checkbox" :aria-labelledby="`summary-${option.value}-label`" :aria-describedby="`summary-${option.value}-description`" :checked="schedules[option.value].enabled" :disabled="!connected && !schedules[option.value].enabled" @change="change(option.value, 'enabled', $event.target.checked)" />
          <span><strong :id="`summary-${option.value}-label`">Resumen {{ option.label.toLowerCase() }}</strong><small :id="`summary-${option.value}-description`">{{ option.description }}</small></span>
        </label>
        <div v-if="schedules[option.value].enabled" class="settings-backup-fields">
          <label :for="`summary-${option.value}-time`">
            <span>Hora de envío · Madrid</span>
            <input :id="`summary-${option.value}-time`" type="time" required :value="schedules[option.value].time" @input="change(option.value, 'time', $event.target.value)" />
          </label>
          <label v-if="option.value === 'weekly'" for="summary-weekly-weekday">
            <span>Día de la semana</span>
            <select id="summary-weekly-weekday" :value="schedules.weekly.weekday" @change="change('weekly', 'weekday', Number($event.target.value))">
              <option v-for="(day, index) in weekdays" :key="day" :value="index + 1">{{ day }}</option>
            </select>
          </label>
          <label v-if="option.value === 'monthly'" for="summary-monthly-monthday">
            <span>Día del mes</span>
            <select id="summary-monthly-monthday" :value="schedules.monthly.monthday" aria-describedby="summary-monthday-hint" @change="change('monthly', 'monthday', Number($event.target.value))">
              <option v-for="day in 31" :key="day" :value="day">{{ day }}</option>
            </select>
          </label>
        </div>
        <p v-if="option.value === 'monthly' && schedules.monthly.enabled" id="summary-monthday-hint" class="feature-hint">Si el mes no tiene ese día, se enviará el último día del mes.</p>
        <p v-if="status[option.value].next_run_at" class="feature-hint">Próximo envío guardado: <time :datetime="status[option.value].next_run_at">{{ dateLabel(status[option.value].next_run_at) }}</time></p>
        <p v-if="status[option.value].last_sent_at" class="feature-hint">Último resumen enviado: <time :datetime="status[option.value].last_sent_at">{{ dateLabel(status[option.value].last_sent_at) }}</time></p>
      </fieldset>
    </div>
    <p class="feature-hint">Se resumen periodos completos con movimientos confirmados. Las liquidaciones entre miembros no se cuentan como gastos. Los envíos funcionan con la app cerrada y usan el mismo cron que las copias.</p>
    <div class="feature-form-actions">
      <span></span><button class="primary" :disabled="saving || Boolean(sending) || (!connected && options.some(option => schedules[option.value].enabled))">
        <PhCheck aria-hidden="true" :size="17" /> {{ saving ? 'Guardando…' : 'Guardar resúmenes' }}
      </button>
    </div>
  </form>
</template>
