const { PrismaClient } = require('@prisma/client');
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
    } catch (err) {
        console.log("JSON STRINGIFIED ERROR:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } finally {
        await prisma.$disconnect();
    }
}

main();
