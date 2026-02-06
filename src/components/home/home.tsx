import {useEffect, useMemo, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown, faChevronRight, faPlus, faTrash,} from "@fortawesome/free-solid-svg-icons";
import DistributionCreationForm from "./distribution-creation-form";

export default function Home() {
    const [items, setItems] = useState<DistributionCardDTO[]>([]);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [openWizard, setOpenWizard] = useState(false);

    const load = async () => {
        const list = await window.api["distributions:getAll"]();
        setItems(
            list.map((d: any) => ({
                ...d,
                createdAt: new Date(d.createdAt).toISOString(),
            }))
        );
    };

    useEffect(() => {
        load();
    }, []);

    const onDelete = async (id: number) => {
        await window.api["distributions:cancel"](id);
        await load();
    };

    const derivedData = useMemo(() => {
        return items.map((d) => {
            const byUser = (() => {
                const map = new Map<
                    number,
                    {
                        user: User;
                        items: { name: string; qty: number; type: string; object: string }[];
                    }
                >();
                d.assignments.forEach((a) => {
                    const uId = a.user.id;
                    if (!map.has(uId)) {
                        map.set(uId, { user: a.user, items: [] });
                    }
                    const rec = map.get(uId)!;
                    rec.items.push({
                        name: a.part.name,
                        qty: a.quantity,
                        type: a.type.name,
                        object: a.part.object.name,
                    });
                });
                return Array.from(map.values());
            })();

            const objectsRecap = (() => {
                const map = new Map<string, number>();
                d.selections.forEach((s) => {
                    const key = `${s.type.object.name} / ${s.type.name}`;
                    map.set(key, (map.get(key) || 0) + s.count);
                });
                return Array.from(map.entries()).map(([key, count]) => ({
                    key,
                    count,
                }));
            })();

            return { ...d, byUser, objectsRecap };
        });
    }, [items]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <h2 className="text-2xl font-semibold mb-4 sticky top-0 left-0 z-20 py-4 p-4 bg-gray-950/40">
                Distributions
            </h2>

            <button
                onClick={() => setOpenWizard(true)}
                className="opacity-80 hover:opacity-100 mx-4 flex items-center gap-2 bg-gray-900 hover:bg-gray-700  hover:border-gray-700 text-white font-medium px-4 py-2 rounded-lg transition cursor-pointer border border-gray-700 border-dashed rounded-md"
            >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4"/>
                Ajouter une distribution
            </button>

            {/* Accordion List */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-2 overflow-auto p-4">
                {derivedData.length === 0 && (
                    <div className="text-center text-gray-500 py-16 border border-gray-800 rounded-md">
                        Aucune distribution trouvée
                    </div>
                )}

                {derivedData.map((d) => {
                    const isOpen = expanded === d.id;

                    return (
                        <div
                            key={d.id}
                            className="bg-gray-900 border border-gray-800 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer hover:bg-gray-800/60 "
                            onClick={() => setExpanded(isOpen ? null : d.id)}
                        >
                            {/* Header Row */}
                            <div
                                className="flex justify-between items-center p-4 transition"
                            >
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-100">{d.name}</h3>
                                    <p className="text-xs text-gray-500">
                                        {new Date(d.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(d.id);
                                        }}
                                        className="p-1.5 bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white rounded-md transition cursor-pointer"
                                        title="Supprimer"
                                    >
                                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4"/>
                                    </button>
                                    <FontAwesomeIcon
                                        icon={isOpen ? faChevronDown : faChevronRight}
                                        className="text-gray-400 transition-transform"
                                    />
                                </div>
                            </div>

                            {/* Expandable Content */}
                            {isOpen && (
                                <div className="px-4 pb-4 space-y-4 animate-fadeIn">
                                    {/* Objects Recap */}
                                    <div>
                                        <div className="text-sm font-semibold mb-2 text-gray-300">
                                            Objets distribués
                                        </div>
                                        {d.objectsRecap.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {d.objectsRecap.map((o, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded-full"
                                                    >
                                                        {o.count} {o.key}
                                                      </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500">Aucun objet distribué</p>
                                        )}
                                    </div>

                                    {/* Results */}
                                    <div>
                                        <div className="text-sm font-semibold mb-2 text-gray-300">
                                            Résultat
                                        </div>
                                        {d.byUser.length === 0 && (
                                            <div className="text-gray-500 text-sm">Aucune assignation</div>
                                        )}
                                        {d.byUser.map((u) => (
                                            <div
                                                key={u.user.id}
                                                className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-2"
                                            >
                                                <div className="text-sm font-medium mb-2 text-green-400">
                                                    {u.user.firstName} {u.user.lastName}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {u.items.map((it, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-xs bg-gray-900 border border-gray-700 px-2 py-1 rounded-full"
                                                        >
                              {it.name} ×{it.qty}
                                                            <span className="ml-2 text-[10px] text-gray-500">
                                {it.object} / {it.type}
                              </span>
                            </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        {/* Participants who got nothing */}
                                        {d.participants
                                            .filter((p) => !d.byUser.some((u) => u.user.id === p.user.id))
                                            .map((p) => (
                                                <div
                                                    key={p.user.id}
                                                    className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-2"
                                                >
                                                    <div className="font-medium mb-2 text-green-400">
                                                        {p.user.firstName} {p.user.lastName}
                                                    </div>
                                                    <div className="text-xs italic text-gray-500">
                                                        N'a rien obtenu
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            <DistributionCreationForm
                isOpen={openWizard}
                onClose={() => setOpenWizard(false)}
                onCreated={async () => {
                    setOpenWizard(false);
                    await load();
                }}
            />
        </div>
    );
}
