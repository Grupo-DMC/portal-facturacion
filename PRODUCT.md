# DMC Facturación

Contexto inferido del brief y del diseño existente en Claude Design ("Sys Facturación DMC"). Supuestos marcados; no hubo entrevista.

## Producto
Sistema interno de Comercializadora DMC SpA para registrar facturas electrónicas emitidas en el SII, controlar pagos, cobranza escalonada, planes de cuotas, OC/cotizaciones y reportes. Parte de la plataforma unificada Grupo DMC (mismo usuario/clave que los demás sistemas).

## Usuarios
- **Facturación** (operadora diaria): crea facturas, registra pagos, gestiona cobranza. Acceso total.
- **Gerencia**: solo lectura; resumen semanal, dashboards, exportar.
- **Administrador**: todo + configuración (metas, feriados, usuarios, catálogos, plantillas).

## Modo
Operate: herramienta de trabajo diario, escritorio primero, tablas densas, teclado. Escaneabilidad y consistencia por sobre expresión.

## Mundo visual (autoridad existente)
Sistema de diseño **Modernist**: plano, arquitectónico, Archivo, gris cálido #f3f2f2 con acento rojo #ec3013, radio 0, reglas de 2px, cuadrícula visible, etiquetas alineadas a la izquierda. No se redefine; se conserva.

## Decisiones de esta versión
- Sin "eyebrow" sobre los títulos: el contexto pasa a una línea de apoyo bajo el h1.
- Seguridad real (sesión firmada, RBAC en servidor, validación Zod en cada acción) en lugar de roles simulados en el cliente.
- Datos ficticios en memoria; capa de repositorio lista para SQL Server (mssql).
