import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function resetDatabase() {
  try {
    console.log("🗑️  Удаление всех таблиц из базы данных...");

    // Drop all tables
    await pool.query(`
      DROP TABLE IF EXISTS bets CASCADE;
      DROP TABLE IF EXISTS wallets CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    console.log("✅ Все таблицы успешно удалены!");
    console.log("ℹ️  Теперь выполните: bun run db:push");

  } catch (error) {
    console.error("❌ Ошибка при удалении таблиц:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
