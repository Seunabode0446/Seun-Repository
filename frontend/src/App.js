import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { InteractiveProvider } from './contexts/InteractiveContext';
import { CollaborationProvider } from './contexts/CollaborationContext';
import { NotificationProvider } from './contexts/NotificationContext';

import Layout from './components/common/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Enhanced Interactive Dashboard imports
import InteractiveStaffDashboard from './pages/dashboards/InteractiveStaffDashboard';
import InteractiveAdminDashboard from './pages/dashboards/InteractiveAdminDashboard';
import InteractiveClientDashboard from './pages/dashboards/InteractiveClientDashboard';
import InteractiveReportingDashboard from './pages/dashboards/InteractiveReportingDashboard';
import InteractiveAlertsDashboard from './pages/dashboards/InteractiveAlertsDashboard';

// Interactive Feature imports
import InteractiveClientList from './pages/clients/InteractiveClientList';
import InteractiveClientDetail from './pages/clients/InteractiveClientDetail';
import InteractiveProgressNotes from './pages/notes/InteractiveProgressNotes';
import InteractiveTimesheets from './pages/timesheets/InteractiveTimesheets';
import InteractiveIncidents from './pages/incidents/InteractiveIncidents';
import InteractiveDocuments from './pages/documents/InteractiveDocuments';
import InteractiveUserManagement from './pages/admin/InteractiveUserManagement';
import InteractiveCompliance from './pages/admin/InteractiveCompliance';

// New Interactive Features
import WorkflowBuilder from './pages/workflow/WorkflowBuilder';
import CollaborativeWorkspace from './pages/collaboration/CollaborativeWorkspace';
import AnalyticsDashboard from './pages/analytics/AnalyticsDashboard';
import InteractiveCalendar from './pages/calendar/InteractiveCalendar';

// Enhanced theme with dynamic capabilities
const createDynamicTheme = (mode = 'light', primaryColor = '#1976d2') => createTheme({
  palette: {
    mode,
    primary: {
      main: primaryColor,
      light: mode === 'light' ? '#42a5f5' : '#64b5f6',
      dark: mode === 'light' ? '#1565c0' : '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: mode === 'light' ? '#f5f5f5' : '#121212',
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
    },
    text: {
      primary: mode === 'light' ? '#333333' : '#ffffff',
      secondary: mode === 'light' ? '#666666' : '#b3b3b3',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '2.125rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: primaryColor,
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${mode === 'light' ? '#e0e0e0' : '#333333'}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'light' ? '#fafafa' : '#1a1a1a',
          borderRight: `1px solid ${mode === 'light' ? '#e0e0e0' : '#333333'}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: mode === 'light' 
            ? '0 4px 20px rgba(0,0,0,0.1)' 
            : '0 4px 20px rgba(0,0,0,0.3)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: mode === 'light' 
              ? '0 8px 30px rgba(0,0,0,0.15)' 
              : '0 8px 30px rgba(0,0,0,0.4)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          transition: 'all 0.2s ease-in-out',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: primaryColor,
              },
            },
          },
        },
      },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <AnimatePresence mode="wait">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" replace />} />
        
        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          {/* Dashboard routes */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={
            user?.role === 'admin' || user?.role === 'supervisor' ? 
              <InteractiveAdminDashboard /> : 
              user?.role === 'staff' ? 
                <InteractiveStaffDashboard /> : 
                <InteractiveClientDashboard />
          } />
          
          {/* Interactive Staff routes */}
          <Route path="notes" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <InteractiveProgressNotes />
            </ProtectedRoute>
          } />
          <Route path="timesheets" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <InteractiveTimesheets />
            </ProtectedRoute>
          } />
          
          {/* Interactive Client management routes */}
          <Route path="clients" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <InteractiveClientList />
            </ProtectedRoute>
          } />
          <Route path="clients/:id" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <InteractiveClientDetail />
            </ProtectedRoute>
          } />
          
          {/* Interactive Incident management */}
          <Route path="incidents" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <InteractiveIncidents />
            </ProtectedRoute>
          } />
          
          {/* Interactive Document management */}
          <Route path="documents" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <InteractiveDocuments />
            </ProtectedRoute>
          } />
          
          {/* Interactive Reporting */}
          <Route path="reports" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <InteractiveReportingDashboard />
            </ProtectedRoute>
          } />
          
          {/* Interactive Alerts */}
          <Route path="alerts" element={
            <ProtectedRoute>
              <InteractiveAlertsDashboard />
            </ProtectedRoute>
          } />
          
          {/* Interactive Admin routes */}
          <Route path="admin/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <InteractiveUserManagement />
            </ProtectedRoute>
          } />
          <Route path="admin/compliance" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <InteractiveCompliance />
            </ProtectedRoute>
          } />
          
          {/* New Interactive Features */}
          <Route path="workflow" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <WorkflowBuilder />
            </ProtectedRoute>
          } />
          <Route path="collaboration" element={
            <ProtectedRoute>
              <CollaborativeWorkspace />
            </ProtectedRoute>
          } />
          <Route path="analytics" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <AnalyticsDashboard />
            </ProtectedRoute>
          } />
          <Route path="calendar" element={
            <ProtectedRoute>
              <InteractiveCalendar />
            </ProtectedRoute>
          } />
        </Route>
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [themeMode, setThemeMode] = useState('light');
  const [primaryColor, setPrimaryColor] = useState('#1976d2');
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    // Check if running in embedded mode
    const urlParams = new URLSearchParams(window.location.search);
    const embedded = urlParams.get('embedded') === 'true';
    const theme = urlParams.get('theme') || 'light';
    const color = urlParams.get('color') || '#1976d2';
    
    setIsEmbedded(embedded);
    setThemeMode(theme);
    setPrimaryColor(color);

    // Apply embedded styles
    if (embedded) {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
    }

    // Listen for theme changes from parent window
    const handleMessage = (event) => {
      if (event.data.type === 'theme-change') {
        setThemeMode(event.data.mode);
        setPrimaryColor(event.data.color);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const theme = createDynamicTheme(themeMode, primaryColor);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <SocketProvider>
            <InteractiveProvider>
              <CollaborationProvider>
                <NotificationProvider>
                  <Router>
                    <AppRoutes />
                    <Toaster 
                      position="top-right"
                      toastOptions={{
                        duration: 4000,
                        style: {
                          background: themeMode === 'dark' ? '#333' : '#fff',
                          color: themeMode === 'dark' ? '#fff' : '#333',
                          borderRadius: '12px',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                          backdropFilter: 'blur(10px)',
                        },
                        success: {
                          iconTheme: {
                            primary: '#10B981',
                            secondary: '#fff',
                          },
                        },
                        error: {
                          iconTheme: {
                            primary: '#EF4444',
                            secondary: '#fff',
                          },
                        },
                      }}
                    />
                  </Router>
                </NotificationProvider>
              </CollaborationProvider>
            </InteractiveProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;