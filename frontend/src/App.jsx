import React from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ScanPage from './pages/ScanPage';
import ScanDetailPage from './pages/ScanDetailPage';
import Settings from './pages/Settings';
import Docs from './pages/Docs';
import Header from './components/common/Header.jsx';
import { ToastHost } from './hooks/useToast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './App.css';

const AppContent = () => {
  const location = useLocation();
  return (
    <div className="min-h-screen font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
      <ToastHost />
      <Header />
      <main className="p-4 sm:p-6 lg:p-8">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/scan/:scanId" element={<ScanDetailPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/docs" element={<Docs />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;