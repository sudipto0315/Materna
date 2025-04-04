// src/components/ProgressMetrics.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { useLanguage } from "@/contexts/LanguageContext"; // Import language hook
import axios from "axios"; // For translation API call
import { calculateGestationalAge, getTrimester, daysUntilDueDate } from "@/lib/utils";
import { Loader2 } from "lucide-react"; // For loading indicator

// Cache type (same as before)
type TranslationCache = {
    [lang: string]: {
        [originalText: string]: string;
    };
};

interface ProgressMetricsProps {
  showTitle?: boolean;
}

const ProgressMetrics: React.FC<ProgressMetricsProps> = ({ showTitle = false }) => {
  const { patientData } = useApp();
  const { language } = useLanguage(); // Get current language
  const translationCache = useRef<TranslationCache>({});

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // **1. Memoize originalContent**
  const originalContent = useMemo(() => ({
    title: "Pregnancy Progress",
    gestationalAgeLabel: "Current Gestational Age",
    weeksLabel: "weeks", // Individual word for combining
    daysLabel: "days", // Individual word for combining
    trimesterLabel: "Trimester",
    daysUntilDueLabel: "Days Until Due Date",
    loading: "Loading...",
    error: "Could not load data.", // Generic error for this component
  }), []);

  const [content, setContent] = useState(originalContent);

  // **2. Cached Translation Function** (Identical structure)
  const translateText = useCallback(async (text: string, targetLang: string): Promise<string> => {
    if (targetLang === "en" || !text) return text;

    // Check cache
    if (translationCache.current[targetLang]?.[text]) {
      return translationCache.current[targetLang][text];
    }

    // API Call
    try {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2?key=${import.meta.env.VITE_GOOGLE_API_KEY}`,
        { q: text, source: "en", target: targetLang, format: "text" }
      );
      const translatedText = response.data.data.translations[0].translatedText;

      // Store in cache
      if (!translationCache.current[targetLang]) {
        translationCache.current[targetLang] = {};
      }
      translationCache.current[targetLang][text] = translatedText;
      return translatedText;
    } catch (err) {
      console.error(`Translation error for text: "${text}" to ${targetLang}`, err);
      return text; // Fallback
    }
  }, []); // No dependencies

  // **3. Translate Content Function**
  const translateComponentContent = useCallback(async (targetLang: string) => {
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const translatedContent: typeof originalContent = {} as any; // Assert type
      const promises = Object.entries(originalContent).map(
        async ([key, value]) => {
          translatedContent[key as keyof typeof originalContent] = await translateText(value, targetLang);
        }
      );
      await Promise.all(promises);
      setContent(translatedContent);
    } catch (err) {
      console.error("Error translating ProgressMetrics content:", err);
      setTranslationError(originalContent.error); // Use fallback error message
      setContent(originalContent); // Revert to English
    } finally {
      setIsTranslating(false);
    }
  }, [originalContent, translateText]); // Dependencies are stable

  // **4. useEffect for Language Change**
  useEffect(() => {
    if (language === 'en') {
      setContent(originalContent);
      setIsTranslating(false);
      setTranslationError(null);
    } else {
      translateComponentContent(language);
    }
  }, [language, translateComponentContent, originalContent]); // Dependencies

  // --- Calculation Logic (remains the same) ---
  if (!patientData?.lmp || !patientData?.dueDate) {
     // Don't show anything if required data is missing
     // console.warn("ProgressMetrics: Missing LMP or Due Date."); // Optional warning
     return null;
  }

  let weeks: number | string = "-";
  let days: number | string = "-";
  let trimester: number | string = "-";
  let daysRemaining: number | string = "-";

  try {
      const lmpDate = new Date(patientData.lmp);
      const dueDate = new Date(patientData.dueDate);

      const age = calculateGestationalAge(lmpDate);
      weeks = age.weeks;
      days = age.days;
      trimester = getTrimester(lmpDate);
      daysRemaining = daysUntilDueDate(dueDate);
  } catch (calcError) {
      console.error("Error calculating progress metrics:", calcError);
      // Keep default error values ("-")
      // Optionally set a component-specific error state here
  }


  // --- Render Logic ---
  if (isTranslating) {
      return (
          <div className="flex justify-center items-center h-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
              <span>{content.loading || "Loading..."}</span>
          </div>
      );
  }

  if (translationError) {
       return <div className="text-center text-red-500 p-4">{translationError}</div>;
  }

  return (
    <div className="w-full">
      {showTitle && (
        <h2 className="text-xl font-semibold mb-4">{content.title}</h2>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Gestational Age Box */}
        <div className="bg-blue-50 p-4 sm:p-5 rounded-xl shadow-sm">
          <h3 className="text-center text-base sm:text-lg font-medium text-materna-400 mb-2 sm:mb-3">
            {content.gestationalAgeLabel}
          </h3>
          <p className="text-center text-lg sm:text-xl font-semibold text-gray-700">
             {/* Combine numbers with translated labels */}
            {weeks} {content.weeksLabel}, {days} {content.daysLabel}
          </p>
        </div>

        {/* Trimester Box */}
        <div className="bg-green-50 p-4 sm:p-5 rounded-xl shadow-sm">
          <h3 className="text-center text-base sm:text-lg font-medium text-materna-400 mb-2 sm:mb-3">
            {content.trimesterLabel}
          </h3>
          <p className="text-center text-lg sm:text-xl font-semibold text-gray-700">
            {trimester}
          </p>
        </div>

        {/* Days Until Due Date Box */}
        <div className="bg-red-50 p-4 sm:p-5 rounded-xl shadow-sm">
          <h3 className="text-center text-base sm:text-lg font-medium text-materna-400 mb-2 sm:mb-3">
            {content.daysUntilDueLabel}
          </h3>
          <p className="text-center text-lg sm:text-xl font-semibold text-gray-700">
            {daysRemaining}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProgressMetrics;