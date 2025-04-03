// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./contexts/AppContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import HomePage from "./pages/Index";
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import Dashboard from "./pages/Dashboard";
import RegisterPage from "./pages/Register";
import UploadReportsPage from "./pages/UploadReports";
import QuestionnaireForm from "./pages/Questionnaire";
import ViewReportsPage from "./pages/ViewReports";
import NotFound from "./pages/NotFound";
import BookAppointmentPage from "./pages/BookAppointment";
import Blogs from "./pages/Blogs";
import ChatbotPage from "./pages/Chatbot";

const queryClient = new QueryClient();

const App = () => (
  <LanguageProvider> {/* Wrap with LanguageProvider */}
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/upload-reports" element={<UploadReportsPage />} />
              <Route path="/questionnaire" element={<QuestionnaireForm />} />
              <Route path="/view-reports" element={<ViewReportsPage />} />
              <Route path="/book-appointment" element={<BookAppointmentPage />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/chatbot" element={<ChatbotPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  </LanguageProvider>
);

export default App;