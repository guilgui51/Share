// electron/ipc/distributions.ts
import {ipcMain} from "electron";
import {prisma} from "../../prisma";
import {loadSettings} from "../settings";

export type DistributionsIPC = {
    "distributions:getAll": () => Promise<any[]>;
    "distributions:create": (payload: DistributionCreatePayload) => Promise<any>;
    "distributions:cancel": (id: number) => Promise<boolean>;
}

// Global cache of user -> part -> quantity (for fairness decisions)
type UserPartTotals = Record<number, Record<number, number>>;

/**
 * Load existing part totals for all participants.
 * Includes every previous distribution.
 */
async function buildUserPartTotals(userIds: number[]): Promise<UserPartTotals> {
    const assignments = await prisma.assignment.groupBy({
        by: ["userId", "partId"],
        _sum: { quantity: true },
        where: { userId: { in: userIds } },
    });

    const totals: UserPartTotals = {};
    for (const a of assignments) {
        if (!totals[a.userId]) totals[a.userId] = {};
        totals[a.userId][a.partId] = a._sum.quantity || 0;
    }

    // ensure all users are present
    for (const id of userIds) if (!totals[id]) totals[id] = {};
    return totals;
}

// ---------- REGISTER ----------
export function registerDistributionHandlers() {
    // LIST (most recent first)
    ipcMain.handle("distributions:getAll", async () => {
        return prisma.distribution.findMany({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: {
                participants: { include: { user: true } },
                selections: {
                    include: {
                        type: { include: { object: true } },
                    },
                },
                assignments: {
                    include: {
                        user: true,
                        part: {
                            include: {
                                type: { include: { object: true } },
                            },
                        },
                    },
                },
            },
        });
    });

    // CREATE + SIMPLE ALGO
    ipcMain.handle("distributions:create", async (_e, payload: DistributionCreatePayload) => {
        const settings = loadSettings(); // global algorithm settings
        const { name, participantIds, selections } = payload;

        // 1️⃣ Create base distribution
        const distribution = await prisma.distribution.create({
            data: {
                name,
                participants: {
                    create: participantIds.map((id: number) => ({ userId: id })),
                },
                selections: {
                    create: selections.map((s) => ({
                        typeId: s.typeId,
                        count: s.count,
                    })),
                },
            },
        });

        // 2️⃣ Load participants + parts
        const participants = await prisma.user.findMany({
            where: { id: { in: participantIds } },
            include: { assignments: true },
        });

        const selectedTypes = await prisma.type.findMany({
            where: { id: { in: selections.map((s) => s.typeId) } },
            include: { parts: true },
        });

        // Flatten list of all parts to distribute
        const allParts: { partId: number; quantity: number }[] = [];
        for (const sel of selections) {
            const type = selectedTypes.find((t) => t.id === sel.typeId);
            if (!type) continue;
            for (const part of type.parts) {
                for (let i = 0; i < sel.count * part.quantity; i++) {
                    allParts.push({ partId: part.id, quantity: 1 });
                }
            }
        }

        // 3️⃣ Distribute parts using selected algorithm
        await distributeParts({
            distributionId: distribution.id,
            participants,
            partsPool: allParts,
            settings,
        });

        // 4️⃣ Return updated distribution
        return prisma.distribution.findUnique({
            where: { id: distribution.id },
            include: {
                participants: { include: { user: true } },
                selections: { include: { type: { include: { object: true } } } },
                assignments: {
                    include: {
                        user: true,
                        part: { include: { type: { include: { object: true } } } },
                    },
                },
            },
        });
    });

    // CANCEL
    ipcMain.handle("distributions:cancel", async (_e, id: number) => {
        await prisma.distribution.delete({ where: { id } });
        return true;
    });
}


interface DistributeParams {
    distributionId: number;
    participants: any[];
    partsPool: { partId: number; quantity: number }[];
    settings: AppSettings;
}

async function distributeParts({
                                   distributionId,
                                   participants,
                                   partsPool,
                                   settings,
                               }: DistributeParams) {
    const { algorithmType, algorithmCount } = settings;

    const userIds = participants.map((p) => p.id);
    const userPartTotals = await buildUserPartTotals(userIds);

    switch (algorithmType) {
        case "random":
            await algoRandom(distributionId, participants, partsPool);
            break;
        case "less":
            await algoLess(distributionId, participants, partsPool, userPartTotals);
            break;
        case "share_less":
            await algoShare(distributionId, participants, partsPool, algorithmCount, "less", userPartTotals);
            break;
        case "share_random":
            await algoShare(distributionId, participants, partsPool, algorithmCount, "random", userPartTotals);
            break;
    }
}


/* ---------------------------------------------------------------------- */
/* 🔀 RANDOM — assign parts randomly */
/* ---------------------------------------------------------------------- */
async function algoRandom(distributionId: number, participants: any[], partsPool: any[]) {
    for (const part of partsPool) {
        const randomUser = participants[Math.floor(Math.random() * participants.length)];
        await createAssignment(distributionId, randomUser.id, part.partId);
    }
}

