import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import '../css/app.css';
import './bootstrap';

function AppLayout() {
    return (
        <div className="min-h-dvh p-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">SignalFeed</h1>
            </header>
            <main className="mt-4" role="main">
                <Outlet />
            </main>
        </div>
    );
}

function PlaceholderHome() {
    return (
        <p className="text-neutral-600 dark:text-neutral-400">
            SPA scaffold — thêm route trong các task sau.
        </p>
    );
}

const rootEl = document.getElementById('root');

if (rootEl) {
    createRoot(rootEl).render(
        <StrictMode>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<AppLayout />}>
                        <Route index element={<PlaceholderHome />} />
                        <Route path="*" element={<PlaceholderHome />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </StrictMode>
    );
}
