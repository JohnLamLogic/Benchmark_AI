import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    try {
        const e = await prisma.employee.create({
            data: {
                name: "Test",
                email: "e@e.com",
                positions: "Server"
            }
        });
        console.log("Created successfully:", e);
    } catch (err: any) {
        fs.writeFileSync('prisma-error.json', JSON.stringify({ message: err.message, meta: err.meta, code: err.code }));
    } finally {
        await prisma.$disconnect();
    }
}

main();
