import {ipcMain} from "electron";
import {prisma} from "../../prisma";

export type UsersIpcs = {
    "users:getAll": () => Promise<User[]>;
    "users:add": (data: UserFormData) => Promise<User>;
    "users:edit": (id: number, data: UserFormData) => Promise<User>;
    "users:delete": (id: number) => Promise<boolean>;
}

export function registerUserHandlers() {
    ipcMain.handle("users:getAll", async () => {
        return prisma.user.findMany({ orderBy: { id: "asc" } });
    });

    ipcMain.handle("users:add", async (_, data: UserFormData) => {
        return prisma.user.create({ data });
    });

    ipcMain.handle("users:edit", async (_, id: number, data: UserFormData) => {
        return prisma.user.update({ where: { id }, data });
    });

    ipcMain.handle("users:delete", async (_, id: number) => {
        await prisma.user.delete({ where: { id } });
        return true;
    });
}