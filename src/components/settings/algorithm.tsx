import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faScaleBalanced, faShareNodes, faShuffle} from "@fortawesome/free-solid-svg-icons";

export type AlgorithmType = "random" | "share_less" | "less" | "share_random";

export default function Algorithm() {
    const [settings, setSettings] = useState<AppSettings>({
        algorithmType: "less",
        algorithmCount: 1,
    });

    // Load saved settings on mount
    useEffect(() => {
        (async () => {
            try {
                const s = await window.api["settings:get"]();
                setSettings(s);
            } catch (err) {
                console.error("Failed to load settings:", err);
            }
        })();
    }, []);

    const saveSettings = async (updated: Partial<AppSettings>) => {
        try {
            const newSettings = await window.api["settings:update"](updated);
            setSettings(newSettings);
        } catch (err) {
            console.error("Failed to save settings:", err);
        }
    };

    const setAlgorithmType = (type: AlgorithmType) => {
        saveSettings({...settings, algorithmType: type});
    }

    const setAlgorithmCount = (count: number) => {
        saveSettings({...settings, algorithmCount: count});
    }

    // Click logic to cycle between Random → Less → Share
    const handleMainClick = () => {
        if (settings.algorithmType === "random") {
            setAlgorithmType("less");
        } else if (settings.algorithmType === "less") {
            saveSettings({algorithmType: "share_less", algorithmCount: 0});
        } else {
            // share_less / share_random → back to random
            setAlgorithmType("random");
        }
    };

    // Cycle count: 1 → 2 → 3 → Max → 1
    const handleCountClick = () => {
        if (settings.algorithmCount === 1) setAlgorithmCount(2);
        else if (settings.algorithmCount === 2) setAlgorithmCount(3);
        else if (settings.algorithmCount === 3) setAlgorithmCount(0); // "as much as possible"
        else setAlgorithmCount(1);
    };

    // Cycle between less/random
    const handleSecondaryClick = () => {
        setAlgorithmType(settings.algorithmType === "share_less" ? "share_random" : "share_less");
    };

    const renderShareButtons = () => (
        <div className="flex items-center gap-3">
            {/* Share button */}
            <button
                onClick={handleMainClick}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 cursor-pointer text-white font-medium px-4 py-2 rounded-lg transition"
            >
                <FontAwesomeIcon icon={faShareNodes} className="w-4 h-4" />
                Partager
            </button>

            {/* Count button */}
            <button
                onClick={handleCountClick}
                className="bg-gray-800 hover:bg-gray-700 cursor-pointer text-white font-medium px-4 py-2 rounded-lg transition min-w-[60px]"
            >
                {settings.algorithmCount === 0 ? "Au maximum" : `${settings.algorithmCount} fois`}
            </button>

            <span className="text-gray-400 text-sm font-medium">Puis</span>

            {/* Secondary button */}
            <button
                onClick={handleSecondaryClick}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 cursor-pointer text-white font-medium px-4 py-2 rounded-lg transition capitalize min-w-[70px]"
            >
                <FontAwesomeIcon icon={settings.algorithmType === "share_random" ? faShuffle : faScaleBalanced} className="w-4 h-4" />
                {settings.algorithmType === "share_random" ? "Aléatoirement" : "Ceux qui ont le moins d'abord"}
            </button>
        </div>
    );

    const renderSingleButton = (label: string, color: string, icon: any) => (
        <button
            onClick={handleMainClick}
            className={`flex items-center gap-2 cursor-pointer ${color} text-white font-medium px-4 py-2 rounded-lg transition`}
        >
            <FontAwesomeIcon icon={icon} className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="h-full w-full items-center justify-center flex p-4">
            <div className="flex items-center justify-center gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
                {settings.algorithmType === "random" &&
                    renderSingleButton("Aléatoirement", "bg-green-600 hover:bg-green-700", faShuffle)}

                {settings.algorithmType === "less" &&
                    renderSingleButton("Ceux qui ont le moins d'abord", "bg-green-600 hover:bg-green-700", faScaleBalanced)}

                {(settings.algorithmType === "share_less" || settings.algorithmType === "share_random") && renderShareButtons()}
            </div>
        </div>
    );
}
