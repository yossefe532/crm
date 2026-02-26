
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const DATABASE_URL = 'postgres://neondb_owner:npg_ZJxOnYe3WzE5@ep-small-king-abqebkwl-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

const encoding = 'base64';

const scryptAsync = (password, salt, keyLen, n, r, p) => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLen, { N: n, r, p }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });
};

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const n = 16384;
  const r = 8;
  const p = 1;
  const keyLen = 64;
  const key = await scryptAsync(password, salt, keyLen, n, r, p);
  
  return [
    'scrypt',
    `n=${n}`,
    `r=${r}`,
    `p=${p}`,
    `k=${keyLen}`,
    salt.toString(encoding),
    key.toString(encoding)
  ].join('$');
};

async function main() {
  const targetEmail = 'doctor@gmail.com';
  const newPassword = 'Doctor#2026A1!';

  try {
    console.log(`Resetting password for: ${targetEmail}`);

    const passwordHash = await hashPassword(newPassword);
    
    await prisma.user.update({
      where: { email: targetEmail },
      data: {
        passwordHash: passwordHash,
        mustChangePassword: false,
      },
    });

    console.log(`Reset successful for ${targetEmail}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
