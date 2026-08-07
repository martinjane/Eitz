import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorProvider } from "@/contexts/EditorContext";
import { AuthProvider } from "@/contexts/AuthContext";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <EditorProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <UsernameModal />
            <RolePickerModal />
            <AdOverlay />
          </EditorProvider>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
