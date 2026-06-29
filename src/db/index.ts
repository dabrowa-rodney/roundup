import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    const sql: NeonQueryFunction<false, false> = neon(process.env.DATABASE_URL);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// Convenience alias — lazy proxy so the module can be imported at build time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: NeonHttpDatabase<typeof schema> = new Proxy({} as any, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getDb() as any)[prop];
  },
});
