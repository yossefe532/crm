import dotenv from 'dotenv';

dotenv.config();

export const env = {
    port: Number(process.env.PORT) || 4000,
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    cronTimezone: process.env.CRON_TIMEZONE || 'UTC',
    whatsappApiBaseUrl: process.env.WHATSAPP_API_BASE_URL || '',
    whatsappApiToken: process.env.WHATSAPP_API_TOKEN || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    ownerPhoneNumber: process.env.OWNER_PHONE_NUMBER || ''
};