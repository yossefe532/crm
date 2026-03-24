import dotenv from 'dotenv';

dotenv.config();

const resolveDatabaseUrl = () => {
    const databaseUrl = process.env.DATABASE_URL || '';
    const postgresUrl = process.env.POSTGRES_URL || '';
    const postgresqlUrl = process.env.POSTGRESQL_URL || '';
    const databasePrivateUrl = process.env.DATABASE_PRIVATE_URL || '';
    const urlCandidates = [
        { key: 'DATABASE_URL', value: databaseUrl },
        { key: 'POSTGRES_URL', value: postgresUrl },
        { key: 'POSTGRESQL_URL', value: postgresqlUrl },
        { key: 'DATABASE_PRIVATE_URL', value: databasePrivateUrl }
    ].filter((item) => Boolean(item.value));
    const nonNeonCandidate = urlCandidates.find((item) => !item.value.includes('neon.tech'));
    if (nonNeonCandidate) {
        console.log('[env] using database url from', nonNeonCandidate.key);
        return nonNeonCandidate.value;
    }

    const pgHost = process.env.PGHOST || process.env.POSTGRES_HOST || '';
    const pgPort = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
    const pgUser = process.env.PGUSER || process.env.POSTGRES_USER || '';
    const pgPassword = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '';
    const pgDatabase = process.env.PGDATABASE || process.env.POSTGRES_DB || '';
    const hasPgParts = Boolean(pgHost && pgUser && pgPassword && pgDatabase);
    const isNeonUrl = databaseUrl.includes('neon.tech');

    if (hasPgParts && (isNeonUrl || !databaseUrl)) {
        console.log('[env] using constructed database url from PG* variables');
        return `postgresql://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDatabase}`;
    }

    console.log('[env] using fallback database url from DATABASE_URL');
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
