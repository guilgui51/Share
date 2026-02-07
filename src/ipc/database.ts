import {dialog, ipcMain} from "electron";
import {prisma} from "../../prisma";
import fs from "fs";

export type DatabaseIPC = {
    "db:export": () => Promise<boolean>;
    "db:import": () => Promise<boolean>;
};

async function exportAll() {
    const [users, objects, types, parts, typeParts, distributions, distributionUsers, distributionSelections, assignments] = await Promise.all([
        prisma.user.findMany(),
        prisma.object.findMany(),
        prisma.type.findMany(),
        prisma.part.findMany(),
        prisma.typePart.findMany(),
        prisma.distribution.findMany(),
        prisma.distributionUser.findMany(),
        prisma.distributionSelection.findMany(),
        prisma.assignment.findMany(),
    ]);

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {users, objects, types, parts, typeParts, distributions, distributionUsers, distributionSelections, assignments},
    };
}

async function importAll(dump: any) {
    const d = dump.data;

    // Clear everything in correct order (respecting FK constraints)
    await prisma.assignment.deleteMany();
    await prisma.distributionSelection.deleteMany();
    await prisma.distributionUser.deleteMany();
    await prisma.distribution.deleteMany();
    await prisma.typePart.deleteMany();
    await prisma.part.deleteMany();
    await prisma.type.deleteMany();
    await prisma.object.deleteMany();
    await prisma.user.deleteMany();

    // Re-insert in correct order
    if (d.users?.length) await prisma.user.createMany({data: d.users});
    if (d.objects?.length) await prisma.object.createMany({data: d.objects});
    if (d.types?.length) await prisma.type.createMany({data: d.types});
    if (d.parts?.length) await prisma.part.createMany({data: d.parts});
    if (d.typeParts?.length) await prisma.typePart.createMany({data: d.typeParts});
    if (d.distributions?.length) await prisma.distribution.createMany({data: d.distributions});
    if (d.distributionUsers?.length) await prisma.distributionUser.createMany({data: d.distributionUsers});
    if (d.distributionSelections?.length) await prisma.distributionSelection.createMany({data: d.distributionSelections});
    if (d.assignments?.length) await prisma.assignment.createMany({data: d.assignments});
}

export function registerDatabaseHandlers() {
    ipcMain.handle("db:export", async () => {
        const result = await dialog.showSaveDialog({
            title: "Exporter la base de données",
            defaultPath: `share-backup-${new Date().toISOString().slice(0, 10)}.json`,
            filters: [{name: "JSON", extensions: ["json"]}],
        });

        if (result.canceled || !result.filePath) return false;

        const dump = await exportAll();
        fs.writeFileSync(result.filePath, JSON.stringify(dump, null, 2), "utf-8");
        return true;
    });

    ipcMain.handle("db:import", async () => {
        const result = await dialog.showOpenDialog({
            title: "Importer une base de données",
            filters: [{name: "JSON", extensions: ["json"]}],
            properties: ["openFile"],
        });

        if (result.canceled || result.filePaths.length === 0) return false;

        const raw = fs.readFileSync(result.filePaths[0], "utf-8");
        const dump = JSON.parse(raw);

        if (!dump.data || !dump.version) {
            throw new Error("Fichier invalide : format de sauvegarde non reconnu.");
        }

        await importAll(dump);
        return true;
    });
}
