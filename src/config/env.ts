import dotenv from 'dotenv';

dotenv.config();

const resolveDatabaseUrl = () => {
    const normalize = (value: string) => value.trim();
    const isTemplateReference = (value: string) => /\$\{\{[^}]+\}\}/.test(value);
    const isPostgresUrl = (value: string) => /^postgres(ql)?:\/\//i.test(value);
    const isUsableRuntimeUrl = (value: string) => Boolean(value) && isPostgresUrl(value) && !isTemplateReference(value);
    const toNeonPoolerHost = (host: string) => {
        const normalized = host.toLowerCase();
        if (!normalized.includes('neon.tech') || normalized.includes('-pooler.')) {
            return host;
        }
        const firstDot = host.indexOf('.');
        if (firstDot === -1) {
            return host;
        }
        const prefix = host.slice(0, firstDot);
        const suffix = host.slice(firstDot + 1);
        return `${prefix}-pooler.${suffix}`;
    };
    const withRequiredSslMode = (url: string) => {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();
            const mustUseSsl = host.includes('neon.tech') || host.includes('railway');
            if (host.includes('neon.tech')) {
                parsed.hostname = toNeonPoolerHost(parsed.hostname);
            }
            if (mustUseSsl && !parsed.searchParams.has('sslmode')) {
                parsed.searchParams.set('sslmode', 'require');
            }
            return parsed.toString();
        } catch {
            return url;
        }
    };
    const knownUrlCandidates = [
        { key: 'DATABASE_URL', value: process.env.DATABASE_URL || '' },
        { key: 'DATABASE_PRIVATE_URL', value: process.env.DATABASE_PRIVATE_URL || '' },
        { key: 'DATABASE_PUBLIC_URL', value: process.env.DATABASE_PUBLIC_URL || '' },
        { key: 'POSTGRES_URL', value: process.env.POSTGRES_URL || '' },
        { key: 'POSTGRESQL_URL', value: process.env.POSTGRESQL_URL || '' },
        { key: 'POSTGRES_PUBLIC_URL', value: process.env.POSTGRES_PUBLIC_URL || '' }
    ];
    const dynamicUrlCandidates = Object.entries(process.env)
        .filter(([key, value]) => Boolean(value) && /(POSTGRES|DATABASE).*(URL)|URL.*(POSTGRES|DATABASE)/i.test(key))
        .map(([key, value]) => ({ key, value: value || '' }));
    const mergedCandidates = [...knownUrlCandidates, ...dynamicUrlCandidates]
        .map((candidate) => ({ key: candidate.key, value: normalize(candidate.value) }))
        .filter((candidate, index, array) => array.findIndex((item) => item.key === candidate.key) === index);
    const usableCandidates = mergedCandidates.filter((candidate) => isUsableRuntimeUrl(candidate.value));
    const preferredCandidate = usableCandidates.find((candidate) => !candidate.value.toLowerCase().includes('neon.tech'));
    if (preferredCandidate) {
        console.log('[env] using database url from', preferredCandidate.key);
        return withRequiredSslMode(preferredCandidate.value);
    }
    if (usableCandidates.length > 0) {
        console.log('[env] using fallback usable database url from', usableCandidates[0].key);
        return withRequiredSslMode(usableCandidates[0].value);
    }

    const pgHost = process.env.PGHOST || process.env.POSTGRES_HOST || '';
    const pgPort = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
    const pgUser = process.env.PGUSER || process.env.POSTGRES_USER || '';
    const pgPassword = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '';
    const pgDatabase = process.env.PGDATABASE || process.env.POSTGRES_DB || '';
    const pgSslMode = process.env.PGSSLMODE || process.env.POSTGRES_SSLMODE || 'require';
    const hasPgParts = Boolean(pgHost && pgUser && pgPassword && pgDatabase);
    const databaseUrl = normalize(process.env.DATABASE_URL || '');
    const isNeonUrl = databaseUrl.toLowerCase().includes('neon.tech');
    const isMissingOrTemplateDatabaseUrl = !databaseUrl || isTemplateReference(databaseUrl);

    if (hasPgParts && (isNeonUrl || isMissingOrTemplateDatabaseUrl)) {
        console.log('[env] using constructed database url from PG* variables');
        return `postgresql://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${encodeURIComponent(pgSslMode)}`;
    }

    console.log('[env] using fallback database url from DATABASE_URL');
    return withRequiredSslMode(databaseUrl);
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
