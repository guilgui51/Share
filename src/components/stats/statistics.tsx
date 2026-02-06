import {useEffect, useMemo, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faBalanceScale, faClockRotateLeft, faGift, faUser,} from "@fortawesome/free-solid-svg-icons";
import {CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,} from "recharts";

export default function Statistics() {
    const [users, setUsers] = useState<User[]>([]);
    const [distributions, setDistributions] = useState<DistributionCardDTO[]>([]);
    const [loading, setLoading] = useState(true);

    const USER_COLORS = [
        "#22c55e", "#84cc16", "#06b6d4", "#a855f7", "#f97316",
        "#eab308", "#ec4899", "#3b82f6", "#14b8a6", "#8b5cf6",
    ];

    const userColorMap = useMemo(() => {
        const map: Record<number, string> = {};
        users.forEach((u, i) => {
            map[u.id] = USER_COLORS[i % USER_COLORS.length];
        });
        return map;
    }, [users]);

    useEffect(() => {
        (async () => {
            const [us, dist] = await Promise.all([
                window.api["users:getAll"](),
                window.api["distributions:getAll"](),
            ]);
            setUsers(us);
            setDistributions(dist);
            setLoading(false);
        })();
    }, []);

    // --- Données globales ---
    const summary = useMemo(() => {
        const totalDistributions = distributions.length;
        const totalParts = distributions.reduce(
            (sum, d) => sum + d.assignments.reduce((acc, a) => acc + a.quantity, 0),
            0
        );
        const uniqueUsers = new Set(
            distributions.flatMap((d) => d.participants.map((p) => p.user.id))
        ).size;

        return { totalDistributions, totalParts, uniqueUsers };
    }, [distributions]);

    // --- Indice d’équité globale ---
    const equityIndex = useMemo(() => {
        const userTotals = users.map((u) =>
            distributions.reduce((acc, d) => {
                const parts = d.assignments
                    .filter((a) => a.user.id === u.id)
                    .reduce((sum, a) => sum + a.quantity, 0);
                return acc + parts;
            }, 0)
        );

        const mean =
            userTotals.length > 0
                ? userTotals.reduce((a, b) => a + b, 0) / userTotals.length
                : 0;
        const variance =
            userTotals.length > 0
                ? userTotals.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
                userTotals.length
                : 0;
        const stdDev = Math.sqrt(variance);
        const index = mean > 0 ? 100 - (stdDev / mean) * 100 : 100;

        return Math.max(0, Math.min(100, parseFloat(index.toFixed(1))));
    }, [users, distributions]);

    // --- Statistiques par participant ---
    const perUser = useMemo(() => {
        const totalPartsAll = distributions.reduce(
            (sum, d) => sum + d.assignments.reduce((acc, a) => acc + a.quantity, 0),
            0
        );

        return users.map((u) => {
            const distParticipated = distributions.filter((d) =>
                d.participants.some((p) => p.user.id === u.id)
            );
            const distWithParts = distParticipated.filter((d) =>
                d.assignments.some((a) => a.user.id === u.id)
            );

            const totalParts = distWithParts.reduce((acc, d) => {
                const parts = d.assignments
                    .filter((a) => a.user.id === u.id)
                    .reduce((sum, a) => sum + a.quantity, 0);
                return acc + parts;
            }, 0);

            const participationRate = distributions.length
                ? (distParticipated.length / distributions.length) * 100
                : 0;

            const partPercent = totalPartsAll
                ? (totalParts / totalPartsAll) * 100
                : 0;

            return {
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
                totalParts,
                participated: distParticipated.length,
                partPercent: partPercent.toFixed(1),
                participationRate: participationRate.toFixed(1),
            };
        });
    }, [users, distributions]);

    // --- Couleurs réutilisées ---
    const BASE_COLORS = [
        "#22c55e", "#06b6d4", "#a855f7", "#f97316", "#ec4899",
        "#eab308", "#3b82f6", "#14b8a6", "#8b5cf6", "#84cc16",
    ];

    // --- Camembert : répartition par participant ---
    const sharePie = useMemo(() => {
        const map = new Map<string, number>();
        distributions.forEach((d) =>
            d.assignments.forEach((a) => {
                const key = `${a.user.firstName} ${a.user.lastName}`;
                map.set(key, (map.get(key) || 0) + a.quantity);
            })
        );
        return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }, [distributions]);

    // --- Camembert : répartition par type d’objet (avec objet parent + couleur proche) ---
    const typePie = useMemo(() => {
        const map = new Map<string, { value: number; object: string }>();
        const objectTotals = new Map<string, number>();

        distributions.forEach((d) =>
            d.assignments.forEach((a) => {
                const objectName = a.part.object.name;
                const typeName = a.type.name;
                const key = `${objectName} / ${typeName}`;

                map.set(key, {
                    value: (map.get(key)?.value || 0) + a.quantity,
                    object: objectName,
                });
                objectTotals.set(
                    objectName,
                    (objectTotals.get(objectName) || 0) + a.quantity
                );
            })
        );

        const objects = Array.from(objectTotals.keys());
        const baseColors: Record<string, string> = {};
        const BASE_COLORS = [
            "#22c55e", "#06b6d4", "#a855f7", "#f97316", "#ec4899",
            "#eab308", "#3b82f6", "#14b8a6", "#8b5cf6", "#84cc16",
        ];

        // assign one color per object
        objects.forEach((obj, i) => {
            baseColors[obj] = BASE_COLORS[i % BASE_COLORS.length];
        });

        const colorByKey: Record<string, string> = {};
        objects.forEach((object, i) => {
            const baseColor = baseColors[object];
            const related = Array.from(map.entries()).filter(([_, v]) => v.object === object);
            related.forEach(([key], j) => {
                const factor = 0.8 + (j / related.length) * 0.4;
                colorByKey[key] = adjustColorBrightness(baseColor, factor);
            });
        });

        return {
            data: Array.from(map.entries()).map(([name, { value }]) => ({
                name,
                value,
            })),
            objectsData: Array.from(objectTotals.entries()).map(([name, value]) => ({
                name,
                value,
            })),
            colors: colorByKey,
            baseColors,
        };
    }, [distributions]);

    // --- Fonction utilitaire pour assombrir/éclaircir une couleur hex ---
    function adjustColorBrightness(hex: string, factor: number) {
        const [r, g, b] = hex
            .match(/\w\w/g)!
            .map((x) => Math.min(255, Math.max(0, parseInt(x, 16) * factor)));
        return `rgb(${r},${g},${b})`;
    }

    // --- Évolution cumulée des parts reçues ---
    const cumulativePartsData = useMemo(() => {
        if (distributions.length === 0) return [];

        const sorted = [...distributions].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const userIds = users.map((u) => u.id);
        const cumulative: Record<number, number> = {};
        userIds.forEach((id) => (cumulative[id] = 0));

        const data: any[] = [];

        sorted.forEach((dist) => {
            dist.assignments.forEach((a) => {
                cumulative[a.user.id] += a.quantity;
            });

            const label = `${new Date(dist.createdAt).toLocaleDateString("fr-FR")} - ${
                dist.name
            }`;

            const entry: Record<string, number | string | boolean> = {
                distribution: label,
            };

            userIds.forEach((id) => {
                entry[id] = cumulative[id];
                entry[`p_${id}`] = dist.participants.some((p) => p.user.id === id);
            });

            data.push(entry);
        });

        return data;
    }, [users, distributions]);

    // --- Heatmap par part : répartition par objet/part/utilisateur ---
    const perPartData = useMemo(() => {
        // Map<objectName, Map<partName, Map<userId, totalQty>>>
        const objectMap = new Map<string, Map<string, Map<number, number>>>();
        const involvedUserIds = new Set<number>();

        distributions.forEach((d) =>
            d.assignments.forEach((a) => {
                const objName = a.part.object.name;
                const partName = a.part.name;
                const userId = a.user.id;
                involvedUserIds.add(userId);

                if (!objectMap.has(objName)) objectMap.set(objName, new Map());
                const parts = objectMap.get(objName)!;
                if (!parts.has(partName)) parts.set(partName, new Map());
                const userMap = parts.get(partName)!;
                userMap.set(userId, (userMap.get(userId) || 0) + a.quantity);
            })
        );

        const involvedUsers = users.filter((u) => involvedUserIds.has(u.id));

        return { objectMap, involvedUsers };
    }, [users, distributions]);

    if (loading)
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Chargement des statistiques...
            </div>
        );

    return (
        <div className="flex flex-col p-6 space-y-6 overflow-y-auto">
            <h1 className="text-2xl font-semibold mb-2">Statistiques</h1>

            {/* Cartes de résumé */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    icon={faClockRotateLeft}
                    label="Distributions totales"
                    value={summary.totalDistributions}
                />
                <StatCard icon={faGift} label="Parts distribuées" value={summary.totalParts} />
                <StatCard
                    icon={faUser}
                    label="Participants uniques"
                    value={summary.uniqueUsers}
                />
                <StatCard
                    icon={faBalanceScale}
                    label="Indice d’équité"
                    value={`${equityIndex}%`}
                />
            </div>

            {/* Double camembert */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Répartition par participant */}
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200">
                        Répartition totale des parts reçues
                    </h3>

                    {sharePie.length > 0 ? (
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height={250} style={{overflow: "visible"}}>
                                <PieChart>
                                    <Pie
                                        data={sharePie}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius="70%"   // smaller so labels have room
                                        paddingAngle={1}    // tiny gap, looks cleaner
                                        label
                                    >
                                        {sharePie.map((_, i) => (
                                            <Cell key={i} fill={userColorMap[users[i]?.id] || USER_COLORS[i % USER_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Legend />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#1f2937",
                                            border: "1px solid #374151",
                                            color: "#fff",
                                        }}
                                        itemStyle={{
                                            color: "#f9fafb",
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Aucune donnée disponible</p>
                    )}
                </div>

                {/* Répartition par type (double-niveau : objet + type) */}
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200">
                        Répartition des objets et types
                    </h3>

                    {typePie.data.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart margin={{ top: 30, right: 40, bottom: 30, left: 40 }}>
                                {/* Cercle interne → Objets principaux */}
                                <Pie
                                    data={typePie.objectsData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="30%"
                                    outerRadius="50%"
                                    paddingAngle={1}
                                >
                                    {typePie.objectsData.map((obj, i) => (
                                        <Cell key={i} fill={typePie.baseColors[obj.name]} />
                                    ))}
                                </Pie>

                                {/* Cercle externe → Types par objet */}
                                <Pie
                                    data={typePie.data}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="55%"
                                    outerRadius="75%"
                                    paddingAngle={1}
                                    label={({ value }) => `${value}`}
                                >
                                    {typePie.data.map((t, i) => (
                                        <Cell key={i} fill={typePie.colors[t.name]} />
                                    ))}
                                </Pie>

                                <Legend
                                    wrapperStyle={{
                                        fontSize: 12,
                                        color: "#9ca3af",
                                        paddingTop: "1rem",
                                    }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#111827",
                                        border: "1px solid #374151",
                                        color: "#f9fafb",
                                    }}
                                    itemStyle={{
                                        color: "#f9fafb",
                                    }}
                                    labelStyle={{
                                        color: "#9ca3af",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-gray-500">Aucune donnée disponible</p>
                    )}
                </div>
            </div>

            {/* Évolution cumulée des parts reçues */}
            <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                <h3 className="text-lg font-semibold mb-4 text-gray-200">
                    Évolution cumulée des parts reçues
                </h3>
                {cumulativePartsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={cumulativePartsData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis
                                dataKey="distribution"
                                stroke="#9ca3af"
                                tick={{ fontSize: 10 }}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#1f2937",
                                    border: "1px solid #374151",
                                    color: "#fff",
                                }}
                            />
                            <Legend />
                            {users.map((u, i) => (
                                <Line
                                    key={u.id}
                                    type="monotone"
                                    dataKey={u.id.toString()}
                                    name={`${u.firstName} ${u.lastName}`}
                                    stroke={BASE_COLORS[i % BASE_COLORS.length]}
                                    strokeWidth={2}
                                    dot={(props) => {
                                        const participated = props.payload[`p_${u.id}`];
                                        if (!participated) return null;
                                        return (
                                            <circle
                                                cx={props.cx}
                                                cy={props.cy}
                                                r={4}
                                                fill={userColorMap[u?.id] || USER_COLORS[i % USER_COLORS.length]}
                                                stroke="none"
                                            />
                                        );
                                    }}
                                    activeDot={{ r: 6 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-gray-500">Aucune donnée disponible</p>
                )}
            </div>

            {/* Tableau par participant */}
            <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md overflow-x-auto">
                <h3 className="text-lg font-semibold mb-4 text-gray-200">
                    Statistiques par participant
                </h3>
                <table className="min-w-full border-collapse text-sm">
                    <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                        <th className="text-left p-2">Nom</th>
                        <th className="text-right p-2">Parts reçues</th>
                        <th className="text-right p-2">Participations</th>
                        <th className="text-right p-2">% des parts totales</th>
                        <th className="text-right p-2">Taux de participation</th>
                    </tr>
                    </thead>
                    <tbody>
                    {perUser.map((u, i) => (
                        <tr
                            key={u.id}
                            className="border-b border-gray-800 hover:bg-gray-800/30 transition"
                        >
                            <td className="p-2">{u.name}</td>
                            <td
                                className="p-2 text-right font-semibold"
                                style={{ color: userColorMap[users[i]?.id] || USER_COLORS[i % USER_COLORS.length] }}
                            >
                                {u.totalParts}
                            </td>
                            <td className="p-2 text-right">{u.participated}</td>
                            <td className="p-2 text-right">{u.partPercent}%</td>
                            <td className="p-2 text-right">{u.participationRate}%</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Heatmap par part */}
            {Array.from(perPartData.objectMap.entries()).map(([objectName, partsMap]) => (
                <div key={objectName} className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md overflow-x-auto">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200">
                        Répartition par part — {objectName}
                    </h3>
                    <table className="min-w-full border-collapse text-sm">
                        <thead>
                        <tr className="text-gray-400 border-b border-gray-800">
                            <th className="text-left p-2">Part</th>
                            {perPartData.involvedUsers.map((u) => (
                                <th
                                    key={u.id}
                                    className="text-right p-2"
                                    style={{ color: userColorMap[u.id] }}
                                >
                                    {u.firstName} {u.lastName}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {Array.from(partsMap.entries()).map(([partName, userMap]) => {
                            const quantities = perPartData.involvedUsers.map((u) => userMap.get(u.id) || 0);
                            const nonZero = quantities.filter((q) => q > 0);
                            const maxQty = nonZero.length > 0 ? Math.max(...nonZero) : 0;
                            const minQty = nonZero.length > 1 ? Math.min(...nonZero) : -1;
                            return (
                                <tr key={partName} className="border-b border-gray-800 hover:bg-gray-800/30 transition">
                                    <td className="p-2 text-gray-300">{partName}</td>
                                    {perPartData.involvedUsers.map((u) => {
                                        const qty = userMap.get(u.id) || 0;
                                        const isMax = qty > 0 && qty === maxQty;
                                        const isMin = qty > 0 && qty === minQty && minQty < maxQty;
                                        return (
                                            <td
                                                key={u.id}
                                                className={`p-2 text-right font-mono ${
                                                    qty === 0
                                                        ? "text-gray-600"
                                                        : isMax
                                                            ? "text-green-400 font-semibold"
                                                            : isMin
                                                                ? "text-red-400 font-semibold"
                                                                : "text-gray-200"
                                                }`}
                                            >
                                                {qty === 0 ? "—" : qty}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
}

// --- Carte d’indicateur ---
function StatCard({
                      icon,
                      label,
                      value,
                  }: {
    icon: any;
    label: string;
    value: number | string;
}) {
    return (
        <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md hover:border-gray-700 transition">
            <div className="bg-green-500/10 text-green-400 p-3 rounded-lg">
                <FontAwesomeIcon icon={icon} className="w-5 h-5" />
            </div>
            <div>
                <div className="text-sm text-gray-400">{label}</div>
                <div className="text-lg font-semibold text-gray-100">{value}</div>
            </div>
        </div>
    );
}
