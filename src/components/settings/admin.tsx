import {useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faFileExport, faFileImport, faCheck, faTriangleExclamation} from "@fortawesome/free-solid-svg-icons";

export default function Admin() {
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const showStatus = (type: "success" | "error", message: string) => {
        setStatus({type, message});
        setTimeout(() => setStatus(null), 4000);
    };

    const handleExport = async () => {
        try {
            const ok = await window.api["db:export"]();
            if (ok) showStatus("success", "Base de données exportée avec succès.");
        } catch (e: any) {
            showStatus("error", e.message || "Erreur lors de l'export.");
        }
    };

    const handleImport = async () => {
        try {
            const ok = await window.api["db:import"]();
            if (ok) showStatus("success", "Base de données importée avec succès. Redémarrage recommandé.");
        } catch (e: any) {
            showStatus("error", e.message || "Erreur lors de l'import.");
        }
    };

    return (
        <div className="flex flex-col p-6">
            <h1 className="text-2xl font-semibold mb-6">Administration</h1>

            <div className="space-y-6">
                {/* Export */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <h2 className="text-lg font-medium mb-2">Exporter la base de données</h2>
                    <p className="text-sm text-gray-400 mb-4">
                        Génère un fichier JSON contenant l'intégralité des données : participants, objets, types, distributions et attributions.
                    </p>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition cursor-pointer text-white font-medium"
                    >
                        <FontAwesomeIcon icon={faFileExport} className="w-4 h-4"/>
                        Exporter
                    </button>
                </div>

                {/* Import */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <h2 className="text-lg font-medium mb-2">Importer une base de données</h2>
                    <p className="text-sm text-gray-400 mb-4">
                        Remplace toutes les données actuelles par celles du fichier sélectionné. Cette action est irréversible.
                    </p>
                    <button
                        onClick={handleImport}
                        className="flex items-center gap-2 px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-800/50 rounded-lg transition cursor-pointer text-red-300 font-medium"
                    >
                        <FontAwesomeIcon icon={faFileImport} className="w-4 h-4"/>
                        Importer
                    </button>
                </div>

                {/* Status toast */}
                {status && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                        status.type === "success"
                            ? "bg-green-900/30 border border-green-800/50 text-green-400"
                            : "bg-red-900/30 border border-red-800/50 text-red-400"
                    }`}>
                        <FontAwesomeIcon icon={status.type === "success" ? faCheck : faTriangleExclamation} className="w-4 h-4"/>
                        {status.message}
                    </div>
                )}
            </div>
        </div>
    );
}
