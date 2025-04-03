// src/components/Navigation.tsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useLanguage } from "@/contexts/LanguageContext"; // Import useLanguage
import { cn } from "@/lib/utils";
import { Home, User, Upload, FileText, Clipboard, LayoutDashboard, BookOpen, MessageCircle } from "lucide-react";

interface NavigationProps {
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ className }) => {
  const location = useLocation();
  const { questionnaireCompleted } = useApp();
  const { language, setLanguage } = useLanguage(); // Access language context

  const navItems = [
    { name: "Registration", path: "/register", enabled: true, icon: <User size={16} className="mr-2" /> },
    { name: "Upload Reports", path: "/upload-reports", enabled: true, icon: <Upload size={16} className="mr-2" /> },
    { name: "Health Questionnaire", path: "/questionnaire", enabled: true, icon: <Clipboard size={16} className="mr-2" /> },
    { name: "View Reports", path: "/view-reports", enabled: true, icon: <FileText size={16} className="mr-2" /> },
    { name: "Summary Dashboard", path: "/dashboard", enabled: true, icon: <LayoutDashboard size={16} className="mr-2" /> },
    { name: "Blogs", path: "/blogs", enabled: true, icon: <BookOpen size={16} className="mr-2" /> },
    { name: "Chatbot", path: "/chatbot", enabled: true, icon: <MessageCircle size={16} className="mr-2" /> },
  ];

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  return (
    <div className={cn("bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between", className)}>
      {/* Left Section: Back to Home and Dashboard */}
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 hover:text-materna-700 transition-colors">
          <div className="w-8 h-8 bg-materna-600 rounded-full flex items-center justify-center">
            <Home className="text-white" size={16} />
          </div>
          <span className="font-medium text-sm">Home</span>
        </Link>
        <Link to="/dashboard" className="flex items-center gap-2 hover:text-materna-700 transition-colors">
          <div className="w-8 h-8 bg-materna-100 rounded-full flex items-center justify-center">
            {isRegistered ? <LayoutDashboard className="text-materna-700" size={16} /> : <User className="text-materna-700" size={16} />}
            <LayoutDashboard className="text-materna-700" size={16} />
          </div>
          <span className="font-semibold text-sm">{isRegistered ? "Dashboard" : "Register"}</span>
          <span className="font-semibold text-sm">Dashboard</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        {isRegistered ? (
          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
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
            ))}
          </div>
        ) : (
          <div className="text-sm bg-yellow-50 px-3 py-2 rounded-md">
            <span className="text-yellow-700 mr-2">Please register to access all features.</span>
            <Link to="/register" className="text-materna-600 font-medium hover:underline">Go to Registration</Link>
          </div>
        )}
        <div className="flex items-center gap-2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.enabled ? item.path : "#"}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors",
                item.path === location.pathname
                  ? "bg-materna-100 text-materna-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100",
                !item.enabled && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
              onClick={(e) => !item.enabled && e.preventDefault()}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
      {/* Language Dropdown */}
      <div className="absolute top-4 right-4">
        <select
          value={language}
          onChange={handleLanguageChange}
          className="p-2 text-sm border border-gray-300 rounded"
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="bn">Bengali</option>
        </select>
      </div>
    </div>
  );
};

export default Navigation;