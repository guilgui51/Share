import {useEffect, useMemo, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faChevronLeft, faChevronRight, faMinus, faPlus, faSearch, faXmark, faFilePdf,} from "@fortawesome/free-solid-svg-icons";
import Modal from "../shared/modal";
import {generateDistributionPDF} from "../../utils/pdf-export";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export default function DistributionCreationForm({
                                                     isOpen,
                                                     onClose,
                                                     onCreated,
                                                 }: Props) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [name, setName] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [typeSearch, setTypeSearch] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [objects, setObjects] = useState<any[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<
        { typeId: number; label: string; count: number }[]
    >([]);
    const [result, setResult] = useState<DistributionCardDTO | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        (async () => {
            const us = await window.api["users:getAll"]();
            const objs = await window.api["objects:getAll"]();
            setUsers(us);
            setObjects(objs);
        })();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setName("");
            setUserSearch("");
            setTypeSearch("");
            setSelectedUserIds([]);
            setSelectedTypes([]);
            setResult(null);
        }
    }, [isOpen]);

    const filteredUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) =>
            `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)
        );
    }, [userSearch, users]);

    const flattenedTypes = useMemo(() => {
        const q = typeSearch.trim().toLowerCase();
        const list: { typeId: number; label: string }[] = [];
        objects.forEach((o: any) => {
            o.types.forEach((t: any) => {
                const label = `${o.name} / ${t.name}`;
                if (!q || label.toLowerCase().includes(q)) {
                    list.push({ typeId: t.id, label });
                }
            });
        });
        return list;
    }, [objects, typeSearch]);

    const incType = (typeId: number, label: string) => {
        setSelectedTypes((prev) => {
            const idx = prev.findIndex((x) => x.typeId === typeId);
            if (idx === -1) return [...prev, { typeId, label, count: 1 }];
            return prev.map(s => s.typeId === typeId ? {...s, count: s.count + 1} : s);
        });
    };

    const decType = (typeId: number) => {
        setSelectedTypes((prev) => {
            const idx = prev.findIndex((x) => x.typeId === typeId);
            if (idx === -1) return prev;
            const copy = prev.map(s => s.typeId === typeId ? {...s, count: s.count - 1} : s);
            if (copy[idx].count <= 0) copy.splice(idx, 1);
            return copy;
        });
    };

    const toggleUser = (id: number) => {
        setSelectedUserIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const canNext =
        step === 1
            ? name.trim().length > 0 && selectedUserIds.length > 0
            : selectedTypes.length > 0;

    const onStart = async () => {
        const dist = await window.api["distributions:create"]({
            name: name.trim(),
            participantIds: selectedUserIds,
            selections: selectedTypes.map((s) => ({
                typeId: s.typeId,
                count: s.count,
            })),
        });
        setResult(dist);
        setStep(3);
    };

    const resultByUser = useMemo(() => {
        if (!result) return [];
        const map: Record<number, { user: User; total: number; parts: { name: string; object: string; type: string; qty: number }[] }> = {};
        result.assignments.forEach(a => {
            const uid = a.user.id;
            if (!map[uid]) map[uid] = {user: a.user, total: 0, parts: []};
            map[uid].total += a.quantity;
            map[uid].parts.push({name: a.part.name, object: a.part.object.name, type: a.type.name, qty: a.quantity});
        });
        // Include participants with no assignments
        result.participants.forEach(p => {
            if (!map[p.user.id]) map[p.user.id] = {user: p.user, total: 0, parts: []};
        });
        return Object.values(map);
    }, [result]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Créer une nouvelle distribution"
            widthClass="max-w-4xl"
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition cursor-pointer"
            >
                <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Assistant de distribution</h3>
                <span className="text-sm text-gray-400">{step < 3 ? `Étape ${step} / 2` : "Résultat"}</span>
            </div>

            {/* Step 1 */}
            {step === 1 && (
                <div className="space-y-6">
                    <div>
                        <label className="text-sm text-gray-300">Nom</label>
                        <input
                            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500"
                            placeholder="Nom de la distribution"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-gray-300">Participants</label>
                            <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-md">
                                <FontAwesomeIcon
                                    icon={faSearch}
                                    className="text-gray-400 w-3.5 h-3.5"
                                />
                                <input
                                    className="bg-transparent outline-none text-sm placeholder-gray-500 w-52"
                                    placeholder="Recherche de participants..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {filteredUsers.map((u) => {
                                const checked = selectedUserIds.includes(u.id);
                                return (
                                    <button
                                        key={u.id}
                                        onClick={() => toggleUser(u.id)}
                                        type="button"
                                        className={`text-left px-3 py-2 rounded-lg border transition cursor-pointer
                    ${
                                            checked
                                                ? "border-green-500 bg-green-500/10"
                                                : "border-gray-700 bg-gray-800 hover:border-gray-600"
                                        }`}
                                    >
                                        <div className="font-medium text-sm">
                                            {u.firstName} {u.lastName}
                                        </div>
                                        <div className="text-xs text-gray-400">{u.email}</div>
                                    </button>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <div className="col-span-full text-sm text-gray-500">
                                    No users found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-300">Sélection des objets par type</label>
                        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-md">
                            <FontAwesomeIcon
                                icon={faSearch}
                                className="text-gray-400 w-3.5 h-3.5"
                            />
                            <input
                                className="bg-transparent outline-none text-sm placeholder-gray-500 w-52"
                                placeholder="Recherche d'objets et de types..."
                                value={typeSearch}
                                onChange={(e) => setTypeSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {flattenedTypes.map((t) => {
                            const sel = selectedTypes.find((x) => x.typeId === t.typeId);
                            return (
                                <div
                                    key={t.typeId}
                                    className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                                >
                                    <div className="text-sm">{t.label}</div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 cursor-pointer"
                                            onClick={() => decType(t.typeId)}
                                        >
                                            <FontAwesomeIcon icon={faMinus} className="w-3 h-3" />
                                        </button>
                                        <div className="w-8 text-center text-sm">
                                            {sel?.count ?? 0}
                                        </div>
                                        <button
                                            type="button"
                                            className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 cursor-pointer"
                                            onClick={() => incType(t.typeId, t.label)}
                                        >
                                            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {flattenedTypes.length === 0 && (
                            <div className="col-span-full text-sm text-gray-500">
                                Aucun objet avec des types trouvé.
                            </div>
                        )}
                    </div>

                    {/* Current picked summary */}
                    <div className="text-sm text-gray-300">
                        <div className="mb-2 font-medium">Sélectionnés:</div>
                        <div className="flex flex-wrap gap-2">
                            {selectedTypes.map((s) => (
                                <span
                                    key={s.typeId}
                                    className="bg-gray-800 border border-gray-700 px-2 py-1 rounded-full text-xs"
                                >
                  {s.label} ×{s.count}
                </span>
                            ))}
                            {selectedTypes.length === 0 && (
                                <span className="text-gray-500">Nothing selected</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3 — Preview */}
            {step === 3 && result && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-400">
                        <FontAwesomeIcon icon={faCheck} className="w-4 h-4"/>
                        <span className="font-medium">Distribution terminée</span>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {resultByUser.map(({user, total, parts}) => (
                            <div key={user.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-green-400">{user.firstName} {user.lastName}</span>
                                    <span className="text-xs text-gray-400">{total} part{total > 1 ? "s" : ""}</span>
                                </div>
                                {parts.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {parts.map((p, i) => (
                                            <span key={i} className="text-xs bg-gray-900 border border-gray-700 px-2 py-1 rounded-full">
                                                {p.name} ×{p.qty}
                                                <span className="ml-1.5 text-[10px] text-gray-500">{p.object} / {p.type}</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-xs italic text-gray-500">N'a rien obtenu</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between">
                {step === 3 ? (
                    <button
                        onClick={() => result && generateDistributionPDF(result)}
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-700 text-gray-200 hover:border-gray-600 transition cursor-pointer"
                    >
                        <FontAwesomeIcon icon={faFilePdf} className="w-4 h-4"/> Télécharger PDF
                    </button>
                ) : (
                    <button
                        disabled={step === 1}
                        onClick={() => setStep(1)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border transition
              ${
                            step === 1
                                ? "border-gray-800 text-gray-500 cursor-not-allowed"
                                : "border-gray-700 text-gray-200 hover:border-gray-600 cursor-pointer"
                        }`}
                    >
                        <FontAwesomeIcon icon={faChevronLeft} /> Précédent
                    </button>
                )}

                {step === 1 ? (
                    <button
                        disabled={!canNext}
                        onClick={() => setStep(2)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition
            ${
                            canNext
                                ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                                : "bg-gray-800 text-gray-500 cursor-not-allowed"
                        }`}
                    >
                        Suivant <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                ) : step === 2 ? (
                    <button
                        disabled={!canNext}
                        onClick={onStart}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition
            ${
                            canNext
                                ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                                : "bg-gray-800 text-gray-500 cursor-not-allowed"
                        }`}
                    >
                        Commencer le partage
                    </button>
                ) : (
                    <button
                        onClick={onCreated}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white transition cursor-pointer"
                    >
                        Fermer
                    </button>
                )}
            </div>
        </Modal>
    );
}
