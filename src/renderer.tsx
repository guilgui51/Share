import {createRoot} from "react-dom/client";
import React from "react";
import {HashRouter, Route, Routes} from "react-router-dom";
import Layout from "./components/layout/layout";
import Home from "./components/home/home";
import Recap from "./components/recap/recap";
import Statistics from "./components/stats/statistics";
import UserList from "./components/settings/user-list";
import ObjectList from "./components/settings/object-list";
import Algorithm from "./components/settings/algorithm";

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <React.StrictMode>
        <HashRouter>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/recap" element={<Recap />} />
                    <Route path="/statistics" element={<Statistics />} />
                    <Route path="/settings/users" element={<UserList />} />
                    <Route path="/settings/pieces" element={<ObjectList />} />
                    <Route path="/settings/algorithm" element={<Algorithm />} />
                </Route>
            </Routes>
        </HashRouter>
    </React.StrictMode>
);