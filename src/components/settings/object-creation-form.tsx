import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlus, faTrash, faXmark} from "@fortawesome/free-solid-svg-icons";
import Modal from "../shared/modal";

interface ObjectCreationFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: ObjectFormData) => void;
    initialData?: any;
}

export default function ObjectCreationForm({
                                               isOpen,
                                               onClose,
                                               onSubmit,
                                               initialData,
                                           }: ObjectCreationFormProps) {
    const [formData, setFormData] = useState<ObjectFormData>({
        name: "",
        parts: [],
        types: [],
    });

    // 🧠 Convert backend data (types[].parts[]) → shared parts + per-type quantities
    useEffect(() => {
        if (initialData) {
            const allPartNames = new Set<string>();
            const typesWithQuantities = initialData.types?.map((t: any) => {
                const quantities: Record<string, number> = {};
                t.parts?.forEach((p: any) => {
                    allPartNames.add(p.name);
                    quantities[p.name] = p.quantity ?? 0;
                });
                return { name: t.name, quantities };
            });

            const parts = Array.from(allPartNames).map((name) => ({ name }));

            setFormData({
                name: initialData.name,
                parts,
                types: typesWithQuantities || [],
            });
        } else {
            setFormData({ name: "", parts: [], types: [] });
        }
    }, [initialData, isOpen]);

    /* ----------------------- PARTS ----------------------- */
    const addPart = () => {
        setFormData((prev) => ({
            ...prev,
            parts: [...prev.parts, { name: "" }],
        }));
    };

    const removePart = (index: number) => {
        const newParts = [...formData.parts];
        const removed = newParts.splice(index, 1)[0];
        setFormData({ ...formData, parts: newParts });

        // Remove that part from all types
        const updatedTypes = formData.types.map((t) => {
            const q = { ...t.quantities };
            delete q[removed.name];
            return { ...t, quantities: q };
        });
        setFormData((prev) => ({ ...prev, types: updatedTypes }));
    };

    /* ----------------------- TYPES ----------------------- */
    const addType = () => {
        const baseQuantities: Record<string, number> = {};
        formData.parts.forEach((p) => (baseQuantities[p.name] = 0));
        setFormData((prev) => ({
            ...prev,
            types: [...prev.types, { name: "", quantities: baseQuantities }],
        }));
    };

    const removeType = (index: number) => {
        const newTypes = [...formData.types];
        newTypes.splice(index, 1);
        setFormData({ ...formData, types: newTypes });
    };

    /* ----------------------- SUBMIT ----------------------- */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "Modifier un objet" : "Ajouter un nouvel objet"}
            widthClass="max-w-3xl"
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition cursor-pointer"
            >
                <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
            </button>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
                {/* Object name */}
                <input
                    required
                    placeholder="Nom de l'objet"
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                {/* Parts section */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-medium text-gray-200">Pièces</h4>
                        <button
                            type="button"
                            onClick={addPart}
                            className="flex items-center gap-2 text-green-400 hover:text-green-300 text-sm cursor-pointer transition"
                        >
                            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" /> Ajouter une pièce
                        </button>
                    </div>

                    {formData.parts.map((part, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2 mb-2 bg-gray-800 p-2 rounded-lg border border-gray-700 hover:border-gray-600 transition"
                        >
                            <input
                                placeholder="Nom de la pièce"
                                value={part.name}
                                onChange={(e) => {
                                    const newParts = [...formData.parts];
                                    const oldName = newParts[idx].name;
                                    newParts[idx].name = e.target.value;

                                    const updatedTypes = formData.types.map((t) => {
                                        const q = { ...t.quantities };
                                        if (oldName && q[oldName] !== undefined) {
                                            q[e.target.value] = q[oldName];
                                            delete q[oldName];
                                        }
                                        return { ...t, quantities: q };
                                    });

                                    setFormData({ ...formData, parts: newParts, types: updatedTypes });
                                }}
                                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 focus:ring-2 focus:ring-green-500 transition"
                            />
                            <button
                                type="button"
                                onClick={() => removePart(idx)}
                                className="text-gray-500 hover:text-red-400 cursor-pointer transition"
                                title="Supprimer"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Types section */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-medium text-gray-200">Types</h4>
                        <button
                            type="button"
                            onClick={addType}
                            className="flex items-center gap-2 text-green-400 hover:text-green-300 text-sm cursor-pointer transition"
                        >
                            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" /> Ajouter un type
                        </button>
                    </div>

                    {formData.types.map((type, tIdx) => (
                        <div
                            key={tIdx}
                            className="border border-gray-700 rounded-lg p-3 bg-gray-800 mb-3 hover:border-gray-600 transition"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <input
                                    placeholder="Nom du type"
                                    value={type.name}
                                    onChange={(e) => {
                                        const newTypes = [...formData.types];
                                        newTypes[tIdx].name = e.target.value;
                                        setFormData({ ...formData, types: newTypes });
                                    }}
                                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 flex-1 focus:ring-2 focus:ring-green-500 transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeType(tIdx)}
                                    className="text-gray-500 hover:text-red-400 cursor-pointer transition ml-2"
                                    title="Supprimer"
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>

                            <div className="ml-3 space-y-1">
                                {formData.parts.map((part, pIdx) => (
                                    <div
                                        key={pIdx}
                                        className="flex gap-2 items-center hover:bg-gray-700/30 rounded-md p-1 transition"
                                    >
                                        <label className="w-24 text-sm text-gray-400 cursor-default">
                                            {part.name}
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={type.quantities?.[part.name] ?? 0}
                                            onChange={(e) => {
                                                const newTypes = [...formData.types];
                                                newTypes[tIdx].quantities[part.name] = Number(e.target.value);
                                                setFormData({ ...formData, types: newTypes });
                                            }}
                                            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center focus:ring-2 focus:ring-green-500 transition"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    type="submit"
                    className="mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition cursor-pointer"
                >
                    {initialData ? "Sauvegarder les changements" : "Ajouter l'objet"}
                </button>
            </form>
        </Modal>
    );
}
