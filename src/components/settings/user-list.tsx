// src/components/UserList.tsx
import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faEnvelope, faPenToSquare, faPhone, faPlus, faTrash} from "@fortawesome/free-solid-svg-icons";
import UserCreationForm from "./user-creation-form";

export default function UserList() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        const dbUsers = await window.api["users:getAll"]();
        setUsers(dbUsers);
    };

    const handleSubmit = async (data: UserFormData) => {
        if (editingUser) {
            await window.api["users:edit"](editingUser.id, data);
            await loadUsers();
        } else {
            await window.api["users:add"](data);
            await loadUsers();
        }
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        await window.api["users:delete"](id);
        await loadUsers();
    };

    return (
        <div className="flex flex-col">
            {/* Header */}
            <h2 className="text-2xl font-semibold mb-4 sticky top-0 left-0 z-20 py-4 p-4 bg-gray-950/40">
                Participants
            </h2>

            <button
                onClick={() => {
                    setEditingUser(null);
                    setIsModalOpen(true);
                }}
                className="opacity-80 hover:opacity-100 mx-4 flex items-center gap-2 bg-gray-900 hover:bg-gray-700  hover:border-gray-700 text-white font-medium px-4 py-2 rounded-lg transition cursor-pointer border border-gray-700 border-dashed rounded-md"
            >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4"/>
                Ajouter un participant
            </button>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-auto p-4">
                {users.map((user) => (
                    <div
                        key={user.id}
                        className="group relative bg-gray-900 border border-gray-800 rounded-md p-4 shadow-lg hover:shadow-xl hover:border-gray-700 transition"
                    >
                        {/* Action buttons */}
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleEdit(user)}
                                className="p-1.5 bg-gray-800 hover:bg-green-600 rounded-md text-gray-400 hover:text-white transition cursor-pointer"
                                title="Modifier"
                            >
                                <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4"/>
                            </button>
                            <button
                                onClick={() => handleDelete(user.id)}
                                className="p-1.5 bg-gray-800 hover:bg-red-600 rounded-md text-gray-400 hover:text-white transition cursor-pointer"
                                title="Supprimer"
                            >
                                <FontAwesomeIcon icon={faTrash} className="w-4 h-4"/>
                            </button>
                        </div>

                        {/* User info */}
                        <h3 className="text-lg font-semibold text-gray-100">
                            {user.firstName} {user.lastName}
                        </h3>
                        <div className="flex items-center text-gray-400 text-sm mt-1">
                            <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4 mr-2 text-gray-500"/>
                            {user.email}
                        </div>
                        <div className="flex items-center text-gray-400 text-sm mt-1">
                            <FontAwesomeIcon icon={faPhone} className="w-4 h-4 mr-2 text-gray-500"/>
                            {user.phone}
                        </div>
                    </div>
                ))}

                {users.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 py-8 border border-gray-800 rounded-xl bg-gray-950">
                        Aucun participant trouvé
                    </div>
                )}
            </div>

            {/* Modal */}
            <UserCreationForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                initialData={editingUser ?? undefined}
            />
        </div>
    );
}
