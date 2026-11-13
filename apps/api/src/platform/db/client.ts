import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import "./schema.js";

export interface Database {
  readonly sql: Sql;
  readonly db: PostgresJsDatabase;
  close(): Promise<void>;
}

export function createDatabase(url: string): Database {
  const sql = postgres(url);
  return {
    sql,
    db: drizzle({ client: sql }),
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}

export function createMigrationDatabase(url: string): Database {
  const sql = postgres(url, { max: 1 });
  return {
    sql,
    db: drizzle({ client: sql }),
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}

export async function pingDatabase(database: Database): Promise<void> {
  await database.sql`select 1`;
}

export async function migrationsAreApplied(
  database: Database,
): Promise<boolean> {
  const rows = await database.sql<[{ present: boolean }]>`
    select exists(
      select 1
      from information_schema.tables
      where table_schema = 'drizzle'
        and table_name = '__drizzle_migrations'
    ) as present
  `;
  return rows[0].present;
}
