# La Gastoteca

Aplicación Vue 3 para registrar y analizar gastos compartidos por grupos, disponible en `https://gastoteca.alon.one`. Reutiliza el acceso con Google/Firebase y el contrato de autenticación de Menu Diario.

## Desarrollo

```sh
npm install
npm run dev
```

La configuración local ya contiene las mismas claves públicas de Firebase que Menu Diario y usa `http://localhost/OV2/api`. La build de producción usa `https://alon.one/api` mediante `.env.production`.

## API

El controlador principal está en `/Applications/MAMP/htdocs/OV2/api/mistergastos.php`. La ruta pública de producción es `/gastoteca/*`; `/mistergastos/*` se mantiene como alias compatible. Todas las rutas requieren `Authorization: Bearer FIREBASE_ID_TOKEN`.

- `GET /gastoteca/bootstrap`: grupo, gastos y estadísticas.
- `GET /gastoteca/expenses`: listado de gastos.
- `GET /gastoteca/group`: datos del grupo y sus catálogos.
- `GET /gastoteca/statistics`: agregados por categoría, pagador y mes.
- `POST /gastoteca/save_expense`: crea o edita un gasto.
- `POST /gastoteca/delete_expense`: elimina un gasto.
- `POST /gastoteca/save_settlement`: registra un pago entre dos miembros y reduce la deuda pendiente.
- `POST /gastoteca/save_budget` y `POST /gastoteca/delete_budget`: guardan o eliminan límites mensuales por categoría.
- `POST /gastoteca/save_recurring`, `POST /gastoteca/toggle_recurring` y `POST /gastoteca/delete_recurring`: crean, editan, pausan, reactivan o eliminan reglas recurrentes.
- `POST /gastoteca/save_tag` y `POST /gastoteca/delete_tag`: crean, renombran o eliminan etiquetas del grupo.
- `GET /gastoteca/telegram_settings` y `POST /gastoteca/save_telegram_settings`: consultan y guardan los tipos de aviso por Telegram.
- `POST /gastoteca/save_catalog_icons`: guarda los iconos Iconify del grupo para establecimientos y categorías.
- `POST /gastoteca/invite_email`: envía una invitación por email.
- `POST /gastoteca/join_group`: une mediante código.
- `POST /gastoteca/leave_group`: abandona el grupo y crea uno personal.

La API crea automáticamente la base `mistergastos` y sus tablas `mg_*`. Establecimientos, categorías y ciudades viven en `mg_places`, `mg_categories` y `mg_cities`; `mg_expenses` guarda sus claves foráneas (`place_id`, `category_id`, `city_id`). Etiquetas, liquidaciones, presupuestos, reglas recurrentes y preferencias de Telegram usan tablas propias del grupo. Los movimientos y las liquidaciones registran su método de pago; el propietario puede configurar el predeterminado del grupo. Los movimientos recurrentes vencidos se materializan al consultar Gastoteca; Telegram reutiliza la conexión y el bot configurados para Menu Diario. Al iniciar, la API migra el esquema conservando los movimientos. El esquema reproducible está en `database/mistergastos.sql`.

El servidor de la API envía las invitaciones con PHP `mail()`, por lo que el servidor debe tener un MTA/sendmail operativo. `MISTERGASTOS_MAIL_FROM` permite configurar el remitente; si no se define, se usa `admin@alonsoftware.ga`. La API devuelve un error en vez de marcar como enviada una invitación si el transporte de correo falla.

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` ejecuta lint, genera la build, crea el fallback `404.html` para Vue Router y publica `dist` al hacer push a `main`. `public/CNAME` configura el dominio `gastoteca.alon.one` y las claves públicas Firebase de producción están en `.env.production`.

En el repositorio de GitHub solo hay que seleccionar **GitHub Actions** como origen de Pages y crear el registro DNS `CNAME gastoteca → jalonsomerchan.github.io`. En Firebase Authentication debe figurar `gastoteca.alon.one` como dominio autorizado.

## Estructura del frontend

- `src/App.vue`: estructura general, estado de carga y montaje de vistas y diálogos.
- `src/router.js` y `src/views/`: las diez rutas utilizan vistas reales con carga diferida; los dos catálogos comparten `CatalogView`.
- `src/components/layout/`: cabecera y acceso a la aplicación.
- `src/components/expenses/`: tarjeta de movimiento con propiedades y eventos, independiente del estado global.
- `src/components/dialogs/`: edición de movimientos, liquidaciones, selector de iconos y confirmación reutilizable de borrado.
- `src/state/createGastotecaState.js`: crea un estado reactivo independiente por instancia, incluidos los borradores.
- `src/composables/useGastoteca.js`: coordina la sesión, carga de rutas y módulos funcionales. `gastotecaContext.js` proporciona esa instancia a las vistas y los diálogos conservando las referencias reactivas.
- `src/composables/useExpenses.js`, `useRecurring.js`, `useBudgets.js`, `useTags.js`, `useGroup.js`, etc.: lógica por responsabilidad, con dependencias explícitas. Los cálculos de balance, catálogos y sugerencias se separan de las operaciones de API.
- `src/domain/`, `src/config/` y `src/utils/`: catálogos y constantes, navegación y formatos compartidos.
- `src/lib/`: transporte HTTP e integración con Firebase.
- `src/styles/`: estilos por área; `src/styles.css` fija el orden de carga para conservar la cascada.

Para añadir una pantalla, crea una vista en `src/views`, registra su ruta y añade su entrada de navegación si corresponde. Las reglas y operaciones de negocio deben estar en su composable; los componentes reutilizables reciben propiedades y emiten eventos. No crees una segunda instancia de `useGastoteca` desde una vista: usa `useGastotecaContext` para acceder al estado de la sesión.

## Verificación

```sh
npm run lint
npm test
npm run build
```

Las pruebas usan el ejecutor de Node y Vite para cargar componentes Vue, sin dependencias de pruebas adicionales. Cubren balances y liquidaciones, sugerencias, aislamiento del estado, reparto, contratos de guardado y borrado, errores de API y renderizado de las diez rutas y los diálogos. Las peticiones de las pruebas de operaciones están simuladas: no requieren Firebase ni modifican datos reales. El workflow ejecuta las pruebas antes de generar la build.

## Accesibilidad y uso

Las pantallas comparten enlace para saltar al contenido, títulos de documento por ruta, foco visible, estados anunciados y estilos para movimiento reducido. Los modales usan `BaseDialog` (elemento `dialog` nativo): el fondo queda inactivo, Escape cierra el diálogo y el foco regresa al control de origen. Las confirmaciones anidadas mantienen el foco dentro del diálogo superior; durante el guardado se bloquea el cierre.

Los formularios incluyen nombres accesibles, grupos de radio identificados, selectores con identificadores únicos y validación de importes y repartos. Hay confirmaciones para borrar presupuestos y cambiar de grupo, acceso manual a más movimientos y tablas alternativas para la evolución mensual.

Verificación de esta mejora: 39 pruebas automáticas, lint y build; comprobación manual en el navegador integrado con datos ficticios a 390 px de ancho de apertura, tabulación, Escape, restauración de foco, confirmación anidada y selectores. Las diez rutas se prueban también mediante renderizado con datos y vacías. No equivale a una certificación WCAG ni a una prueba completa con lector de pantalla.
