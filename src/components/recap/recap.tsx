import {useEffect, useMemo, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlus, faFilePdf, faDownload} from "@fortawesome/free-solid-svg-icons";
import DistributionCreationForm from "../home/distribution-creation-form";
import {generateFullRecapPDF, generateDistributionPDF} from "../../utils/pdf-export";

export default function Recap() {
    const [users, setUsers] = useState<User[]>([]);
    const [distributions, setDistributions] = useState<DistributionCardDTO[]>([]);
    const [openWizard, setOpenWizard] = useState(false);

    const load = async () => {
        const [usersList, distList] = await Promise.all([
            window.api["users:getAll"](),
            window.api["distributions:getAll"](),
        ]);

        const ordered = distList.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setUsers(usersList);
        setDistributions(ordered);
    };

    useEffect(() => {
        load();
    }, []);

    const userData = useMemo(() => {
        return users.map((u) => {
            const total: Record<number, { id: number; name: string; qty: number; object: string; type: string }> = {};
            const perDist = distributions.map((d) => {
                const parts = d.assignments.filter((a) => a.user.id === u.id).map((a) => ({
                    id: a.part.id,
                    name: a.part.name,
                    qty: a.quantity,
                    object: a.part.object.name,
                    type: a.type.name,
                }));
                if (parts.length === 0) return { distId: d.id, parts: null };
                parts.forEach((p) => {
                    if (total[p.id]) total[p.id].qty += p.qty; else total[p.id] = { ...p };
                });
                return { distId: d.id, parts };
            });
            return { user: u, total, perDist };
        });
    }, [users, distributions]);

    return (
        <div className="flex flex-col">
            <h1 className="text-2xl font-semibold mb-4 sticky top-0 left-0 z-20 py-4 p-4 bg-gray-950/40">Historique des distributions</h1>

            <div className="flex gap-2 mx-4">
                <button
                    onClick={() => setOpenWizard(true)}
                    className="opacity-80 hover:opacity-100 flex-1 flex items-center gap-2 bg-gray-900 hover:bg-gray-700 hover:border-gray-700 text-white font-medium px-4 py-2 rounded-lg transition cursor-pointer border border-gray-700 border-dashed"
                >
                    <FontAwesomeIcon icon={faPlus} className="w-4 h-4"/>
                    Ajouter une distribution
                </button>
                {distributions.length > 0 && (
                    <button
                        onClick={() => generateFullRecapPDF(users, distributions)}
                        className="opacity-80 hover:opacity-100 flex items-center gap-2 bg-gray-900 hover:bg-gray-700 hover:border-gray-700 text-white font-medium px-4 py-2 rounded-lg transition cursor-pointer border border-gray-700"
                    >
                        <FontAwesomeIcon icon={faFilePdf} className="w-4 h-4"/>
                        Télécharger le rapport PDF
                    </button>
                )}
            </div>

            {users.length === 0 ? (
                <div className="text-center text-gray-500 py-16 border border-gray-800 rounded-md m-4">Aucun participant</div>
            ) : (
                <div className="overflow-auto pt-4">
                    <table className="min-w-max border-collapse w-full">
                        <thead>
                        <tr>
                            <th className="border-y border-gray-800 p-3 text-left text-gray-400 text-sm font-semibold bg-gray-900 sticky left-0 z-10">Total</th>
                            {distributions.map((d) => (
                                <th key={d.id} className="border-y border-gray-800 p-3 text-gray-400 text-sm font-semibold whitespace-nowrap text-left even:bg-gray-950 bg-[oklch(15%_0.030_261.692)]" title={new Date(d.createdAt).toLocaleString()}>
                                    <div className="flex items-center gap-2">
                                        <span>{d.name}</span>
                                        <button
                                            onClick={() => generateDistributionPDF(d)}
                                            className="opacity-50 hover:opacity-100 transition cursor-pointer"
                                            title="Télécharger en PDF"
                                        >
                                            <FontAwesomeIcon icon={faDownload} className="w-3 h-3"/>
                                        </button>
                                    </div>
                                    <div className="text-[10px] text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</div>
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {userData.map(({user, total, perDist}) => (
                            <tr key={user.id} className="group hover:bg-gray-800/30 transition border-b border-gray-800 bg-gray-900">
                                <td className="p-3 text-sm text-gray-300 sticky left-0  z-10 text-center align-top flex flex-col items-start gap-1">
                                    <div className="text-left font-medium text-green-400 sticky left-0 bg-gray-900 z-10">{user.firstName} {user.lastName}</div>
                                    {Object.keys(total).length > 0 ? (
                                        Object.entries(total).map(([id, part]) => (
                                            <div key={id} className="text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded-full inline-block">
                                                {part.name} ×{part.qty}
                                                <span className="ml-2 text-[10px] text-gray-500">{part.object} / {part.type}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-500">Rien pour l'instant</span>
                                    )}
                                </td>
                                {perDist.map((pd, i) => {
                                    const dist = distributions[i];
                                    const participated = dist.participants.some((p) => p.user.id === user.id);
                                    return (
                                        <td key={i} className="group-hover:bg-gray-800/30 group-hover:even:bg-gray-900/30 p-3 text-sm text-gray-300 text-center align-top text-left even:bg-gray-950 bg-[oklch(15%_0.030_261.692)]">
                                            {pd.parts ? (
                                                <div className="flex flex-col items-start gap-1">
                                                    {pd.parts.map((p, j) => (
                                                        <div key={j} className="text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded-full inline-block">
                                                            {p.name} ×{p.qty}
                                                            <span className="ml-2 text-[10px] text-gray-500">{p.object} / {p.type}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : participated ? (
                                                <span className="text-xs italic text-gray-500">N'a rien obtenu</span>
                                            ) : (
                                                <span className="text-xs italic text-gray-500">N'a pas participé</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

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
