# DMC Facturación

Sistema interno de **Comercializadora DMC SpA** para registrar facturas electrónicas emitidas en el SII, controlar pagos, gestionar la cobranza escalonada, los planes de cuotas y las órdenes de compra, y sacar reportes.

Es la versión en código del diseño **"Sys Facturación DMC"** (Claude Design, sistema visual *Modernist*), con las correcciones listadas al final.

> **Estado:** funcional con datos **ficticios** en memoria. La conexión a SQL Server y el envío real de correos/WhatsApp están pendientes (ver [Pendiente](#pendiente)).

## Contenido

- [Stack](#stack)
- [Requisitos](#requisitos)
- [Inicio rápido](#inicio-rápido)
- [Variables de entorno](#variables-de-entorno)
- [Scripts](#scripts)
- [Roles y permisos](#roles-y-permisos)
- [Pantallas](#pantallas)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Reglas de negocio](#reglas-de-negocio)
- [Seguridad](#seguridad)
- [Qué se sube a Git y qué no](#qué-se-sube-a-git-y-qué-no)
- [Pendiente](#pendiente)
- [Diferencias respecto a la maqueta](#diferencias-respecto-a-la-maqueta)

## Stack

| Área | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, `proxy.ts`) |
| UI | React 19 · Tailwind CSS 4 · lucide-react |
| Lenguaje | TypeScript 5 (modo estricto) |
| Validación | Zod 4 |
| PDF | pdf-lib |
| Base de datos | mssql (SQL Server) — pendiente de conectar |
| Diseño | Sistema **Modernist**: plano, Archivo, acento `#ec3013`, radio 0, reglas de 2 px |

## Requisitos

- **Node.js 20.9 o superior** (probado con 24)
- npm 10 o superior

## Inicio rápido

```bash
npm install
cp .env.example .env.local     # en Windows: copy .env.example .env.local
npm run dev                    # http://localhost:3000
```

Al abrir la app, entra con los botones de **acceso de demostración** del login (Facturación, Gerencia, Admin) o con:

| Usuario | Rol | Clave |
|---|---|---|
| `mjgonzalez` | Facturación | `Dmc2026!` |
| `gherrera` | Gerencia | `Dmc2026!` |
| `amunoz` | Administrador | `Dmc2026!` |

Los datos son **ficticios** y viven en memoria: se reinician cada vez que se reinicia el servidor.

## Variables de entorno

Se copian de `.env.example` a `.env.local` (este último **nunca** se sube a Git).

| Variable | Obligatoria | Descripción |
|---|---|---|
| `SESSION_SECRET` | En producción | 32+ caracteres aleatorios para firmar la sesión. Sin ella no se puede iniciar sesión en producción. Generar con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DEMO_MODE` | No | `true` muestra el acceso demo y las claves de ejemplo. Fuera de producción está activo salvo que pongas `false`; en producción solo si lo pones en `true`. |
| `DEMO_PASSWORD` | No | Cambia la clave de los usuarios demo (por defecto `Dmc2026!`). |
| `DATA_SOURCE` | No | `mock` (por defecto) o `mssql` (aún no implementado). |
| `DMC_TODAY` | No | Fecha "hoy" fija (`AAAA-MM-DD`) para que los datos de ejemplo sean coherentes. Por defecto `2026-10-26`. |
| `MSSQL_SERVER`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD` | Con `mssql` | Conexión a SQL Server. |
| `MSSQL_ENCRYPT`, `MSSQL_TRUST_SERVER_CERTIFICATE` | No | Cifrado de la conexión (`true` / `false`). |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Sirve la compilación (requiere `SESSION_SECRET`) |
| `npm run typecheck` | Genera los tipos de rutas y revisa TypeScript |

## Roles y permisos

El rol se lee **del servidor** en cada petición; ocultar un botón no es la defensa, la defensa es la comprobación en cada acción.

| Rol | Puede |
|---|---|
| **Facturación** | Todo lo operativo: crear/editar/anular facturas, registrar pagos y gestiones, envíos, clientes, planes |
| **Gerencia** | Solo lectura: dashboard, resumen semanal, listados, reportes y exportaciones |
| **Administrador** | Todo lo anterior + Configuración (metas, feriados, usuarios, catálogos, plantillas) |

## Pantallas

| Ruta | Contenido |
|---|---|
| `/` | Dashboard: KPIs, meta/mínimo, "requiere atención hoy", 13 gráficos con vista de tabla |
| `/semanal` | Resumen semanal para gerencia |
| `/facturas` | Libro de facturación: filtros, vistas guardadas, modo planilla, acciones masivas |
| `/ordenes-de-compra` | OC cliente, cotizaciones y HEP; OC sin factura; facturas sin OC |
| `/pagadas` | Facturas pagadas, medios de pago, días promedio de pago |
| `/por-cobrar` | Saldos, antigüedad de deuda, detalle por cliente |
| `/cobranza` | Escalamiento 1 Correo → 2 WhatsApp → 3 Otros contactos → 4 Llamada; agenda y compromisos |
| `/planes` | Planes de cuotas y de calibración (cada cuota es una factura) |
| `/clientes`, `/clientes/[id]` | Clientes, contactos, reglas por cliente, historial |
| `/historico` | Comparativos 2026 vs 2025, rankings, libro por mes |
| `/reportes` | 8 reportes con exportación a Excel (CSV) y PDF |
| `/configuracion` | Solo Administrador |
| `/api/pdf/[kind]/[id]` | PDF de factura, estado de cuenta y reportes (requiere sesión) |

Atajos: `N` nueva factura · `/` buscar · `P` registrar pago en la factura abierta · `Esc` cerrar.

## Estructura del proyecto

```
src/
├─ proxy.ts                 Sesión obligatoria + cabeceras de seguridad (CSP con nonce)
├─ app/
│  ├─ login/                Pantalla de ingreso
│  ├─ (app)/                Pantallas protegidas (layout con sesión + datos)
│  ├─ api/pdf/              Generación de PDF
│  └─ globals.css           Tokens del sistema Modernist + componentes base
├─ components/              UI (shell, panel de factura, modales, gráficos)
│  └─ views/                Una vista por pantalla
├─ lib/                     Reglas de negocio puras (se usan en servidor y cliente)
│  ├─ domain.ts             Estados, vencimiento hábil, cobranza, RUT, planes
│  ├─ schemas.ts            Validación con Zod 4
│  ├─ reports.ts            Definición de reportes
│  └─ format.ts, export.ts, files.ts, view.ts, session-token.ts, types.ts
└─ server/                  Solo servidor
   ├─ actions.ts            Mutaciones (Server Actions)
   ├─ guard.ts              Sesión + rol + Zod + errores controlados
   ├─ auth.ts, auth-actions.ts, rate-limit.ts
   ├─ store.ts, seed.ts     Repositorio en memoria + datos ficticios
   ├─ db/mssql.ts           Conexión a SQL Server (pendiente de usar)
   └─ pdf.ts                Render de PDF con pdf-lib
```

## Reglas de negocio

- **IVA 19 %**: siempre calculado (`neto × 0,19`), nunca editable.
- **Folio** = N° emitido en el portal del SII; único.
- **Vencimiento** = emisión + condición (0 / 30 / 60 / N días). Si cae en sábado, domingo o feriado se corre al siguiente **día hábil**. Los feriados se administran en Configuración.
- **Estados**: `Pendiente` → `Pago parcial` (hay abonos) → `Pagada` (saldo 0). Pasa sola a `En cobranza` el día hábil siguiente al vencimiento si hay saldo. `Anulada` (con nota de crédito) no suma a los totales.
- **Cobranza**: escalamiento de 4 pasos; los compromisos de pago quedan `Hoy`, `Pendiente`, `Cumplido` o `Incumplido`.
- **Clientes que exigen OC** (p. ej. Walmart): advertencia al guardar sin OC; reglas de "una sola OC" y HEP por cliente.
- **Cuotas**: facturar en cuotas crea un plan; la cuota 1 se emite al instante y las demás quedan por emitir.

## Seguridad

- **Sesión**: cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción, firmada con HMAC-SHA256, 8 horas.
- **Toda mutación** pasa por `guard()`: sesión vigente → rol → validación Zod → reglas de negocio → errores sin detalles internos.
- **Login**: contraseñas con scrypt + sal, comparación en tiempo constante, mensaje único (no revela si el usuario existe) y límite de intentos.
- **Cabeceras** (`src/proxy.ts`): CSP con nonce y `strict-dynamic`, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store`.
- **Exportaciones**: las celdas que empiezan con `=`, `+`, `-` o `@` se neutralizan (inyección de fórmulas en Excel).
- **PDF**: requieren sesión, validan parámetros y sanean el texto.
- **Adjuntos**: se valida tipo y tamaño (máx. 10 MB) y se guardan solo metadatos.
- **Dependencias**: `npm audit` sin vulnerabilidades al momento de escribir esto.

### Antes de ir a producción

1. Definir `SESSION_SECRET` (32+ caracteres aleatorios).
2. `DEMO_MODE=false` y `DATA_SOURCE=mssql`.
3. Implementar el repositorio SQL con consultas **parametrizadas**, transacciones y un índice `UNIQUE` en el folio.
4. Usar un usuario de BD con permisos mínimos y `MSSQL_ENCRYPT=true`.
5. Detrás de un proxy de confianza (el límite de intentos usa `X-Forwarded-For`); con varias instancias, mover el contador a Redis o a la BD.
6. Conectar los usuarios al core DMC (hoy son de demostración).

## Qué se sube a Git y qué no

El `.gitignore` está pensado para que en el repositorio vaya **solo código y documentación**.

| Se sube | No se sube |
|---|---|
| `src/`, configuración (`package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`) | `node_modules/`, `.next/`, `*.tsbuildinfo`, `next-env.d.ts` |
| `package-lock.json` (se usa **npm**) | `yarn.lock`, `pnpm-lock.yaml`, `bun.lock` |
| `.env.example` (plantilla sin valores reales) | `.env`, `.env.local`, `.env.production`, llaves y certificados (`*.pem`, `*.key`, …) |
| `README.md`, `PRODUCT.md`, `AGENTS.md` | Datos reales: `*.xlsx`, `*.csv`, `*.pdf`, `*.xml`, `*.bak`, `*.mdf`, `*.sqlite`, `/data`, `/uploads`, `/exports` |
| `.vscode/settings.json`, `extensions.json`, `launch.json` | Estado local de editores y asistentes: `.idea/`, `.claude/`, `.cursor/`, `.impeccable/`, `scratch/` |
| | Archivos del sistema, logs, caché, cobertura y comprimidos |

> **Regla:** este repositorio usa datos ficticios. Nunca subas RUT, facturas, pagos ni respaldos reales de clientes. Si necesitas un PDF/XML dentro del código (por ejemplo un asset estático), colócalo en `public/` — esa carpeta está exceptuada.

## Pendiente

- Repositorio SQL Server (hoy: memoria con datos ficticios).
- Envío real de correo y WhatsApp (hoy solo se **registra** la acción).
- Almacenamiento de adjuntos con validación de contenido y antivirus.
- Usuarios y contraseñas conectados al core DMC.
- Pruebas automatizadas.

## Diferencias respecto a la maqueta

**Corregido**

- Login y roles reales (la maqueta simulaba ambos en el navegador).
- Validación y reglas de negocio también en el servidor, no solo en el formulario.
- Inyección de fórmulas en las exportaciones CSV.
- Las plantillas de correo reemplazan **todas** las variables repetidas (antes solo la primera).
- PDF reales con pdf-lib (antes `window.print`).
- La fecha de pago y la de emisión ya no pueden ser futuras; el pago no puede superar el saldo.

**Mejorado**

- Diálogos nativos accesibles (foco atrapado, `Esc`, etiquetas) y filas navegables por teclado.
- Mejor contraste en el texto secundario y estados de foco visibles.
- Sin "eyebrow" sobre los títulos: el contexto pasa a una línea de apoyo bajo el `h1`.
- Filtros avanzados y vistas guardadas (se recuerdan en el navegador de cada persona).
