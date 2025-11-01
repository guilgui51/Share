import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faXmark} from "@fortawesome/free-solid-svg-icons";
import Modal from "../shared/modal";

interface UserCreationFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: UserFormData) => void;
    initialData?: UserFormData | null;
}

export default function UserCreationForm({
                                             isOpen,
                                             onClose,
                                             onSubmit,
                                             initialData = null,
                                         }: UserCreationFormProps) {
    const [formData, setFormData] = useState<UserFormData>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
    });

    useEffect(() => {
        if (initialData) setFormData(initialData);
        else
            setFormData({
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
            });
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "Modifier un participant" : "Ajouter un nouveau participant"}
            widthClass="max-w-md"
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition cursor-pointer"
            >
                <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
            </button>

            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-3 mt-2"
            >
                <div className="flex gap-2 flex-wrap">
                    <input
                        required
                        name="firstName"
                        placeholder="Prénom"
                        className="flex-1 min-w-[120px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={formData.firstName}
                        onChange={handleChange}
                    />
                    <input
                        required
                        name="lastName"
                        placeholder="Nom de famille"
                        className="flex-1 min-w-[120px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={formData.lastName}
                        onChange={handleChange}
                    />
                </div>

                <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={formData.email}
                    onChange={handleChange}
                />

                <input
                    name="phone"
                    placeholder="Téléphone"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={formData.phone}
                    onChange={handleChange}
                />

                <button
                    type="submit"
                    className="mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
                >
                    {initialData ? "Sauvergarder les changements" : "Ajouter le participant"}
                </button>
            </form>
        </Modal>
    );
}
