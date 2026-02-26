
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BACKEND_URL = process.env.BACKEND_URL || 'https://observant-achievement-production-bb94.up.railway.app/api';
const CONCURRENT_USERS = 20; // Number of simulated users
const REQUESTS_PER_USER = 50; // Requests per user
const REFETCH_INTERVAL = 250; // Milliseconds

async function getAuthToken(email) {
    try {
        // Skip local DB check, go straight to API
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

async function simulateUser(userId, token) {
    let successCount = 0;
    let failCount = 0;
    const latencies = [];

    for (let i = 0; i < REQUESTS_PER_USER; i++) {
        const start = Date.now();
        try {
            const res = await fetch(`${BACKEND_URL}/notifications?limit=10`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            failCount++;
        }
        const end = Date.now();
        latencies.push(end - start);

        // Wait for the refetch interval
        await new Promise(r => setTimeout(r, REFETCH_INTERVAL));
    }

    return { successCount, failCount, latencies };
}

async function main() {
    console.log(`Starting Load Test: ${CONCURRENT_USERS} users, ${REQUESTS_PER_USER} reqs each, ${REFETCH_INTERVAL}ms interval`);

    // 1. Setup Test Users (or use existing owner)
    const ownerEmail = 'doctor@gmail.com';
    const token = await getAuthToken(ownerEmail);
    
    if (!token) {
        console.error("Could not get token for owner. Aborting.");
        return;
    }

    console.log("Token obtained. Simulating load...");

    // We will simulate the SAME user multiple times to stress the endpoint logic
    // In reality, different users would stress the DB differently, but same user stresses the same query.
    const promises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
        promises.push(simulateUser(`SimUser-${i}`, token));
    }

    const results = await Promise.all(promises);

    // Analyze Results
    let totalSuccess = 0;
    let totalFail = 0;
    let allLatencies = [];

    results.forEach(r => {
        totalSuccess += r.successCount;
        totalFail += r.failCount;
        allLatencies = allLatencies.concat(r.latencies);
    });

    const avgLatency = allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
    const maxLatency = Math.max(...allLatencies);
    const p95Latency = allLatencies.sort((a, b) => a - b)[Math.floor(allLatencies.length * 0.95)];

    console.log("\n--- Load Test Results ---");
    console.log(`Total Requests: ${totalSuccess + totalFail}`);
    console.log(`Successful: ${totalSuccess}`);
    console.log(`Failed: ${totalFail}`);
    console.log(`Success Rate: ${((totalSuccess / (totalSuccess + totalFail)) * 100).toFixed(2)}%`);
    console.log(`Avg Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Max Latency: ${maxLatency}ms`);
    console.log(`95th Percentile Latency: ${p95Latency}ms`);
    
    if (avgLatency > 500) {
        console.warn("WARNING: Average latency is high (>500ms). The 250ms polling might be causing backlog.");
    } else {
        console.log("PERFORMANCE: Good. System handles the load well.");
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
