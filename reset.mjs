
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

const encoding = "base64";

const serialize = (payload) => {
  return [
    payload.version,
    `n=${payload.n}`,
    `r=${payload.r}`,
    `p=${payload.p}`,
    `k=${payload.keyLen}`,
    payload.salt.toString(encoding),
    payload.key.toString(encoding)
  ].join("$")
};

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
  return serialize({ version: "scrypt", salt, key, n, r, p, keyLen });
};

async function main() {
  const email = 'y@gmail.com';
  const newPassword = '123456';
  
  try {
    const hashedPassword = await hashPassword(newPassword);
    
    const user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash: hashedPassword,
        mustChangePassword: false // Optional: force them to change it again if you want
      }
    });
    
    console.log(`Successfully updated password for ${user.email} to ${newPassword}`);
    console.log(`New Hash: ${hashedPassword}`);
    
  } catch (e) {
    console.error('Error updating password:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
