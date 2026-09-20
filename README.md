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

La API crea automáticamente la base `mistergastos` y sus tablas `mg_*`. Establecimientos, categorías y ciudades viven en `mg_places`, `mg_categories` y `mg_cities`; `mg_expenses` guarda sus claves foráneas (`place_id`, `category_id`, `city_id`). Etiquetas, liquidaciones, presupuestos, reglas recurrentes y preferencias de Telegram usan tablas propias del grupo. Los movimientos recurrentes vencidos se materializan al consultar Gastoteca; Telegram reutiliza la conexión y el bot configurados para Menu Diario. Al iniciar, la API migra el esquema conservando los movimientos. El esquema reproducible está en `database/mistergastos.sql`.

El servidor de la API envía las invitaciones con PHP `mail()`, por lo que el servidor debe tener un MTA/sendmail operativo. `MISTERGASTOS_MAIL_FROM` permite configurar el remitente; si no se define, se usa `admin@alonsoftware.ga`. La API devuelve un error en vez de marcar como enviada una invitación si el transporte de correo falla.

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` ejecuta lint, genera la build, crea el fallback `404.html` para Vue Router y publica `dist` al hacer push a `main`. `public/CNAME` configura el dominio `gastoteca.alon.one` y las claves públicas Firebase de producción están en `.env.production`.

En el repositorio de GitHub solo hay que seleccionar **GitHub Actions** como origen de Pages y crear el registro DNS `CNAME gastoteca → jalonsomerchan.github.io`. En Firebase Authentication debe figurar `gastoteca.alon.one` como dominio autorizado.
