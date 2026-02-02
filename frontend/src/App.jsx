/**
 * App Component
 * Main application with routing
 */

import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { ImageGenPage } from './pages/ImageGen';
import { EditToolsPage } from './pages/EditTools';
import { VideoGenPage } from './pages/VideoGen';
import { ChatPage } from './pages/Chat';
import { GalleryPage } from './pages/Gallery';
import { TeamPage } from './pages/Team';
import { UsagePage } from './pages/Usage';
import { BrandingPage } from './pages/Branding';
import { SettingsPage } from './pages/Settings';
import { ModelsPage } from './pages/Models';
import { WorkflowsPage } from './pages/Workflows';
import { WorkflowEditorPage } from './pages/WorkflowEditor';
import { WorkflowRunPage } from './pages/WorkflowRun';
import { ContentRequestsPage } from './pages/ContentRequests';
import { ModelPortalPage } from './pages/ModelPortal';
import ModelInvitePage from './pages/ModelInvite';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Generation Routes */}
      <Route
        path="/generate/image"
        element={
          <ProtectedRoute>
            <ImageGenPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/generate/video"
        element={
          <ProtectedRoute>
            <VideoGenPage />
          </ProtectedRoute>
        }
      />

      {/* Tool Routes */}
      <Route
        path="/edit"
        element={
          <ProtectedRoute>
            <EditToolsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gallery"
        element={
          <ProtectedRoute>
            <GalleryPage />
          </ProtectedRoute>
        }
      />

      {/* Workflow Routes */}
      <Route
        path="/workflows"
        element={
          <ProtectedRoute>
            <WorkflowsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflows/:id"
        element={
          <ProtectedRoute>
            <WorkflowEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflows/:id/runs/:runId"
        element={
          <ProtectedRoute>
            <WorkflowRunPage />
          </ProtectedRoute>
        }
      />

      {/* Content Requests */}
      <Route
        path="/content-requests"
        element={
          <ProtectedRoute>
            <ContentRequestsPage />
          </ProtectedRoute>
        }
      />

      {/* Model Portal (public — no auth required, token in URL) */}
      <Route path="/portal/:token" element={<ModelPortalPage />} />

      {/* Model Invitation (public onboarding page) */}
      <Route path="/:agencySlug/model-invite/:token" element={<ModelInvitePage />} />

      {/* Admin Routes */}
      <Route
        path="/admin/models"
        element={
          <ProtectedRoute requireAdmin>
            <ModelsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/team"
        element={
          <ProtectedRoute requireAdmin>
            <TeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/usage"
        element={
          <ProtectedRoute requireAdmin>
            <UsagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/branding"
        element={
          <ProtectedRoute requireAdmin>
            <BrandingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute requireAdmin>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-text mb-2">404</h1>
              <p className="text-text-muted">Page not found</p>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default App;
