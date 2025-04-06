import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Home, User, Upload, FileText, Clipboard, LayoutDashboard, BookOpen, MessageCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavigationProps {
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ className }) => {
  const location = useLocation();
  const { questionnaireCompleted } = useApp();
  const { language, setLanguage } = useLanguage();

  // Create translations object for multilingual support
  const translations = {
    en: {
      home: "Home",
      dashboard: "Dashboard",
      registration: "Registration",
      uploadReports: "Upload Reports",
      healthQuestionnaire: "Health Questionnaire",
      viewReports: "View Reports",
      summaryDashboard: "Summary Dashboard",
      blogs: "Blogs",
      chatbot: "Chatbot"
    },
    hi: {
      home: "होम",
      dashboard: "डैशबोर्ड",
      registration: "पंजीकरण",
      uploadReports: "रिपोर्ट अपलोड करें",
      healthQuestionnaire: "स्वास्थ्य प्रश्नावली",
      viewReports: "रिपोर्ट देखें",
      summaryDashboard: "सारांश डैशबोर्ड",
      blogs: "ब्लॉग",
      chatbot: "चैटबॉट"
    },
    bn: {
      home: "হোম",
      dashboard: "ড্যাশবোর্ড",
      registration: "নিবন্ধন",
      uploadReports: "রিপোর্ট আপলোড করুন",
      healthQuestionnaire: "স্বাস্থ্য প্রশ্নাবলী",
      viewReports: "রিপোর্ট দেখুন",
      summaryDashboard: "সারাংশ ড্যাশবোর্ড",
      blogs: "ব্লগ",
      chatbot: "চ্যাটবট"
    }
  };

  // Use the current language or fallback to English if the language doesn't exist
  const t = translations[language as keyof typeof translations] || translations.en;

  const navItems = [
    { name: t.registration, path: "/register", enabled: true, icon: <User size={16} className="mr-2" /> },
    { name: t.uploadReports, path: "/upload-reports", enabled: true, icon: <Upload size={16} className="mr-2" /> },
    { name: t.healthQuestionnaire, path: "/questionnaire", enabled: true, icon: <Clipboard size={16} className="mr-2" /> },
    { name: t.viewReports, path: "/view-reports", enabled: true, icon: <FileText size={16} className="mr-2" /> },
    { name: t.summaryDashboard, path: "/dashboard", enabled: true, icon: <LayoutDashboard size={16} className="mr-2" /> },
    { name: t.blogs, path: "/blogs", enabled: true, icon: <BookOpen size={16} className="mr-2" /> },
    { name: t.chatbot, path: "/chatbot", enabled: true, icon: <MessageCircle size={16} className="mr-2" /> },
  ];

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  return (
    <div className={cn("relative bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between", className)}>
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 hover:text-materna-700 transition-colors">
          <div className="w-8 h-8 bg-materna-600 rounded-full flex items-center justify-center">
            <Home className="text-white" size={16} />
          </div>
          <span className="font-medium text-sm">{t.home}</span>
        </Link>
        <Link to="/dashboard" className="flex items-center gap-2 hover:text-materna-700 transition-colors">
          <div className="w-8 h-8 bg-materna-100 rounded-full flex items-center justify-center">
            <LayoutDashboard className="text-materna-700" size={16} />
          </div>
          <span className="font-semibold text-sm">{t.dashboard}</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          {navItems.map((item) => (
            <div key={item.name} className="flex items-center">
              <Link
                to={item.enabled ? item.path : "#"}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors",
                  item.path === location.pathname ? "bg-materna-100 text-materna-700 font-medium" : "text-gray-600 hover:bg-gray-100",
                  !item.enabled && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                onClick={(e) => !item.enabled && e.preventDefault()}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
              {/* Add Language Dropdown after Chatbot */}
              {item.name === t.chatbot && (
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="ml-2 p-1 text-sm border border-gray-300 rounded bg-white"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                  <option value="bn">বাংলা</option>
                  <option value="as"> অসমীয়া</option>
                  <option value="gu">ગુજરાતી</option>
                  <option value="pu">ਪੰਜਾਬੀ</option>
                  <option value="mr">मराठी</option>
                  <option value="or">ଓଡ଼ିଆ</option>
                  <option value="ur">اُردُو</option>
                  <option value="ta">தமிழ்</option>
                  <option value="te">తెలుగు</option>
                  <option value="kn">ಕನ್ನಡ</option>
                  <option value="ml">മലയാളം</option>
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Navigation;