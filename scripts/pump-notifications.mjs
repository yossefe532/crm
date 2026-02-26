
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BACKEND_URL = process.env.BACKEND_URL || 'https://observant-achievement-production-bb94.up.railway.app/api';

async function getAuthToken(email) {
    try {
        console.log(`Attempting login for ${email} at ${BACKEND_URL}...`);
        
        const res = await fetch(`${BACKEND_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: 'Doctor#2026A1!'
            })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`Login failed: ${res.status} ${res.statusText}`);
            console.error(`Response: ${text}`);
            return null;
        }

        const data = await res.json();
        return data.token;
    } catch (error) {
        console.error(`Failed to login user ${email}:`, error.message);
        return null;
    }
}

async function main() {
    const email = 'doctor@gmail.com';
    const token = await getAuthToken(email);
    
    if (!token) {
        console.error("Could not get token. Aborting.");
        return;
    }

    console.log("Token obtained. Pumping notifications...");

    const NOTIFICATION_COUNT = 10;
    
    for (let i = 0; i < NOTIFICATION_COUNT; i++) {
        try {
            // We use the 'test-push' endpoint or 'broadcast' if available to create notifications
            // Or we can assume there is a way to trigger one.
            // Let's use the 'broadcast' endpoint if we are owner, which we are.
            
            const res = await fetch(`${BACKEND_URL}/notifications/broadcast`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: `Test Notification ${i + 1} at ${new Date().toLocaleTimeString()}`,
                    target: 'all', // or specific user
                    channels: ['in_app']
                })
            });

            if (res.ok) {
                console.log(`Sent notification ${i + 1}`);
            } else {
                console.error(`Failed to send ${i + 1}:`, res.status);
            }

        } catch (e) {
            console.error(`Error sending ${i + 1}:`, e.message);
        }

        // Wait a bit
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("Finished pumping notifications.");
}

main().catch(e => console.error(e));
