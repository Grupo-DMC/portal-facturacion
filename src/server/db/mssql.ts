import "server-only";
import sql from "mssql";

/**
 * Conexión a SQL Server (pendiente de conectar: hoy la app corre con datos ficticios en memoria).
 *
 * Reglas para cuando se implemente el repositorio:
 *  - TODA consulta con parámetros tipados (`request.input("folio", sql.Int, v)`); nunca concatenar texto.
 *  - Usuario de BD con permisos mínimos (sin db_owner); credenciales solo por variables de entorno.
 *  - Encrypt activo (MSSQL_ENCRYPT=true) y TrustServerCertificate=false salvo entornos de desarrollo.
 *  - Mutaciones dentro de transacción (factura + eventos + pagos) y folio único con índice UNIQUE.
 */
const g = globalThis as unknown as { __dmcPool?: Promise<sql.ConnectionPool> };

function cfg(): sql.config {
  const required = ["MSSQL_SERVER", "MSSQL_DATABASE", "MSSQL_USER", "MSSQL_PASSWORD"] as const;
  for (const k of required) if (!process.env[k]) throw new Error(`Falta la variable de entorno ${k}`);
  return {
    server: process.env.MSSQL_SERVER!,
    database: process.env.MSSQL_DATABASE!,
    user: process.env.MSSQL_USER!,
    password: process.env.MSSQL_PASSWORD!,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT !== "false",
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === "true",
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    requestTimeout: 15_000,
  };
}

export function getPool() {
  if (!g.__dmcPool) g.__dmcPool = new sql.ConnectionPool(cfg()).connect();
  return g.__dmcPool;
}

export { sql };
