import crypto from "node:crypto"
import process from "node:process"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const normalizeEmail = (v) => String(v || "").trim().toLowerCase()

const encoding = "base64"

const scryptAsync = (password, salt, keyLen, n, r, p) => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLen, { N: n, r, p }, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(derivedKey)
    })
  })
}

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16)
  const n = 16384
  const r = 8
  const p = 1
  const keyLen = 64
  const key = await scryptAsync(password, salt, keyLen, n, r, p)
  return ["scrypt", `n=${n}`, `r=${r}`, `p=${p}`, `k=${keyLen}`, salt.toString(encoding), key.toString(encoding)].join("$")
}

const NEW_EMAIL = normalizeEmail(process.env.OWNER_EMAIL || "y@gmail.com")
const NEW_PASSWORD = String(process.env.OWNER_PASSWORD || "123456789")
const DEFAULT_TENANT_NAME = String(process.env.TENANT_NAME || "Main").trim() || "Main"
const DEFAULT_TENANT_TIMEZONE = String(process.env.TENANT_TIMEZONE || "UTC").trim() || "UTC"

async function main() {
  let tenant = await prisma.tenant.findFirst({ where: { deletedAt: null, status: "active" }, orderBy: { createdAt: "asc" } })
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { name: DEFAULT_TENANT_NAME, timezone: DEFAULT_TENANT_TIMEZONE, status: "active" } })
  }

  const ownerLink = await prisma.userRole.findFirst({
    where: { tenantId: tenant.id, revokedAt: null, role: { name: "owner" } },
    include: { user: true, role: true },
    orderBy: { assignedAt: "asc" }
  })

  let ownerUser = ownerLink?.user ?? null
  if (!ownerUser) {
    ownerUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, deletedAt: null, status: "active" },
      orderBy: { createdAt: "asc" }
    })
  }

  const emailTaken = await prisma.user.findFirst({ where: { email: NEW_EMAIL, deletedAt: null } })
  if (emailTaken && (!ownerUser || emailTaken.id !== ownerUser.id)) {
    throw new Error(`Email already used by another user: ${NEW_EMAIL}`)
  }

  const passwordHash = await hashPassword(NEW_PASSWORD)

  if (!ownerUser) {
    ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: NEW_EMAIL,
        passwordHash,
        mustChangePassword: false,
        status: "active",
        lastLoginAt: new Date()
      }
    })
  } else {
    await prisma.user.update({
      where: { id: ownerUser.id },
      data: { email: NEW_EMAIL, passwordHash, mustChangePassword: false }
    })
  }

  let ownerRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, deletedAt: null, name: "owner" } })
  if (!ownerRole) {
    ownerRole = await prisma.role.create({ data: { tenantId: tenant.id, name: "owner", scope: "tenant" } })
  }

  const hasOwnerLink = await prisma.userRole.findFirst({
    where: { tenantId: tenant.id, userId: ownerUser.id, roleId: ownerRole.id, revokedAt: null }
  })
  if (!hasOwnerLink) {
    await prisma.userRole.create({
      data: { tenantId: tenant.id, userId: ownerUser.id, roleId: ownerRole.id, assignedBy: ownerUser.id }
    })
  }

  console.log(JSON.stringify({ ok: true, tenantId: tenant.id, userId: ownerUser.id, email: NEW_EMAIL }, null, 2))
}

main()
  .catch((err) => {
    console.error("FAILED", err?.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
