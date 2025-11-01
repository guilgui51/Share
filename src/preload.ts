import {contextBridge, ipcRenderer} from "electron";
import {IpcChannels} from "./ipc";

// Helper: build API dynamically from the IPCChannels type
function createApi<T extends Record<string, (...args: any[]) => any>>(channels: (keyof T)[]) {
    const api = {} as {
        [K in keyof T]: (...args: Parameters<T[K]>) => ReturnType<T[K]>;
    };

    for (const channel of channels) {
        api[channel] = ((...args: any[]) => ipcRenderer.invoke(channel as string, ...args)) as any;
    }
    return api;
}

// List all channels you want to expose
const channels: (keyof IpcChannels)[]= [
    "app:exit",
    "users:getAll",
    "users:add",
    "users:edit",
    "users:delete",
    "objects:getAll",
    "objects:add",
    "objects:edit",
    "objects:delete",
    "distributions:getAll",
    "distributions:create",
    "distributions:cancel",
    "settings:get",
    "settings:update",
];

const api = createApi<IpcChannels>(channels);

contextBridge.exposeInMainWorld("api", api);