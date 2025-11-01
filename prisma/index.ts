import {PrismaClient} from "@prisma/client";
import {app} from "electron";
import fs from "fs";
import path, {join} from "path";

export const isDev = process.env.NODE_ENV === "development";


const dbPath = isDev ? "./dev.db" : path.join(app.getPath("userData"), "app.db");


if (!isDev) {
    try {
        // database file does not exist, need to create
        fs.copyFileSync(join(process.resourcesPath, 'app.db'), dbPath, fs.constants.COPYFILE_EXCL);
        console.log("New database file created")
    } catch (err) {
        if (err.code != "EEXIST") {
            console.error(`Failed creating sqlite file.`, err);
        } else {
            console.log("Database file detected");
        }
    }
}


export const prisma = new PrismaClient({
    log: ['info', 'warn', 'error',
        //     {
        //     emit: "event",
        //     level: "query",
        // },
    ],
    datasources: {
        db: {
            url: `file:${dbPath}`,
        },
    },
});


console.log(`Is Production?: ${!isDev}`)