/* ---------------------------------------------------------------------- */
/* 📉 LESS — give to users with fewest total parts first */
/* ---------------------------------------------------------------------- */
async function algoLess(
    distributionId: number,
    participants: { id: number }[],
    partsPool: { partId: number }[],
    userPartTotals: UserPartTotals
) {
    // 1) Load total quantity per user across ALL past distributions (fairness)
    const userTotals = await getUserPartTotals(participants.map((p) => p.id));

    // 2) Work on a local copy of the pool
    const remaining = [...partsPool];

    // 3) While there are parts, always pick the least-loaded user first
    while (remaining.length > 0) {
        // user with the fewest total parts so far
        const targetUserId = Number(
            Object.entries(userTotals).sort((a, b) => a[1] - b[1])[0][0]
        );

        // choose the best part for that user from the remaining pool
        const { partId, index } = pickPreferredPart(remaining, targetUserId, userPartTotals);

        // assign it
        await createAssignment(distributionId, targetUserId, partId);

        // update in-memory counts
        userTotals[targetUserId] = (userTotals[targetUserId] || 0) + 1;
        remaining.splice(index, 1);
    }
}

/* ---------------------------------------------------------------------- */
/* 🤝 SHARE_LESS / SHARE_RANDOM — hybrid logic */
/* ---------------------------------------------------------------------- */
async function algoShare(
    distributionId: number,
    participants: any[],
    partsPool: any[],
    count: number,
    fallback: "less" | "random",
    userPartTotals: UserPartTotals
) {
    let remainingParts = [...partsPool];
    const totalUsers = participants.length;

    // Determine how many full share rounds we can do
    const possibleRounds = Math.floor(remainingParts.length / totalUsers);
    const maxRounds =
        count === 0 || count >= 9999
            ? possibleRounds // share as much as possible
            : Math.min(count, possibleRounds);

    // SHARE PHASE
    for (let round = 0; round < maxRounds; round++) {
        for (const user of participants) {
            if (remainingParts.length === 0) break;

            // pick a preferred part for this user
            const nextPart = pickPreferredPart(remainingParts, user.id, userPartTotals);
            await createAssignment(distributionId, user.id, nextPart.partId);

            // remove that part from pool
            remainingParts.splice(nextPart.index, 1);
        }
    }

    // FALLBACK PHASE
    if (remainingParts.length > 0) {
        if (fallback === "less")
            await algoLess(distributionId, participants, remainingParts, userPartTotals);
        else await algoRandom(distributionId, participants, remainingParts);
    }
}

/* ---------------------------------------------------------------------- */
/* 🧩 Utility helpers */
/* ---------------------------------------------------------------------- */

/**
 * Pick the best next part for a user.
 * Tries to prefer parts the user has never received, then least-owned.
 */
function pickPreferredPart(
    partsPool: { partId: number }[],
    userId: number,
    userPartTotals: UserPartTotals
): { partId: number; index: number } {
    const userTotals = userPartTotals[userId] || {};

    // 1️⃣ Collect all unique part IDs in pool
    const availablePartIds = [...new Set(partsPool.map((p) => p.partId))];

    // 2️⃣ Separate unseen vs seen parts
    const unseen = availablePartIds.filter((pid) => !userTotals[pid]);
    if (unseen.length > 0) {
        // pick first unseen part from pool
        const pid = unseen[0];
        const index = partsPool.findIndex((p) => p.partId === pid);
        userPartTotals[userId][pid] = (userPartTotals[userId][pid] || 0) + 1;
        return { partId: pid, index };
    }

    // 3️⃣ If all parts are seen, pick the one with the least owned quantity
    let bestPartId = availablePartIds[0];
    let bestQty = userTotals[bestPartId] ?? 0;
    for (const pid of availablePartIds) {
        const qty = userTotals[pid] ?? 0;
        if (qty < bestQty) {
            bestQty = qty;
            bestPartId = pid;
        }
    }

    const index = partsPool.findIndex((p) => p.partId === bestPartId);
    userPartTotals[userId][bestPartId] = (userPartTotals[userId][bestPartId] || 0) + 1;

    return { partId: bestPartId, index };
}

// get user totals (sum of all quantities from previous distributions)
async function getUserPartTotals(userIds: number[]): Promise<Record<number, number>> {
    const assignments = await prisma.assignment.groupBy({
        by: ["userId"],
        _sum: { quantity: true },
        where: { userId: { in: userIds } },
    });

    const totals: Record<number, number> = {};
    for (const a of assignments) totals[a.userId] = a._sum.quantity || 0;
    for (const id of userIds) if (!(id in totals)) totals[id] = 0;
    return totals;
}

// Upsert assignment (increment if already exists)
async function createAssignment(distributionId: number, userId: number, partId: number) {
    const existing = await prisma.assignment.findFirst({
        where: { userId, partId, distributionId },
    });

    if (existing) {
        await prisma.assignment.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + 1 },
        });
    } else {
        await prisma.assignment.create({
            data: { userId, partId, distributionId, quantity: 1 },
        });
    }
}