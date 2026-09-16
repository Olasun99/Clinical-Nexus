import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Triage from './pages/Triage';
import Appointments from './pages/Appointments';
import Records from './pages/Records';
import NavigationPage from './pages/Navigation';
import Intake from './pages/Intake';
import Financials from './pages/Financials';
import Admin from './pages/Admin';
import Emergency from './pages/Emergency';
import { Activity } from 'lucide-react';

import { ErrorBoundary } from './components/ErrorBoundary';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen bg-main-bg flex items-center justify-center"><Activity className="animate-spin text-blue-500" /></div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

function LayoutWrapper() {
  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<LayoutWrapper />}>
              <Route path="/" element={<Home />} />
              <Route path="/triage" element={<Triage />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/records" element={<Records />} />
              <Route path="/navigation" element={<NavigationPage />} />
              <Route path="/intake" element={<Intake />} />
              <Route path="/financials" element={<Financials />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/emergency" element={<Emergency />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
