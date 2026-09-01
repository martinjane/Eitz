import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorProvider } from "@/contexts/EditorContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UsernameModal } from "@/components/UsernameModal";
import { AdOverlay } from "@/components/AdOverlay";
import { RolePickerModal } from "@/components/RolePickerModal";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Editor from "@/pages/Editor";
import Settings from "@/pages/Settings";
import Guide from "@/pages/Guide";
import SavedStyles from "@/pages/SavedStyles";
import AdvertisePage from "@/pages/AdvertisePage";
import AdminPage from "@/pages/AdminPage";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/editor" component={Editor} />
      <Route path="/settings" component={Settings} />
      <Route path="/guide" component={Guide} />
      <Route path="/saved-styles" component={SavedStyles} />
      <Route path="/advertise" component={AdvertisePage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Shows a full-screen block when the backend reports blocked=true
 * (TEST_MODE=false and no valid Eitaa session). Non-Eitaa users
 * cannot access or consume any app assets.
 */
function BlockedScreen() {
  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold text-foreground">دسترسی غیرمجاز</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          این برنامه فقط از طریق ایتا قابل دسترسی است.
          لطفاً از داخل اپلیکیشن ایتا باز کنید.
        </p>
      </div>
    </div>
  );
}

function AppInner() {
  const { blocked, configLoaded } = useAuth();

  // Before config arrives, show nothing — prevents flash of full app
  // followed by blocked screen in TEST_MODE=false
  if (!configLoaded) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (blocked) {
    return <BlockedScreen />;
  }

  return (
    <EditorProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <UsernameModal />
      <RolePickerModal />
      <AdOverlay />
    </EditorProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppInner />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
