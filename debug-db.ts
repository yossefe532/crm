import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking audit_logs columns...')
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs';
    `
    console.log('Columns in audit_logs:', columns)
  } catch (e) {
    console.error('Error querying audit_logs:', e)
  }

  console.log('Checking lead_tasks columns...')
  try {
    const tasks = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'lead_tasks';
    `
    console.log('Columns in lead_tasks:', tasks)
  } catch (e) {
    console.error('Error querying lead_tasks:', e)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
