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
- `POST /gastoteca/save_expense`: crea o edita un movimiento; acepta y devuelve `share_mode` (`equal`, `amount` o `percent`).
- `POST /gastoteca/delete_expense`: elimina un gasto.
- `POST /gastoteca/save_settlement`: registra un pago entre dos miembros y reduce la deuda pendiente.
- `POST /gastoteca/save_budget` y `POST /gastoteca/delete_budget`: guardan o eliminan límites mensuales por categoría.
- `POST /gastoteca/save_recurring`, `POST /gastoteca/toggle_recurring` y `POST /gastoteca/delete_recurring`: crean, editan, pausan, reactivan o eliminan reglas recurrentes. Cada regla puede pedir confirmación del autor antes de compartir cada movimiento; «Aplicar desde» permite materializar también una fecha ya vencida.
- `POST /gastoteca/confirm_expense`: confirma un movimiento recurrente pendiente de su autor y lo publica al grupo.
- `POST /gastoteca/save_tag` y `POST /gastoteca/delete_tag`: crean, renombran o eliminan etiquetas del grupo.
- `GET /gastoteca/telegram_settings` y `POST /gastoteca/save_telegram_settings`: consultan y guardan los tipos de aviso por Telegram.
- `GET /gastoteca/backup_settings` y `POST /gastoteca/save_backup_settings`: consultan y guardan la programación de copias de la cuenta para el grupo actual (`frequency`: `disabled`, `daily`, `weekly` o `monthly`; `time`: `HH:mm`; `weekday`: 1–7; `monthday`: 1–31).
- `POST /gastoteca/send_backup`: envía el historial completo en CSV al Telegram de la cuenta autenticada. Devuelve el nombre del archivo, el número de movimientos y liquidaciones y la fecha de envío.
- `GET /gastoteca/summary_settings` y `POST /gastoteca/save_summary_settings`: consultan y guardan resúmenes diarios, semanales y mensuales independientes. El cuerpo contiene `schedules.daily`, `schedules.weekly` y `schedules.monthly`, cada uno con `enabled`, `time`, `weekday` y `monthday`.
- `POST /gastoteca/send_summary`: envía un resumen del periodo completo anterior; acepta `period`: `daily`, `weekly` o `monthly`.
- `POST /gastoteca/save_catalog_icons`: guarda los iconos Iconify del grupo para establecimientos y categorías.
- `POST /gastoteca/save_catalog_item`: crea o renombra un establecimiento o categoría y guarda su icono.
- `GET /gastoteca/quick_expense_templates`: devuelve las plantillas propias y las compartidas por miembros del grupo, con `visibility` (`private` o `group`), `created_by` y `can_edit`.
- `POST /gastoteca/save_quick_expense_templates`: guarda hasta 12 plantillas del usuario autenticado; cada una puede ser personal o para todo el grupo. Solo su creador las gestiona; la respuesta incluye todas las plantillas disponibles para ese usuario.
- `POST /gastoteca/invite_email`: envía una invitación por email.
- `POST /gastoteca/join_group`: une mediante código.
- `POST /gastoteca/leave_group`: abandona el grupo y crea uno personal.

La API crea automáticamente la base `mistergastos` y sus tablas `mg_*`. Establecimientos, categorías y ciudades viven en `mg_places`, `mg_categories` y `mg_cities`; `mg_expenses` guarda sus claves foráneas (`place_id`, `category_id`, `city_id`). Etiquetas, liquidaciones, presupuestos, reglas recurrentes y preferencias de Telegram usan tablas propias del grupo. Los movimientos y las liquidaciones registran su método de pago; el propietario puede configurar el predeterminado del grupo. Los movimientos recurrentes vencidos se materializan al consultar Gastoteca; Telegram reutiliza la conexión y el bot configurados para Menu Diario. Al iniciar, la API migra el esquema conservando los movimientos. El esquema reproducible está en `database/mistergastos.sql`.

El servidor de la API envía las invitaciones con PHP `mail()`, por lo que el servidor debe tener un MTA/sendmail operativo. `MISTERGASTOS_MAIL_FROM` permite configurar el remitente; si no se define, se usa `admin@alonsoftware.ga`. La API devuelve un error en vez de marcar como enviada una invitación si el transporte de correo falla.

## Copias por Telegram

En Ajustes, «Copias de seguridad» permite enviar una copia ahora o guardar una programación diaria, semanal o mensual. Se usa la conexión personal de Telegram de Menu Diario; los tipos de aviso seleccionados no afectan a las copias. La programación pertenece a la cuenta y al grupo actual, se elimina al abandonar el grupo y arranca desactivada. Las fechas de envío se almacenan en UTC y se muestran con horario de Madrid. El día 29, 30 o 31 se ajusta al último día de los meses más cortos sin cambiar el día elegido para los meses siguientes.

