import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { AgencyProvider } from './context/AgencyContext';
import { ModelProvider } from './context/ModelContext';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AgencyProvider>
          <AuthProvider>
            <ModelProvider>
              <App />
            </ModelProvider>
          </AuthProvider>
        </AgencyProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
