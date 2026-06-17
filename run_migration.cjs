const { readFileSync } = require('fs');
const { Client } = require('pg');

const key = readFileSync('C:\\Users\\DELL\\AppData\\Local\\Temp\\opencode\\svc_key.txt', 'utf8').trim();
const sql = readFileSync('C:\\Users\\DELL\\solemate\\supabase\\migrations\\20260617000000_features.sql', 'utf8');
const projectRef = 'ijiqrinhueknwhcyuzhj';

async function run() {
  const hosts = [
    { host: `db.${projectRef}.supabase.co`, port: 5432, label: 'direct' },
    { host: 'aws-0-ap-southeast-1.pooler.supabase.com', port: 6543, user: `postgres.${projectRef}`, label: 'pooler' },
  ];
  for (const h of hosts) {
    try {
      const client = new Client({
        host: h.host,
        port: h.port,
        user: h.user || 'postgres',
        password: key,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });
      await client.connect();
      console.log(`Connected via ${h.label}!`);
      await client.query(sql);
      console.log('Migration ran successfully');
      await client.end();
      process.exit(0);
    } catch (err) {
      console.log(`${h.label} failed: ${err.message}`);
    }
  }
  process.exit(1);
}

run();
