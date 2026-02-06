import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown, faChevronRight, faPenToSquare, faPlus, faTrash,} from "@fortawesome/free-solid-svg-icons";
import ObjectCreationForm from "./object-creation-form";

export default function ObjectList() {
    const [objects, setObjects] = useState<any[]>([]);
    const [expandedObject, setExpandedObject] = useState<number | null>(null);
    const [editingObject, setEditingObject] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const loadObjects = async () => {
        const data = await window.api["objects:getAll"]();
        setObjects(data);
    };

    useEffect(() => {
        loadObjects();
    }, []);

    const handleAdd = () => {
        setEditingObject(null);
        setIsModalOpen(true);
    };

    const handleEdit = (obj: any) => {
        setEditingObject(obj);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        await window.api["objects:delete"](id);
        await loadObjects();
    };

    const handleSubmit = async (formData: ObjectFormData) => {
        if (editingObject) {
            await window.api["objects:edit"](editingObject.id, formData);
        } else {
            await window.api["objects:add"](formData);
        }
        await loadObjects();
    };

    return (
        <div className="flex flex-col">
            {/* Header */}
            <h2 className="text-2xl font-semibold mb-4 sticky top-0 left-0 z-20 py-4 p-4 bg-gray-950/40">
                Objets
            </h2>

            <button
                onClick={handleAdd}
                className="opacity-80 hover:opacity-100 mx-4 flex items-center gap-2 bg-gray-900 hover:bg-gray-700  hover:border-gray-700 text-white font-medium px-4 py-2 rounded-lg transition cursor-pointer border border-gray-700 border-dashed rounded-md"
            >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4"/>
                Ajouter un objet
            </button>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-auto p-4 items-start">
                {objects.map((obj) => {
                    const isOpen = expandedObject === obj.id;
                    return (
                        <div
                            key={obj.id}
                            onClick={() => setExpandedObject(isOpen ? null : obj.id)}
                            className="group relative bg-gray-900 border border-gray-800 rounded-md p-4 shadow-lg hover:shadow-xl hover:border-gray-700 transition cursor-pointer"
                        >
                            {/* Action buttons */}
                            <div className="absolute top-3 right-12 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(obj)}
                                    className="p-1.5 bg-gray-800 hover:bg-green-600 rounded-md text-gray-400 hover:text-white transition cursor-pointer"
                                    title="Modifier"
                                >
                                    <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4"/>
                                </button>
                                <button
                                    onClick={() => handleDelete(obj.id)}
                                    className="p-1.5 bg-gray-800 hover:bg-red-600 rounded-md text-gray-400 hover:text-white transition cursor-pointer"
                                    title="Supprimer"
                                >
                                    <FontAwesomeIcon icon={faTrash} className="w-4 h-4"/>
                                </button>
                            </div>

                            {/* Header row */}
                            <div
                                className="flex justify-between items-center"
                            >
                                <h3 className="text-lg font-semibold text-gray-100">
                                    {obj.name}
                                </h3>
                                <FontAwesomeIcon
                                    icon={isOpen ? faChevronDown : faChevronRight}
                                    className="text-gray-400"
                                />
                            </div>

                            {/* Expanded content */}
                            {isOpen && (
                                <div className="mt-3 space-y-3">
                                    {obj.types.length === 0 && (
                                        <p className="text-gray-500 text-sm">No types yet.</p>
                                    )}

                                    {obj.types.map((type: any) => (
                                        <div
                                            key={type.id}
                                            className="bg-gray-800 rounded-lg p-3 text-sm border border-gray-700"
                                        >
                                            <div className="font-semibold mb-1 text-green-400">
                                                {type.name}
                                            </div>

                                            {type.typeParts.length === 0 && (
                                                <p className="text-gray-500">No parts.</p>
                                            )}

                                            <ul className="list-disc ml-5 text-gray-300">
                                                {type.typeParts.map((tp: any) => (
                                                    <li key={tp.id}>
                                                        {tp.part.name}{" "}
                                                        <span className="text-gray-500">
                              (x{tp.quantity})
                            </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {objects.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 py-8 border border-gray-800 rounded-xl bg-gray-950">
                        Aucun objet trouvé
                    </div>
                )}
            </div>

            {/* Modal for Add/Edit */}
            <ObjectCreationForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                initialData={editingObject ?? undefined}
            />
        </div>
    );
}
