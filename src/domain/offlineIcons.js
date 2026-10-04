import food from '@iconify-icons/mdi/food-apple-outline'
import home from '@iconify-icons/mdi/home-outline'
import car from '@iconify-icons/mdi/car-outline'
import ticket from '@iconify-icons/mdi/ticket-outline'
import health from '@iconify-icons/mdi/medical-bag'
import shopping from '@iconify-icons/mdi/shopping-outline'
import lightning from '@iconify-icons/mdi/lightning-bolt-outline'
import airplane from '@iconify-icons/mdi/airplane'
import shape from '@iconify-icons/mdi/shape-outline'
import tag from '@iconify-icons/mdi/tag-outline'
import store from '@iconify-icons/mdi/store-outline'
import coffee from '@iconify-icons/mdi/coffee-outline'

export const offlineIcons = {
  'mdi:food-apple-outline': food,
  'mdi:home-outline': home,
  'mdi:car-outline': car,
  'mdi:ticket-outline': ticket,
  'mdi:medical-bag': health,
  'mdi:shopping-outline': shopping,
  'mdi:lightning-bolt-outline': lightning,
  'mdi:airplane': airplane,
  'mdi:shape-outline': shape,
  'mdi:tag-outline': tag,
  'mdi:store-outline': store,
  'mdi:coffee-outline': coffee,
}

export function offlineIconResponse(path) {
  const url = new URL(path, 'https://api.iconify.design/')
  const names = Object.keys(offlineIcons)
  if (url.pathname === '/collections') return { mdi: { name: 'Material Design Icons', total: names.length, category: 'Sin conexión' } }
  if (url.pathname === '/collection' && url.searchParams.get('prefix') === 'mdi') return { prefix: 'mdi', title: 'Disponibles sin conexión', total: names.length, uncategorized: names.map(name => name.split(':')[1]) }
  if (url.pathname === '/search') {
    const query = (url.searchParams.get('query') || '').toLowerCase()
    return { icons: names.filter(name => name.includes(query)), limit: 128 }
  }
  throw new Error('Esta colección no está disponible sin conexión. Selecciona Material Design Icons.')
}
