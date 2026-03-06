import mysql from 'mysql2/promise';

// Definimos la interfaz para el objeto global
interface GlobalWithPool extends Global {
  pool?: mysql.Pool;
}

declare const global: GlobalWithPool;

let pool: mysql.Pool;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no definida");
}

if (!global.pool) {
  global.pool = mysql.createPool(connectionString);
}

pool = global.pool;

export default pool;