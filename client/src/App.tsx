import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Box, CircularProgress } from '@mui/material'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Visitors from './pages/Visitors'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Guard from './pages/Guard'
import Signup from './pages/Signup'
import ResidentAudit from './pages/ResidentAudit'

function App() {
  const { user, loading, isAuthenticated } = useAuthStore()

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    )
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/visitors" element={<Visitors />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/audit" element={<ResidentAudit />} />
          
          {/* Role-based routes */}
          {user?.roles?.includes('admin') && (
            <Route path="/admin" element={<Admin />} />
          )}
          
          {user?.roles?.includes('guard') && (
            <Route path="/guard" element={<Guard />} />
          )}
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  )
}

export default App
