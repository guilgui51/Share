// electron/ipc/distributions.ts
import {ipcMain} from "electron";
import {prisma} from "../../prisma";
import {loadSettings} from "../settings";

export type DistributionsIPC = {
    "distributions:getAll": () => Promise<any[]>;
    "distributions:create": (payload: DistributionCreatePayload) => Promise<any>;
    "distributions:cancel": (id: number) => Promise<boolean>;
};

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
                            include: { object: true },
                        },
                        type: {
                            include: { object: true },
                        },
                    },
                },
            },
        });
    });

    // CREATE + SIMPLE ALGO
    ipcMain.handle(
        "distributions:create",
        async (_e, payload: DistributionCreatePayload) => {
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

            // 2️⃣ Load participants + parts via typeParts
            const participants = await prisma.user.findMany({
                where: { id: { in: participantIds } },
                include: { assignments: true },
            });

            const selectedTypes = await prisma.type.findMany({
                where: { id: { in: selections.map((s) => s.typeId) } },
                include: { typeParts: { include: { part: true } } },
            });

            // Flatten list of all parts to distribute (now with typeId)
            const allParts: { partId: number; typeId: number; quantity: number }[] = [];
            for (const sel of selections) {
                const type = selectedTypes.find((t) => t.id === sel.typeId);
                if (!type) continue;
                for (const tp of type.typeParts) {
                    for (let i = 0; i < sel.count * tp.quantity; i++) {
                        allParts.push({ partId: tp.partId, typeId: type.id, quantity: 1 });
                    }
                }
            }

            // 3️⃣ Distribute parts using selected algorithm (now 3-phase: plan → prefs → optimize)
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
                            part: { include: { object: true } },
                            type: { include: { object: true } },
                        },
                    },
                },
            });
        }
    );

    // CANCEL
    ipcMain.handle("distributions:cancel", async (_e, id: number) => {
        await prisma.distribution.delete({ where: { id } });
        return true;
    });
}

interface DistributeParams {
    distributionId: number;
    participants: any[];
    partsPool: { partId: number; typeId: number; quantity: number }[];
    settings: AppSettings;
}

/** ---------- NEW: planning + preferences + optimization orchestration ---------- */
async function distributeParts({
                                   distributionId,
                                   participants,
                                   partsPool,
                                   settings,
                               }: DistributeParams) {
    const { algorithmType, algorithmCount } = settings;

    const userIds = participants.map((p) => p.id);
    // historical totals per (user, partId)
    const userPartTotals = await buildUserPartTotals(userIds);

    // 1) PLAN how many items each participant should receive
    let plan: Record<number, number> = {};
    switch (algorithmType) {
        case "random":
            plan = buildPlanRandom(participants, partsPool.length);
            break;
        case "less":
            plan = await buildPlanLess(participants, partsPool.length);
            break;
        case "share_less":
            plan = await buildPlanShare(
                participants,
                partsPool.length,
                algorithmCount,
                "less"
            );
            break;
        case "share_random":
            plan = await buildPlanShare(
                participants,
                partsPool.length,
                algorithmCount,
                "random"
            );
            break;
    }

    // 2) Build per-user part preferences (how many of each partId they already own)
    const userPreferences = buildUserPreferences(userIds, userPartTotals, partsPool);

    // 3) Optimize actual assignments based on plan + preferences
    await optimizeDistribution(distributionId, partsPool, plan, userPreferences);
}

/* ---------------------------------------------------------------------- */
/* 🔀 RANDOM — assign parts randomly (NOW: build plan only)               */
/* ---------------------------------------------------------------------- */
function buildPlanRandom(
    participants: { id: number }[],
    totalParts: number
): Record<number, number> {
    const plan: Record<number, number> = {};
    for (const u of participants) plan[u.id] = 0;

    for (let i = 0; i < totalParts; i++) {
        const rnd = Math.floor(Math.random() * participants.length);
        const userId = participants[rnd].id;
        plan[userId] += 1;
    }
    return plan;
}

/* ---------------------------------------------------------------------- */
/* 📉 LESS — give to users with fewest total parts first (NOW: build plan)*/
/* ---------------------------------------------------------------------- */
async function buildPlanLess(
    participants: { id: number }[],
    totalParts: number,
    basePlan: Record<number, number> = {}
): Promise<Record<number, number>> {
    const plan: Record<number, number> = {};
    for (const u of participants) plan[u.id] = 0;

    // Base totals across ALL time (historical fairness)
    const baseTotals = await getUserPartTotals(participants.map((p) => p.id));

    // Combine historical totals + already distributed parts (but do not add to plan)
    const runningTotals: Record<number, number> = {};
    for (const u of participants) {
        runningTotals[u.id] = (baseTotals[u.id] || 0) + (basePlan[u.id] || 0);
    }

    // Repeatedly give next unit to currently least-loaded user
    for (let i = 0; i < totalParts; i++) {
        const targetUserId = Number(
            Object.entries(runningTotals).sort((a, b) => a[1] - b[1])[0][0]
        );
        plan[targetUserId] += 1;
        runningTotals[targetUserId] += 1;
    }

    return plan;
}

