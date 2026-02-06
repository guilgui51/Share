/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import {IpcChannels} from "./src/ipc";

export {};

declare module "*.png" {
    const value: string;
    export default value;
}

declare global {
    interface User {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        createdAt: string; // ISO date string (for frontend serialization)
    }

    interface UserFormData {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    }

    interface ObjectFormData {
        name: string;
        parts: { name: string }[];
        types: {
            name: string;
            quantities: Record<string, number>;
        }[];
    }

    interface DistributionCreatePayload {
        name: string;
        participantIds: number[];
        selections: { typeId: number; count: number }[];
    }

    export interface AppSettings {
        algorithmType: "less" | "random" | "share_less" | "share_random";
        algorithmCount: number;
    }

    interface DistributionCardDTO {
        id: number;
        name: string;
        date: string;        // ISO for frontend
        createdAt: string;   // ISO
        participants: { user: User }[];
        selections: { type: { id: number; name: string; object: { id: number; name: string } }, count: number }[];
        assignments: {
            user: User;
            quantity: number;
            part: {
                id: number;
                name: string;
                object: { id: number; name: string };
            };
            type: { id: number; name: string; object: { id: number; name: string } };
        }[];
    }

    interface Window {
        api: {
            [K in keyof IpcChannels]: (
                ...args: Parameters<IpcChannels[K]>
            ) => ReturnType<IpcChannels[K]>;
        };
    }
}
