const madridClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

export function madridDateTime(now = new Date()) {
  const parts = Object.fromEntries(madridClock.formatToParts(now).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export function recentMonthRange(now = new Date()) {
  const through = madridDateTime(now)
  const wallTime = new Date(through.replace(' ', 'T') + 'Z')
  const day = wallTime.getUTCDate()
  wallTime.setUTCDate(1)
  wallTime.setUTCMonth(wallTime.getUTCMonth() - 1)
  wallTime.setUTCDate(Math.min(day, new Date(Date.UTC(wallTime.getUTCFullYear(), wallTime.getUTCMonth() + 1, 0)).getUTCDate()))
  return { from: wallTime.toISOString().slice(0, 19).replace('T', ' '), to: through }
}
