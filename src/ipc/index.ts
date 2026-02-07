import {registerUserHandlers, UsersIpcs} from "./users";
import {ObjectsIpcs, registerObjectHandlers} from "./objects";
import {DistributionsIPC, registerDistributionHandlers} from "./distributions";
import {registerSettingsHandlers, SettingsIPC} from "./settings";
import {AppIpcs, registerAppHandlers} from "./app";
import {DatabaseIPC, registerDatabaseHandlers} from "./database";

export type IpcChannels = AppIpcs & UsersIpcs & ObjectsIpcs & DistributionsIPC & SettingsIPC & DatabaseIPC;

export function registerAllIpcHandlers() {
    registerAppHandlers();
    registerUserHandlers();
    registerObjectHandlers();
    registerDistributionHandlers();
    registerSettingsHandlers();
    registerDatabaseHandlers();
}