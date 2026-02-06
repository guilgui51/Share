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
                parts: true,
                types: {
                    include: {
                        typeParts: { include: { part: true } },
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

        // Step 2 — Create all object-level parts
        const partRecords: Record<string, number> = {};
        for (const partDef of data.parts) {
            const part = await prisma.part.create({
                data: {
                    name: partDef.name,
                    objectId: createdObject.id,
                },
            });
            partRecords[partDef.name] = part.id;
        }

        // Step 3 — Create types and TypePart join records
        for (const typeData of data.types) {
            const type = await prisma.type.create({
                data: {
                    name: typeData.name,
                    objectId: createdObject.id,
                },
            });

            for (const partDef of data.parts) {
                const quantity = typeData.quantities?.[partDef.name] ?? 0;
                if (quantity > 0) {
                    await prisma.typePart.create({
                        data: {
                            typeId: type.id,
                            partId: partRecords[partDef.name],
                            quantity,
                        },
                    });
                }
            }
        }

        // Return the fully populated object
        return prisma.object.findUnique({
            where: { id: createdObject.id },
            include: {
                parts: true,
                types: { include: { typeParts: { include: { part: true } } } },
            },
        });
    });

    ipcMain.handle("objects:edit", async (_, id: number, data: ObjectFormData) => {
        // Step 1 — Update base object name
        await prisma.object.update({
            where: { id },
            data: { name: data.name },
        });

        // Step 2 — Delete old types (cascades TypePart) and old parts
        await prisma.type.deleteMany({ where: { objectId: id } });
        await prisma.part.deleteMany({ where: { objectId: id } });

        // Step 3 — Recreate parts at object level
        const partRecords: Record<string, number> = {};
        for (const partDef of data.parts) {
            const part = await prisma.part.create({
                data: {
                    name: partDef.name,
                    objectId: id,
                },
            });
            partRecords[partDef.name] = part.id;
        }

        // Step 4 — Recreate types and TypePart join records
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
                    await prisma.typePart.create({
                        data: {
                            typeId: type.id,
                            partId: partRecords[partDef.name],
                            quantity,
                        },
                    });
                }
            }
        }

        // Step 5 — Return updated record
        return prisma.object.findUnique({
            where: { id },
            include: {
                parts: true,
                types: { include: { typeParts: { include: { part: true } } } },
            },
        });
    });


    ipcMain.handle("objects:delete", async (_, id: number) => {
        await prisma.object.delete({ where: { id } });
        return true;
    });
}
