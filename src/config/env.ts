import dotenv from 'dotenv';

dotenv.config();

const resolveDatabaseUrl = () => {
    const databaseUrl = process.env.DATABASE_URL || '';
    const pgHost = process.env.PGHOST || process.env.POSTGRES_HOST || '';
    const pgPort = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
    const pgUser = process.env.PGUSER || process.env.POSTGRES_USER || '';
    const pgPassword = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '';
    const pgDatabase = process.env.PGDATABASE || process.env.POSTGRES_DB || '';
    const hasPgParts = Boolean(pgHost && pgUser && pgPassword && pgDatabase);
    const isNeonUrl = databaseUrl.includes('neon.tech');

    if (hasPgParts && (isNeonUrl || !databaseUrl)) {
        return `postgresql://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDatabase}`;
    }

    return databaseUrl;
};

export const env = {
    port: Number(process.env.PORT) || 4000,
    databaseUrl: resolveDatabaseUrl(),
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    cronTimezone: process.env.CRON_TIMEZONE || 'UTC',
    whatsappApiBaseUrl: process.env.WHATSAPP_API_BASE_URL || '',
    whatsappApiToken: process.env.WHATSAPP_API_TOKEN || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    ownerPhoneNumber: process.env.OWNER_PHONE_NUMBER || ''
};
