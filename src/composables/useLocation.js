

export function useLocation({ detectedCity, draft, locationStatus, detectingCity, group }) {
  function browserPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'))
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 })
    })
  }

  async function detectCurrentCity() {
    if (detectedCity.value) {
      draft.city = detectedCity.value
      locationStatus.value = 'Ciudad detectada automáticamente.'
      return
    }
    detectingCity.value = true
    locationStatus.value = 'Detectando tu ciudad…'
    try {
      const position = await browserPosition()
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(position.coords.latitude),
        lon: String(position.coords.longitude),
        zoom: '10',
        'accept-language': 'es',
      })
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`)
      if (!response.ok) throw new Error('No se pudo consultar la ciudad')
      const result = await response.json()
      const address = result.address || {}
      const city = address.city || address.town || address.village || address.municipality || address.county || ''
      if (!city) throw new Error('No se pudo identificar la ciudad')
      detectedCity.value = city
      draft.city = city
      locationStatus.value = 'Ciudad detectada automáticamente.'
    } catch {
      draft.city = draft.city || group.value?.default_city || ''
      locationStatus.value = group.value?.default_city
        ? 'Usando la ciudad predeterminada del grupo.'
        : 'No se pudo detectar; puedes dejarla en blanco o escribirla.'
    } finally {
      detectingCity.value = false
    }
  }

  return { browserPosition, detectCurrentCity }
}
