import {Outlet} from "react-router-dom";
import Navbar from "../navbar/navbar";

export default function Layout() {
    return (
        <div className="flex h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-y-auto">
                {/* React Router renders page content here */}
                <Outlet />
            </main>
        </div>
    );
}
