import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Home, User, Upload, FileText, Clipboard, LayoutDashboard, BookOpen } from "lucide-react";

interface NavigationProps {
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ className }) => {
  const location = useLocation();
  const { questionnaireCompleted } = useApp();

  const navItems = [
    { 
      name: "Registration", 
      path: "/register", 
      enabled: true, 
      icon: <User size={16} className="mr-2" /> 
    },
    { 
      name: "Upload Reports", 
      path: "/upload-reports", 
      enabled: true,
      icon: <Upload size={16} className="mr-2" /> 
    },
    { 
      name: "Health Questionnaire", 
      path: "/questionnaire", 
      enabled: true,
      icon: <Clipboard size={16} className="mr-2" /> 
    },
    { 
      name: "View Reports", 
      path: "/view-reports", 
      enabled: true, 
      icon: <FileText size={16} className="mr-2" /> 
    },
    { 
      name: "Summary Dashboard", 
      path: "/dashboard", 
      enabled: true,
      icon: <LayoutDashboard size={16} className="mr-2" /> 
    },
    { 
      name: "Blogs", 
      path: "/blogs", 
      enabled: true, 
      icon: <BookOpen size={16} className="mr-2" /> 
    },
  ];

  return (
    <div className={cn("bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between", className)}>
      {/* Left Section: Back to Home and Dashboard */}
      <div className="flex items-center gap-4">
        <Link 
          to="/" 
          className="flex items-center gap-2 hover:text-materna-700 transition-colors"
        >
          <div className="w-8 h-8 bg-materna-600 rounded-full flex items-center justify-center">
            <Home className="text-white" size={16} />
          </div>
          <span className="font-medium text-sm">Home</span>
        </Link>

        <Link 
          to="/dashboard" 
          className="flex items-center gap-2 hover:text-materna-700 transition-colors"
        >
          <div className="w-8 h-8 bg-materna-100 rounded-full flex items-center justify-center">
            <LayoutDashboard className="text-materna-700" size={16} />
          </div>
          <span className="font-semibold text-sm">Dashboard</span>
        </Link>
      </div>

      {/* Right Section: Navigation Links */}
      <div className="flex items-center gap-2">
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
    </div>
  );
};

export default Navigation;