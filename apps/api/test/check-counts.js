const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const flows = await prisma.flow.count();
  const detections = await prisma.detection.count();
  const incidents = await prisma.incident.count();
  console.log({ flows, detections, incidents });
  await prisma.$disconnect();
}

main();
