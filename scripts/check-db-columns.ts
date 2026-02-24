
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const queries = [
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_type';",
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'granted_by';",
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_user_id';"
    ];

    for (const query of queries) {
      const res = await client.query(query);
      console.log(`Query: ${query}`);
      console.log('Result:', res.rows);
    }

  } catch (err) {
    console.error('Error executing query', err);
  } finally {
    await client.end();
  }
}

checkColumns();