Cada archivo contiene todos los ingresos y gastos visibles para esa cuenta, incluidos sus propios movimientos pendientes de confirmación, y las liquidaciones del grupo. Los pendientes de otros autores conservan su privacidad. El CSV utiliza UTF-8 con BOM, separador `;`, importes con dos decimales y columnas de identificación, fecha, detalle, categoría, establecimiento, ciudad, pago, autoría y confirmación. Los repartos y etiquetas están en columnas JSON para conservar sus valores; el texto que podría interpretarse como una fórmula se protege al abrirlo en una hoja de cálculo. El archivo temporal se elimina tanto si el envío funciona como si falla. El transporte utiliza [sendDocument de Telegram](https://core.telegram.org/bots/api#senddocument) y admite archivos de hasta 50 MB.

El backend está en `api/GastotecaBackups.php` y `api/GastotecaSummaries.php`, incorporados por `api/mistergastos.php`; la migración automática de esquema 12 conserva las copias y añade `mg_summary_preferences`. Para producción hay que desplegar estos tres archivos, `api/telegram.php` y, si se usa el ejecutor independiente, `api/cron/gastoteca_backups.php`.

El cron existente `GET /telegram/run_scheduled_alerts` y el script `cron/menudiario_telegram.php` también ejecutan las copias. La vía HTTP de copias exige el encabezado `X-MenuDiario-Cron-Secret` con el secreto del servidor. Si ya está configurado el cron de Menu Diario con ese encabezado, no hace falta otra tarea. Como alternativa se puede ejecutar cada 10 minutos `GET /gastoteca/run_scheduled_backups` con el mismo encabezado o `php /ruta/api/cron/gastoteca_backups.php`. El envío ocurre en la primera ejecución posterior a la hora elegida, aunque la app esté cerrada. Después de un periodo sin cron se envía una única copia actual; los errores mantienen el envío pendiente para reintentarlo. Los bloqueos de MySQL evitan ejecuciones simultáneas de la misma cuenta y grupo.

## Resúmenes de gastos por Telegram

En Ajustes se pueden activar a la vez los resúmenes diarios, semanales y mensuales, con hora y día independientes, o enviar uno manualmente. Usan el mismo cron de las copias, incluso si las copias CSV están desactivadas: no hay que añadir ninguna tarea al servidor. La respuesta del cron incorpora `summaries` con el número de resúmenes revisados, enviados y fallidos. Se usa la conexión personal de Telegram; desactivar los avisos de actividad no desactiva los resúmenes.

Los mensajes resumen el último periodo completo según Europe/Madrid: el día anterior, la semana anterior de lunes a domingo o el mes anterior. Incluyen gastos del grupo, número de movimientos, media diaria, parte del reparto que corresponde al destinatario, ingresos, ingresos menos gastos, comparación de gastos con el periodo previo y cinco categorías principales más el resto. Solo cuentan movimientos confirmados; los pendientes y las liquidaciones entre miembros no se suman como gastos. Un periodo sin gastos se indica expresamente.

Las programaciones pertenecen a la cuenta y al grupo y se eliminan al abandonar el grupo. Se guardan juntas en una transacción. Los envíos manuales y guardar una programación sin modificarla conservan los envíos pendientes. El cron evita ejecuciones simultáneas y reintenta los fallos; tras una interrupción envía una vez el último periodo completo disponible, sin acumular mensajes de todos los periodos omitidos.

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

La visibilidad y la autoría de las plantillas se prueban también contra el controlador PHP con almacenamiento simulado, sin conectar con Firebase ni MySQL:

```sh
php tests/quick-template-api.test.php /Applications/MAMP/htdocs/OV2/api/mistergastos.php
php tests/backups-api.test.php /Applications/MAMP/htdocs/OV2/api/GastotecaBackups.php
php tests/backup-controller.test.php /Applications/MAMP/htdocs/OV2/api/mistergastos.php
php tests/summaries-api.test.php /Applications/MAMP/htdocs/OV2/api/GastotecaBackups.php
```

Las pruebas usan el ejecutor de Node y Vite para cargar componentes Vue, sin dependencias de pruebas adicionales. Cubren balances y liquidaciones, sugerencias, aislamiento del estado, reparto, contratos de guardado y borrado, errores de API y renderizado de las diez rutas y los diálogos. Las peticiones de las pruebas de operaciones están simuladas: no requieren Firebase ni modifican datos reales. El workflow ejecuta las pruebas antes de generar la build.

## Accesibilidad y uso

Las pantallas comparten enlace para saltar al contenido, títulos de documento por ruta, foco visible, estados anunciados y estilos para movimiento reducido. Los modales usan `BaseDialog` (elemento `dialog` nativo): el fondo queda inactivo, Escape cierra el diálogo y el foco regresa al control de origen. Las confirmaciones anidadas mantienen el foco dentro del diálogo superior; durante el guardado se bloquea el cierre.

Los formularios incluyen nombres accesibles, grupos de radio identificados, selectores con identificadores únicos y validación de importes y repartos. Hay confirmaciones para borrar presupuestos y cambiar de grupo, acceso manual a más movimientos y tablas alternativas para la evolución mensual.

Establecimientos, categorías, etiquetas, presupuestos y recurrentes se crean y editan en modales. El nombre y el icono de cada elemento del catálogo se guardan juntos; cancelar descarta el borrador y un error conserva el editor abierto. Estas pantallas y gastos rápidos tienen un buscador encima del listado que ignora tildes y mayúsculas, indica el número de resultados y permite limpiar la búsqueda.

La gestión de datos se ha comprobado con 61 pruebas automáticas, lint y build, además de una revisión en el navegador integrado con datos ficticios a 390 y 1280 px de ancho: búsqueda, cancelación, errores, guardado, foco, selector de iconos anidado y ausencia de desbordamiento horizontal.

Verificación de esta mejora: 39 pruebas automáticas, lint y build; comprobación manual en el navegador integrado con datos ficticios a 390 px de ancho de apertura, tabulación, Escape, restauración de foco, confirmación anidada y selectores. Las diez rutas se prueban también mediante renderizado con datos y vacías. No equivale a una certificación WCAG ni a una prueba completa con lector de pantalla.