/* ---------------------------------------------------------------------- */
/* 🤝 SHARE_LESS / SHARE_RANDOM — hybrid (NOW: build plan)                */
/* ---------------------------------------------------------------------- */
async function buildPlanShare(
    participants: { id: number }[],
    totalParts: number,
    count: number,
    fallback: "less" | "random"
): Promise<Record<number, number>> {
    const plan: Record<number, number> = {};
    for (const u of participants) plan[u.id] = 0;

    const totalUsers = participants.length;

    // how many full "everyone gets one" rounds are feasible
    const possibleRounds = Math.floor(totalParts / totalUsers);
    const maxRounds =
        count === 0
            ? possibleRounds // share as much as possible
            : Math.min(count, possibleRounds);

    // share phase
    for (let r = 0; r < maxRounds; r++) {
        for (const u of participants) plan[u.id] += 1;
    }

    // leftover units
    const used = maxRounds * totalUsers;
    const remaining = totalParts - used;
    if (remaining <= 0) return plan;

    // FALLBACK PHASE — delegate to existing plan builders
    let fallbackPlan: Record<number, number> = {};
    if (fallback === "less") {
        fallbackPlan = await buildPlanLess(participants, remaining, plan);
    } else {
        fallbackPlan = buildPlanRandom(participants, remaining);
    }

    // Merge fallback allocation into current plan
    for (const id of Object.keys(fallbackPlan)) {
        plan[Number(id)] += fallbackPlan[Number(id)];
    }

    return plan;
}

/* ---------------------------------------------------------------------- */
/* 🧩 Utilities: preferences + optimizer                                   */
/* ---------------------------------------------------------------------- */

// Build per-user preference map: for each user, a partId->ownedCount map.
// Start from historical totals and ensure every available partId is present with default 0.
function buildUserPreferences(
    userIds: number[],
    userPartTotals: UserPartTotals,
    partsPool: { partId: number }[]
): Record<number, Record<number, number>> {
    // all available partIds in this run
    const availablePartIds = [...new Set(partsPool.map((p) => p.partId))];

    const prefs: Record<number, Record<number, number>> = {};
    for (const uid of userIds) {
        const base = { ...(userPartTotals[uid] || {}) };
        for (const pid of availablePartIds) {
            if (base[pid] === undefined) base[pid] = 0;
        }
        prefs[uid] = base;
    }
    return prefs;
}

// Assign parts to match the requested plan, using preferences to pick the least-owned partId each time.
// Writes assignments incrementally (same behavior as your current code).
async function optimizeDistribution(
    distributionId: number,
    partsPool: { partId: number; typeId: number }[],
    plan: Record<number, number>,
    userPreferences: Record<number, Record<number, number>>
) {
    // build availability counts per partId, tracking typeId for each unit
    const availableUnits: { partId: number; typeId: number }[] = [...partsPool];

    // helper: pick best available partId for a user (min preference count)
    const pickBestPartForUser = (userId: number): { partId: number; typeId: number; index: number } | null => {
        const prefs = userPreferences[userId];
        if (availableUnits.length === 0) return null;

        // Find the unit with the lowest preference score
        let bestIdx = 0;
        let bestScore = prefs[availableUnits[0].partId] ?? 0;

        for (let i = 1; i < availableUnits.length; i++) {
            const score = prefs[availableUnits[i].partId] ?? 0;
            if (score < bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        return { ...availableUnits[bestIdx], index: bestIdx };
    };

    // iterate users; for each, assign as many as plan dictates
    const userIds = Object.keys(plan).map(Number);

    // To avoid always favoring early users on ties, we can shuffle the iteration order per "round"
    const maxGive = Math.max(...userIds.map((uid) => plan[uid] || 0));
    for (let step = 0; step < maxGive; step++) {
        for (const uid of userIds) {
            if ((plan[uid] || 0) <= 0) continue;

            // Give one unit this pass
            const pick = pickBestPartForUser(uid);
            if (pick == null) continue;

            // write incrementally
            await createAssignment(distributionId, uid, pick.partId, pick.typeId);

            // update live state
            availableUnits.splice(pick.index, 1);
            userPreferences[uid][pick.partId] = (userPreferences[uid][pick.partId] || 0) + 1;
            plan[uid] -= 1;
        }
    }
}

/* ---------------------------------------------------------------------- */
/* 🧮 Totals + incremental write                                          */
/* ---------------------------------------------------------------------- */

// get user totals (sum of all quantities from previous distributions)
async function getUserPartTotals(
    userIds: number[]
): Promise<Record<number, number>> {
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
async function createAssignment(
    distributionId: number,
    userId: number,
    partId: number,
    typeId: number
) {
    const existing = await prisma.assignment.findFirst({
        where: { userId, partId, typeId, distributionId },
    });

    if (existing) {
        await prisma.assignment.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + 1 },
        });
    } else {
        await prisma.assignment.create({
            data: { userId, partId, typeId, distributionId, quantity: 1 },
        });
    }
}
