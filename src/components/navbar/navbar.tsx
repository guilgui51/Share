// src/components/Navbar.tsx
import {useEffect, useState} from "react";
import {NavLink, useLocation} from "react-router-dom";
import {faChartPie, faChevronDown, faChevronRight, faClockRotateLeft, faCog, faCogs, faList, faPowerOff, faPuzzlePiece, faUsers,} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import logo from "../../assets/logo.png";

export default function Navbar() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const location = useLocation();

    // Detect if the current route is under /settings
    const isSettingsActive = location.pathname.startsWith("/settings");

    // Automatically open settings menu if already in /settings/*
    useEffect(() => {
        if (isSettingsActive) setSettingsOpen(true);
    }, [isSettingsActive]);

    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center px-4 py-2 transition cursor-pointer ${
            isActive
                ? "bg-gray-800 text-green-400"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
        }`;

    const subLinkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center px-3 py-1.5 rounded-l transition cursor-pointer ${
            isActive
                ? "bg-gray-800 text-green-400"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
        }`;

    return (
        <nav className="flex flex-col w-64 bg-gray-900 text-gray-100 h-screen border-r border-gray-800">
            <div className="p-2 flex gap-2 items-center h-16 text-2xl font-bold border-b border-gray-800">
                <img
                    src={logo}
                    alt="Partly Logo"
                    className="h-10 w-auto"
                />
                Share
            </div>

            <ul className="flex-1 flex flex-col py-4 space-y-1 overflow-y-auto">
                <li>
                    <NavLink to="/" className={navLinkClass} end>
                        <FontAwesomeIcon icon={faList} className="w-5 h-5 mr-3"/>
                        Distributions
                    </NavLink>
                </li>

                <li>
                    <NavLink to="/recap" className={navLinkClass}>
                        <FontAwesomeIcon icon={faClockRotateLeft} className="w-5 h-5 mr-3"/>
                        Récap
                    </NavLink>
                </li>

                <li>
                    <NavLink to="/statistics" className={navLinkClass}>
                        <FontAwesomeIcon icon={faChartPie} className="w-5 h-5 mr-3"/>
                        Statistiques
                    </NavLink>
                </li>

                <li>
                    <button
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        className={`flex items-center justify-between w-full px-4 py-2 transition cursor-pointer ${
                            isSettingsActive
                                ? "bg-gray-800 text-green-400"
                                : "hover:bg-gray-800 text-gray-300 hover:text-white"
                        }`}
                    >
                        <span className="flex items-center">
                          <FontAwesomeIcon icon={faCog} className="w-5 h-5 mr-3"/>
                          Paramètres
                        </span>
                        <FontAwesomeIcon
                            icon={settingsOpen || isSettingsActive ? faChevronDown : faChevronRight}
                            className="w-4 h-4"
                        />
                    </button>

                    {(settingsOpen || isSettingsActive) && (
                        <ul className="ml-6 mt-1 space-y-1 text-sm">
                            <li>
                                <NavLink to="/settings/users" className={subLinkClass}>
                                    <FontAwesomeIcon icon={faUsers} className="w-4 h-4 mr-2"/>
                                    Partipants
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/settings/pieces" className={subLinkClass}>
                                    <FontAwesomeIcon icon={faPuzzlePiece} className="w-4 h-4 mr-2"/>
                                    Objets
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/settings/algorithm" className={subLinkClass}>
                                    <FontAwesomeIcon icon={faCogs} className="w-4 h-4 mr-2"/>
                                    Algorithme
                                </NavLink>
                            </li>
                        </ul>
                    )}
                </li>
            </ul>

            <div className="p-4 border-t border-gray-800">
                <button
                    onClick={() => window.api["app:exit"]?.()}
                    className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-400 hover:text-red-50 cursor-pointer text-red-400 font-medium py-2 rounded-lg transition"
                >
                    <FontAwesomeIcon icon={faPowerOff} className="w-4 h-4" />
                    Exit
                </button>
            </div>
        </nav>
    );
}
