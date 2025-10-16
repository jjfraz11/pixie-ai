import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export default prisma;
// Export a cleanup function for tests
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
