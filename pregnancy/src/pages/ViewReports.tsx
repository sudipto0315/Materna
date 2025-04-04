import React, { useEffect, useState, useCallback, useMemo, useRef } from "react"; // Added useMemo, useRef
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, AlertTriangle, CheckCircle, Info, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react"; // Added Loader2
import { useLanguage } from "@/contexts/LanguageContext";
import axios from "axios";

// Simple cache type
type TranslationCache = {
    [lang: string]: { // Language code (e.g., 'hi')
        [originalText: string]: string; // Mapping from original English to translated text
    };
};

const ViewReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isRegistered, patientData, medicalReports } = useApp();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("all");
  const [isLoading, setIsLoading] = useState(false); // Keep track of translation loading
  const [error, setError] = useState<string | null>(null);

  // **1. Memoize originalContent to fix blinking**
  const originalContent = useMemo(() => ({
    pageTitle: "View Medical Reports",
    downloadJsonButton: "Download JSON Summary",
    uploadNewReportButton: "Upload New Report",
    patientLabel: "Patient:",
    // Keep placeholders here, we'll replace them *after* translation
    patientIdLabel: "ID: {id}",
    allReportsTab: "All Reports",
    bloodTestsTab: "Blood Tests",
    ultrasoundTab: "Ultrasound",
    infectiousTab: "Infectious",
    thyroidTab: "Thyroid & Genetic",
    otherTab: "Other",
    noReportsTitle: "No reports have been uploaded yet.",
    noReportsPrompt: "Go to the 'Upload Reports' section to add your medical reports.",
    uploadReportsButton: "Upload Reports",
    reportsTitle: "{type} Reports",
    viewButton: "View",
    categoryLabel: "Category: {category}",
    normalLabel: "Normal",
    borderlineLabel: "Borderline",
    highRiskLabel: "High Risk",
    testResultsTitle: "Test Results:",
    refLabel: "Ref: {range}",
    noAnalysisData: "No analysis data available for this report",
    loadingTranslations: "Loading translations...", // Added loading text
    translationError: "Failed to load translations.", // Added error text
  }), []); // Empty dependency array ensures it's created only once

  const [content, setContent] = useState(originalContent);

  // **2. Setup Translation Cache using useRef**
  const translationCache = useRef<TranslationCache>({});

  // **3. Update Translation Function with Cache**
  const translateText = useCallback(async (text: string, targetLang: string): Promise<string> => {
    if (targetLang === "en" || !text) return text; // No translation needed for English or empty strings

    // Check cache first
    if (translationCache.current[targetLang]?.[text]) {
        // console.log(`Cache hit for "${text}" in ${targetLang}`); // For debugging
        return translationCache.current[targetLang][text];
    }

    // console.log(`Cache miss for "${text}" in ${targetLang}, calling API...`); // For debugging
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

    } catch (err: any) {
      console.error(`Translation error for text: "${text}" to ${targetLang}`, err);
      // Don't set global error here, just return original text for this piece
      // Consider logging the specific error: err?.response?.data?.error?.message
      return text; // Fallback to original text on error
    }
  }, []); // No dependencies needed here

  // **4. Update translateContent to use cache and be stable**
  const translateContent = useCallback(async (targetLang: string) => {
    // console.log(`Translating content to: ${targetLang}`); // Debugging
    setIsLoading(true);
    setError(null); // Clear previous errors

    // Use Promise.all for potentially faster fetching (if API calls happen concurrently)
    const translationPromises = Object.entries(originalContent).map(
      async ([key, value]) => {
        const translatedValue = await translateText(value, targetLang);
        return [key, translatedValue]; // Return key-value pair
      }
    );

    try {
        const translatedEntries = await Promise.all(translationPromises);
        const translatedContentObject = Object.fromEntries(translatedEntries);
        setContent(translatedContentObject);
    } catch (err) {
         // This catch might not be strictly necessary if translateText handles its errors
         // but kept for safety.
        console.error("Error processing translations:", err);
        setError(originalContent.translationError); // Use the (now stable) original error message
        setContent(originalContent); // Fallback to English on major failure
    } finally {
        setIsLoading(false);
    }

  // Dependencies are stable: originalContent (memoized), translateText (useCallback with no deps)
  }, [originalContent, translateText]);

  // **5. Update useEffect with stable dependencies**
  useEffect(() => {
    if (language === "en") {
      setContent(originalContent); // Use stable originalContent
      setIsLoading(false);
      setError(null);
    } else {
      // Fetch translations if not English
      translateContent(language);
    }
  // Dependencies: language (from context), translateContent (now stable)
  }, [language, translateContent, originalContent]); // Added originalContent for clarity

  // --- Filter reports (no changes needed) ---
  const filteredReports = activeTab === "all"
    ? medicalReports
    : medicalReports.filter((report) => report.category === activeTab);

  // --- Group reports (no changes needed) ---
  const reportsByType = filteredReports.reduce((acc, report) => {
    const type = report.type || "custom"; // Handle potentially missing type
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(report);
    return acc;
  }, {} as Record<string, typeof medicalReports>);

  // --- JSON Download (no changes needed) ---
  const downloadJsonSummary = () => {
    // ... (keep existing logic)
     const allTestResults = medicalReports.flatMap((report) =>
      report.analysisResults?.all_results || []
    );
    const summary = {
      patientId: patientData.id,
      patientName: `${patientData.firstName} ${patientData.lastName}`,
      language: language, // Include language context
      allTestResults: allTestResults.map((result: any) => ({ // Added type annotation
        test_name: result.test_name, // Assume pre-translated
        result_value: result.result_value,
        result_unit: result.result_unit,
        risk_level: result.risk_level,
        direction: result.direction,
        reference_range: result.reference_range, // Assume pre-translated/formatted
        // Find the report this result belongs to for date/type
        date: medicalReports.find((r) =>
          r.analysisResults?.all_results?.some((ar: any) => ar === result) // Safer find
        )?.date,
        report_type: medicalReports.find((r) =>
           r.analysisResults?.all_results?.some((ar: any) => ar === result) // Safer find
        )?.type,
      })),
      generatedAt: new Date().toISOString(),
    };
    // ... (rest of download logic)
     const jsonString = JSON.stringify(summary, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `patient_${patientData.id}_summary_${language}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Render Logic ---
   if (!isRegistered) {
     // Optional: Handle this case better
     return <Layout><div className="container p-6">Please register or log in to view reports.</div></Layout>;
   }

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 animate-fade-in"> {/* Adjusted padding */}
        {/* **6. Improved Loading/Error Display ** */}
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-3" />
            <span>{content.loadingTranslations || "Loading..."}</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-600 bg-red-100 p-4 rounded border border-red-300 my-4">
              {content.translationError || "Failed to load translations."}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
              <h1 className="text-2xl font-bold">{content.pageTitle}</h1>
              <div className="flex gap-2 sm:gap-4">
                 {/* Disable download if no reports */}
                <Button
                    onClick={downloadJsonSummary}
                    className="materna-button"
                    disabled={medicalReports.length === 0}
                >
                  {content.downloadJsonButton}
                </Button>
                <Link to="/upload-reports">
                  <Button className="materna-button">
                    <Upload className="mr-2 h-4 w-4" />
                    {content.uploadNewReportButton}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Patient Info */}
            <Card className="mb-8">
              <CardHeader className="bg-blue-50 rounded-t-lg p-4"> {/* Adjusted padding */}
                <CardTitle>
                  {content.patientLabel} {patientData?.firstName || ''} {patientData?.lastName || ''} {/* Added safe access */}
                </CardTitle>
                <CardDescription>
                  {/* **7. Replace placeholder AFTER translation** */}
                  {content.patientIdLabel.replace("{id}", patientData?.patient_id || 'N/A')}
                </CardDescription>
              </CardHeader>
            </Card>

             {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-8">
              {/* Responsive Grid for Tabs */}
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
                <TabsTrigger value="all">{content.allReportsTab}</TabsTrigger>
                <TabsTrigger value="blood">{content.bloodTestsTab}</TabsTrigger>
                <TabsTrigger value="ultrasound">{content.ultrasoundTab}</TabsTrigger>
                <TabsTrigger value="infectious">{content.infectiousTab}</TabsTrigger>
                <TabsTrigger value="thyroid">{content.thyroidTab}</TabsTrigger>
                <TabsTrigger value="other">{content.otherTab}</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Reports Display */}
            {filteredReports.length === 0 ? (
               // ... (No Reports display - no changes needed) ...
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                    <div className="text-gray-400 bg-gray-100 p-6 rounded-full">
                        <FileText size={40} />
                    </div>
                    <h2 className="text-xl font-semibold">{content.noReportsTitle}</h2>
                    <p className="text-gray-500 mb-4">
                        {content.noReportsPrompt}
                    </p>
                    <Link to="/upload-reports">
                        <Button className="materna-button">
                            <Upload className="mr-2 h-4 w-4" />
                            {content.uploadReportsButton}
                        </Button>
                    </Link>
                </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(reportsByType).map(([type, reports]) => (
                  <div key={type} className="bg-white rounded-lg shadow-md p-4 sm:p-6"> {/* Adjusted padding */}
                    <h2 className="text-lg font-semibold mb-4 capitalize">
                      {/* **7. Replace placeholder AFTER translation** */}
                      {content.reportsTitle.replace("{type}", type.replace("-", " "))}
                    </h2>
                    <div className="grid gap-4">
                      {reports.map((report) => (
                        // Pass memoized originalContent and translated content
                        <ReportCard key={report.id} report={report} content={content} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

// --- Child Components ---

// **8. Update Child Components to handle placeholders and use content**

// Badge for risk levels
const RiskBadge: React.FC<{ riskLevel: string | null | undefined; content: Record<string, string> }> = ({ riskLevel, content }) => {
  const level = riskLevel || "unknown"; // Handle null/undefined

  switch (level) {
    case "high_risk":
      return (
        <Badge variant="destructive" className="flex gap-1 items-center whitespace-nowrap">
          <AlertTriangle size={12} />
          {content.highRiskLabel || "High Risk"} {/* Fallback */}
        </Badge>
      );
    case "borderline":
      return (
        <Badge variant="default" className="flex gap-1 items-center bg-yellow-500 text-black whitespace-nowrap"> {/* Ensure contrast */}
          <Info size={12} />
          {content.borderlineLabel || "Borderline"}
        </Badge>
      );
    case "normal":
      return (
        <Badge variant="outline" className="flex gap-1 items-center text-green-600 border-green-600 whitespace-nowrap">
          <CheckCircle size={12} />
          {content.normalLabel || "Normal"}
        </Badge>
      );
    default: // includes 'unknown'
       return (
          <Badge variant="secondary" className="flex gap-1 items-center whitespace-nowrap">
              {/* Optional: Add icon */}
              {content.unknownLabel || "Unknown"} {/* Added unknown label */}
          </Badge>
       );
  }
};

// Direction indicator (no changes needed for translation)
const DirectionIndicator: React.FC<{ direction: string | null | undefined }> = ({ direction }) => {
   switch (direction) {
    case "high":
    case "positive":
      return <ArrowUpRight className="text-red-500 flex-shrink-0" size={16} />;
    case "low":
      return <ArrowDownRight className="text-blue-500 flex-shrink-0" size={16} />;
    default:
      // Return empty span for alignment if no arrow
      return <span className="w-4 h-4 flex-shrink-0 inline-block"></span>;
  }
};

// Updated ReportCard component
const ReportCard: React.FC<{ report: any; content: Record<string, string> }> = ({ report, content }) => {
  const analysis = report.analysisResults;
  const reportDate = report.date ? new Date(report.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden">
       {/* Header */}
      <CardHeader className="pb-2 flex flex-row flex-wrap justify-between items-start gap-2 p-4"> {/* Adjusted padding */}
          <div>
              <CardTitle className="text-md">{reportDate}</CardTitle>
              <CardDescription className="text-xs">
                  {/* **7. Replace placeholder AFTER translation** */}
                  {content.categoryLabel?.replace("{category}", report.category || 'N/A') || `Category: ${report.category || 'N/A'}`}
              </CardDescription>
          </div>
          <Button
              size="sm"
              variant="ghost"
              onClick={() => report.fileUrl ? window.open(report.fileUrl, "_blank") : alert("Report file URL is missing.")}
              disabled={!report.fileUrl}
              className="whitespace-nowrap"
          >
              <FileText className="h-4 w-4 mr-1" />
              {content.viewButton || "View"}
          </Button>
      </CardHeader>

      {/* Content */}
      <CardContent className="pt-2 p-4"> {/* Adjusted padding */}
          {/* Notes */}
          {report.notes && (
              <CardDescription className="mb-2 text-sm italic">
                   {report.notes}
              </CardDescription>
          )}

          {/* Analysis Success */}
          {analysis && analysis.status === "success" && (
              <div className="mt-3">
                   {/* Summary Badges */}
                   <div className="flex flex-wrap gap-2 mb-3">
                      {analysis.normal_results > 0 && (
                          <Badge variant="outline" className="flex gap-1 text-green-600 border-green-600">
                              <CheckCircle size={12} />
                              {analysis.normal_results} {content.normalLabel || "Normal"}
                          </Badge>
                      )}
                      {analysis.borderline_results > 0 && (
                          <Badge variant="default" className="flex gap-1 bg-yellow-500 text-black">
                              <Info size={12} />
                              {analysis.borderline_results} {content.borderlineLabel || "Borderline"}
                          </Badge>
                      )}
                      {analysis.high_risk_results > 0 && (
                          <Badge variant="destructive" className="flex gap-1">
                              <AlertTriangle size={12} />
                              {analysis.high_risk_results} {content.highRiskLabel || "High Risk"}
                          </Badge>
                      )}
                  </div>

                  {/* Detailed Results */}
                  {analysis.all_results && analysis.all_results.length > 0 ? (
                      <div className="mt-4">
                          <h4 className="text-sm font-medium mb-2">{content.testResultsTitle || "Test Results:"}</h4>
                          <div className="space-y-1">
                              {analysis.all_results.map((result: any, index: number) => (
                                  <div
                                      key={index}
                                      className="p-2 rounded bg-gray-50 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2"
                                  >
                                      {/* Left: Indicator, Name, Value */}
                                      <div className="flex items-center gap-1 flex-grow min-w-0">
                                          <DirectionIndicator direction={result.direction} />
                                          <span className="font-medium truncate flex-shrink mr-1" title={result.test_name}>
                                              {result.test_name || 'N/A'}:
                                          </span>
                                          <span className="whitespace-nowrap">
                                              {result.result_value ?? 'N/A'}{' '}
                                              {result.result_unit}
                                          </span>
                                      </div>
                                      {/* Right: Ref Range, Risk */}
                                      <div className="flex items-center justify-end sm:justify-normal gap-2 flex-shrink-0">
                                          <span className="text-xs text-gray-500 text-right sm:text-left">
                                              {/* **7. Replace placeholder AFTER translation** */}
                                              {content.refLabel?.replace("{range}", result.reference_range || 'N/A') || `Ref: ${result.reference_range || 'N/A'}`}
                                          </span>
                                          <RiskBadge riskLevel={result.risk_level} content={content} />
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ) : (
                      // Optional: Message if analysis succeeded but no results parsed
                      <p className="text-xs text-gray-500 italic mt-3">{content.noAnalysisData || "No specific results found in analysis."}</p>
                  )}
              </div>
          )}

          {/* Analysis Failed / Not Available */}
          {!analysis && (
              <CardFooter className="bg-gray-50 py-2 px-4 mt-3 rounded-b"> {/* Adjusted padding */}
                  <span className="text-xs text-gray-500 italic">
                      {content.noAnalysisData || "No analysis data available for this report."}
                  </span>
              </CardFooter>
          )}
          {analysis && analysis.status !== "success" && (
               <CardFooter className="bg-red-50 py-2 px-4 mt-3 rounded-b text-red-700"> {/* Adjusted padding */}
                    <span className="text-xs italic flex items-center gap-1">
                       <AlertTriangle size={12} />
                       Analysis failed: {analysis.message || 'Unknown error'}
                    </span>
               </CardFooter>
          )}
      </CardContent>
    </Card>
  );
};

export default ViewReportsPage;