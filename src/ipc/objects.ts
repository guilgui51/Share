import {ipcMain} from "electron";
import {prisma} from "../../prisma";

export type ObjectsIpcs = {
    "objects:getAll": () => Promise<any[]>; // returns objects with nested types + parts
    "objects:add": (data: ObjectFormData) => Promise<any>;
    "objects:edit": (id: number, data: ObjectFormData) => Promise<any>;
    "objects:delete": (id: number) => Promise<boolean>;
}

export function registerObjectHandlers() {
    ipcMain.handle("objects:getAll", async () => {
        return prisma.object.findMany({
            orderBy: { id: "asc" },
            include: {
                types: {
                    include: {
                        parts: true,
                    },
                },
            },
        });
    });

    ipcMain.handle("objects:add", async (_, data: ObjectFormData) => {
        // Step 1 — Create the base object
        const createdObject = await prisma.object.create({
            data: {
                name: data.name,
            },
        });

        // Step 2 — Create all types and their parts based on shared part definitions
        for (const typeData of data.types) {
            const type = await prisma.type.create({
                data: {
                    name: typeData.name,
                    objectId: createdObject.id,
                },
            });

            // For each object-level part, create a part record for this type
            for (const partDef of data.parts) {
                const quantity = typeData.quantities?.[partDef.name] ?? 0;
                if (quantity > 0) {
                    await prisma.part.create({
                        data: {
                            name: partDef.name,
                            quantity,
                            typeId: type.id,
                        },
                    });
                }
            }
        }

        // Return the fully populated object
        return prisma.object.findUnique({
            where: { id: createdObject.id },
            include: { types: { include: { parts: true } } },
        });
    });

    ipcMain.handle("objects:edit", async (_, id: number, data: ObjectFormData) => {
        // Step 1 — Update base object name
        await prisma.object.update({
            where: { id },
            data: { name: data.name },
        });

        // Step 2 — Delete old types and parts (cascade)
        await prisma.type.deleteMany({ where: { objectId: id } });

        // Step 3 — Recreate new types and parts from fresh data
        for (const typeData of data.types) {
            const type = await prisma.type.create({
                data: {
                    name: typeData.name,
                    objectId: id,
                },
            });

            for (const partDef of data.parts) {
                const quantity = typeData.quantities?.[partDef.name] ?? 0;
                if (quantity > 0) {
                    await prisma.part.create({
                        data: {
                            name: partDef.name,
                            quantity,
                            typeId: type.id,
                        },
                    });
                }
            }
        }

        // Step 4 — Return updated record with nested parts
        return prisma.object.findUnique({
            where: { id },
            include: { types: { include: { parts: true } } },
        });
    });


    ipcMain.handle("objects:delete", async (_, id: number) => {
        await prisma.object.delete({ where: { id } });
        return true;
    });
}
