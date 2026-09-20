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
- `POST /gastoteca/save_catalog_icons`: guarda los iconos Iconify del grupo para establecimientos y categorías.
- `POST /gastoteca/invite_email`: envía una invitación por email.
- `POST /gastoteca/join_group`: une mediante código.
- `POST /gastoteca/leave_group`: abandona el grupo y crea uno personal.

La API crea automáticamente la base `mistergastos` y sus tablas `mg_*`. Establecimientos, categorías y ciudades viven en `mg_places`, `mg_categories` y `mg_cities`; `mg_expenses` guarda sus claves foráneas (`place_id`, `category_id`, `city_id`). Al iniciar, la API migra los nombres e iconos del esquema anterior conservando los movimientos. El esquema reproducible está en `database/mistergastos.sql`.

El servidor de la API envía las invitaciones con PHP `mail()`, por lo que el servidor debe tener un MTA/sendmail operativo. `MISTERGASTOS_MAIL_FROM` permite configurar el remitente; si no se define, se usa `admin@alonsoftware.ga`. La API devuelve un error en vez de marcar como enviada una invitación si el transporte de correo falla.

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` ejecuta lint, genera la build, crea el fallback `404.html` para Vue Router y publica `dist` al hacer push a `main`. `public/CNAME` configura el dominio `gastoteca.alon.one` y las claves públicas Firebase de producción están en `.env.production`.

En el repositorio de GitHub solo hay que seleccionar **GitHub Actions** como origen de Pages y crear el registro DNS `CNAME gastoteca → jalonsomerchan.github.io`. En Firebase Authentication debe figurar `gastoteca.alon.one` como dominio autorizado.
