// src/pages/UploadReports.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"; // Added useMemo, useRef
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useLanguage } from "@/contexts/LanguageContext";
import axios from "axios";
import { toast } from "@/hooks/use-toast";
import { uploadFile, calculatePregnancyProgress } from "@/lib/utils";
import { analyzeReport } from "@/utils/reportAnalysis"; // Assuming analyzeReport handles language parameter
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProgressMetrics from "@/components/ProgressMetrics";
import { FileUp, Upload, AlertTriangle, Loader2 } from "lucide-react"; // Added Loader2
import MultiFileUploader, { ReportFile } from "@/components/MultiFileUploader";
// Removed unused UltrasoundImageUploader import
// import UltrasoundImageUploader from "@/components/UltrasoundImageUploader";

// Simple cache type
type TranslationCache = {
    [lang: string]: {
        [originalText: string]: string;
    };
};

// --- AnalysisDisplay Component (remains unchanged, assumes test names might be translated upstream) ---
const AnalysisDisplay: React.FC<{ result: any | null }> = ({ result }) => {
  if (!result) return null;

  // Helper to find and display a specific result
  // Assumes result.test_name might already be translated by analyzeReport
  const displaySpecificResult = (testNameKey: string, label: string) => {
    const testResult = result.all_results?.find((r: any) =>
      // Attempt matching common English variations or keys if test names aren't reliably translated
      r.test_name?.toLowerCase() === testNameKey.toLowerCase() ||
      r.test_name?.toLowerCase().includes(testNameKey.toLowerCase())
    );
    if (testResult) {
      return (
        <p>
          <span className="font-medium">{label}:</span> {testResult.result_value ?? 'N/A'}{' '}
          {testResult.reference_range && `(Ref: ${testResult.reference_range || 'N/A'}, Risk: ${testResult.risk_level || 'Unknown'})`}
        </p>
      );
    }
    return null;
  };

  // Determine best keys to search for based on report type
  let bloodGroupKey = "Blood Group";
  let rhFactorKey = "Rh Factor";
  let hivResultKey = "HIV Result"; // Adjust if analyzeReport uses different keys
  let hepBResultKey = "Hepatitis B Surface Antigen (HBsAg)"; // Adjust if analyzeReport uses different keys

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded">
      <h4 className="font-semibold mb-2">Analysis Summary</h4>
      {result.report_type === "blood-type" && (
        <div className="space-y-1">
          {displaySpecificResult(bloodGroupKey, "Blood Group")}
          {displaySpecificResult(rhFactorKey, "Rh Factor")}
        </div>
      )}
      {result.report_type === "hiv" && displaySpecificResult(hivResultKey, "HIV Result")}
      {result.report_type === "hepb" && displaySpecificResult(hepBResultKey, "Hepatitis B Result")}

      <p className="mt-2 text-sm">
          Total Tests: {result.total_tests ?? 0} |
          Normal: <span className="text-green-600">{result.normal_results ?? 0}</span> |
          Borderline: <span className="text-yellow-600">{result.borderline_results ?? 0}</span> |
          High Risk: <span className="text-red-600">{result.high_risk_results ?? 0}</span>
      </p>

      {result.risk_factors && result.risk_factors.length > 0 && (
        <div>
          <h5 className="font-medium mt-2 text-red-700">Risk Factors Identified:</h5>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {result.risk_factors.map((factor: any, index: number) => (
              <li key={index}>
                <span className="font-semibold">{factor.test_name}:</span> {factor.result_value} {factor.result_unit}{" "}
                (Ref: {factor.reference_range || 'N/A'}, Risk: <span className="font-semibold">{factor.risk_level}</span>)
              </li>
            ))}
          </ul>
        </div>
      )}
       {result.status === "warning" && (
          <p className="text-orange-600 text-sm mt-2">{result.message}</p>
       )}
    </div>
  );
};


// --- ReportUploadSection Component (Modified for Translation) ---
interface ReportUploadSectionProps {
    reportType: string;
    title: string; // Comes translated
    category: string;
    reportTypeOptions?: { value: string; label: string }[]; // Assuming labels here might need translation too if dynamic
    // Translated labels passed from parent
    labelReportType: string;
    labelSelectReportType: string;
    labelReportDate: string;
    labelUploadFile: string;
    labelNotes: string;
    placeholderNotes: string;
    buttonAnalyze: string;
    buttonAnalyzing: string;
}

const ReportUploadSection: React.FC<ReportUploadSectionProps> = ({
    reportType,
    title,
    category,
    reportTypeOptions,
    // Translated props
    labelReportType,
    labelSelectReportType,
    labelReportDate,
    labelUploadFile,
    labelNotes,
    placeholderNotes,
    buttonAnalyze,
    buttonAnalyzing,
}) => {
  const { patientData, addMedicalReport } = useApp();
  const { language } = useLanguage(); // Get language for analyzeReport
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [file, setFile] = useState<File | null>(null); // Correct type
  const [notes, setNotes] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any | null>(null); // Type for analysis result
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState(reportType || reportTypeOptions?.[0]?.value || ""); // Default if possible

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setAnalysisResult(null); // Clear previous analysis when file changes
    } else {
      setFile(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast({ title: "No file selected", description: "Please select a file.", variant: "destructive" });
      return;
    }
    const typeToAnalyze = selectedReportType || reportType; // Use selected if available, else default
    if (!typeToAnalyze || (reportTypeOptions && !reportTypeOptions.some(opt => opt.value === typeToAnalyze))) {
        toast({ title: "Report type missing", description: "Please select or confirm the report type.", variant: "destructive" });
        return;
    }
    if (!patientData?.patient_id) {
         toast({ title: "Patient ID Missing", description: "Cannot analyze without patient ID.", variant: "destructive" });
         return;
    }

    setAnalyzing(true);
    setAnalysisResult(null); // Clear previous result

    try {
      // --- Call analyzeReport with language ---
      const analysis = await analyzeReport(
        file,
        typeToAnalyze,
        language as 'en' | 'hi' | 'bn', // Pass current language
        patientData.patient_id,
        date
      );

      setAnalysisResult(analysis); // Display analysis result regardless of status initially

      if (analysis.status === "success" || analysis.status === "error") {
        // Even if analysis has warnings, try to upload/add the report
        const fileUrl = await uploadFile(file); // Consider uploading only if analysis is not 'error'
        const newReport = {
          id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: typeToAnalyze,
          category,
          date,
          fileUrl,
          notes,
          analysisResults: analysis, // Store the full analysis object
        };
        addMedicalReport(newReport); // Add report to global state
        toast({
          title: analysis.status === "error" ? "Analysis Warning" : "Analysis Complete",
          description: analysis.message || `Report analyzed ${analysis.status === "error" ? 'with warnings' : 'successfully'}.`,
          variant: analysis.status === "error" ? "default" : "default", // Or use a specific warning style
        });
      } else { // Handle analysis errors
        toast({
          title: "Analysis Failed",
          description: analysis.message || "Could not analyze the report.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error During Analysis",
        description: error?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      console.error("Analysis process error:", error);
      // Set a generic error analysis state if needed
      setAnalysisResult({ status: 'error', message: 'An unexpected error occurred during analysis.' });
    } finally {
      setAnalyzing(false);
    }
  };

  // Pre-translate report type options if needed (complex, depends on source)
  // For now, assuming option labels are generally understandable or managed elsewhere
  const translatedReportTypeOptions = reportTypeOptions; // Placeholder

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {/* Report Type Selection */}
      {translatedReportTypeOptions && (
        <div>
          <Label htmlFor={`report-type-${category}`}>{labelReportType}</Label>
          <Select value={selectedReportType} onValueChange={setSelectedReportType}>
            <SelectTrigger id={`report-type-${category}`}>
              <SelectValue placeholder={labelSelectReportType} />
            </SelectTrigger>
            <SelectContent>
              {translatedReportTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} {/* Assuming label might be English */}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Report Date */}
      <div>
        <Label htmlFor={`${category}-${reportType}-date`}>{labelReportDate}</Label>
        <Input
          id={`${category}-${reportType}-date`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      {/* File Upload */}
      <div>
        <Label htmlFor={`${category}-${reportType}-file`}>{labelUploadFile}</Label>
        <Input
          id={`${category}-${reportType}-file`}
          type="file"
          accept=".pdf" // Only PDFs for analysis
          onChange={handleFileChange}
        />
      </div>
      {/* Notes */}
      <div>
        <Label htmlFor={`${category}-${reportType}-notes`}>{labelNotes}</Label>
        <Textarea
          id={`${category}-${reportType}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={placeholderNotes}
        />
      </div>
      {/* Analyze Button */}
      <Button
        onClick={handleAnalyze}
        disabled={analyzing || !file}
        className="w-full materna-button"
      >
        {analyzing ? (
            <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {buttonAnalyzing}
            </span>
        ) : (
            buttonAnalyze
        )}
      </Button>
      {/* Analysis Display */}
      {analysisResult && <AnalysisDisplay result={analysisResult} />}
    </div>
  );
};


// --- UploadReportsPage Component (Main Component) ---
const UploadReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientData, addMedicalReport, getCategoryReportCount } = useApp();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("blood");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false); // Separate analyzing state for multi-upload section
  const [reportType, setReportType] = useState("cbc"); // Default for current tab
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<ReportFile[]>([]);

  // Translation state management
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const translationCache = useRef<TranslationCache>({});

  // **1. Memoize originalContent**
  const originalContent = useMemo(() => ({
    title: "Upload Medical Reports",
    patientLabel: "Patient:",
    patientIdLabel: "ID:", // Added label for ID
    timeline: "Pregnancy Timeline",
    tabs: {
      blood: "Blood Tests",
      ultrasound: "Ultrasound Reports",
      infectious: "Infectious Disease Screening",
      thyroid: "Thyroid & Genetic Tests",
      other: "Other Reports",
    },
    bloodTestHeader: "Blood Test Reports",
    bloodCBCReportTitle: "Blood CBC Report",
    bloodTypingReportTitle: "Blood Typing Report",
    glucoseFastingReportTitle: "Glucose Fasting Report",
    ultrasoundHeader: "Ultrasound Reports",
    ultrasoundTypeLabel: "Ultrasound Type",
    selectUltrasoundTypePlaceholder: "Select Ultrasound Type", // Added placeholder
    scanDateLabel: "Scan Date / Report Date", // Combined Label
    gestationalAgeLabel: "Gestational Age at Scan (weeks)", // Optional field
    notesLabel: "Notes (Optional)",
    uploadButton: "Upload Reports",
    uploadingButton: "Uploading...",
    analyzeButton: "Analyze Reports",
    analyzingButton: "Analyzing...",
    infectiousHeader: "Infectious Disease Screening",
    hivReportTitle: "HIV/AIDS Report",
    hepBReportTitle: "Hepatitis B Report",
    thyroidHeader: "Thyroid & Genetic Tests",
    tshReportTitle: "TSH Report",
    geneticTestReportTitle: "Genetic Test Report", // Removed optional hint
    otherHeader: "Other Reports",
    reportTypeLabel: "Report Type",
    otherReportPlaceholder: "Enter report type (e.g., Urinalysis)", // Added placeholder
    multiUploadSectionNotesPlaceholder: "Add notes for all selected reports in this section...",
    // Labels for ReportUploadSection
    labelReportType: "Report Type",
    labelSelectReportType: "Select Report Type",
    labelReportDate: "Report Date",
    labelUploadFile: "Upload File (PDF)",
    labelNotes: "Notes (Optional)",
    placeholderNotes: "Add any specific notes for this report...",
    buttonAnalyze: "Analyze Report",
    buttonAnalyzing: "Analyzing...",
    // Loading/Error messages
    loadingTranslations: "Loading translations...",
    translationError: "Failed to load translations.",
    // Report Type Options (Labels might need translation, complex)
    reportTypes: {
       cbc: "Complete Blood Count (CBC)",
       hemoglobin: "Hemoglobin Test",
       platelet: "Platelet Count",
       "blood-type": "Blood Typing",
       glucose: "Glucose Fasting Test",
       dating: "Dating Scan",
       anatomy: "Anatomy Scan",
       growth: "Growth Scan",
       doppler: "Doppler Ultrasound",
       "3d-4d": "3D/4D Ultrasound",
       hiv: "HIV/AIDS Test",
       "hep-c": "Hepatitis C Test",
       hepb: "Hepatitis B Test",
       tsh: "Thyroid-Stimulating Hormone (TSH)",
       t4: "Thyroxine (T4)",
       t3: "Triiodothyronine (T3)",
       nips: "Non-Invasive Prenatal Screening (NIPS)",
       nipt: "Non-Invasive Prenatal Testing (NIPT)",
       cfdna: "Cell-Free DNA Screening",
       carrier: "Carrier Screening",
       amnio: "Amniocentesis Results",
       cvs: "Chorionic Villus Sampling (CVS) Results",
    }
  }), []);

  const [content, setContent] = useState(originalContent);

  // **2. Update Translation Function with Cache** (Identical to ViewReportsPage)
  const translateText = useCallback(async (text: string | Record<string, string>, targetLang: string): Promise<string | Record<string, string>> => {
    if (targetLang === "en" || !text) return text;

    const translateSingleString = async (str: string): Promise<string> => {
        if (!str) return ""; // Handle empty strings
        // Check cache first
        if (translationCache.current[targetLang]?.[str]) {
            return translationCache.current[targetLang][str];
        }
        // API Call
        try {
            const response = await axios.post(
                `https://translation.googleapis.com/language/translate/v2?key=${import.meta.env.VITE_GOOGLE_API_KEY}`,
                { q: str, source: "en", target: targetLang, format: "text" }
            );
            const translatedText = response.data.data.translations[0].translatedText;
            // Store in cache
            if (!translationCache.current[targetLang]) {
                translationCache.current[targetLang] = {};
            }
            translationCache.current[targetLang][str] = translatedText;
            return translatedText;
        } catch (err: any) {
            console.error(`Translation error for text: "${str}" to ${targetLang}`, err);
            return str; // Fallback
        }
    };

    if (typeof text === 'string') {
        return translateSingleString(text);
    }

    if (typeof text === 'object' && text !== null) {
        const translatedObject: Record<string, string> = {};
        const promises = Object.entries(text).map(async ([key, value]) => {
            translatedObject[key] = await translateSingleString(value);
        });
        await Promise.all(promises);
        return translatedObject;
    }

    return text; // Should not happen
  }, []); // No dependencies needed

  // **3. Update translateContent**
  const translateContent = useCallback(async (targetLang: string) => {
    setIsTranslating(true);
    setTranslationError(null);
    try {
        const translatedContent = { ...originalContent }; // Start fresh
        const promises = Object.entries(originalContent).map(
            async ([key, value]) => {
                translatedContent[key as keyof typeof originalContent] = await translateText(value, targetLang) as any;
            }
        );
        await Promise.all(promises);
        setContent(translatedContent);
    } catch (err) {
        console.error("Error translating page content:", err);
        setTranslationError(originalContent.translationError); // Use stable English fallback
        setContent(originalContent); // Revert to English
    } finally {
        setIsTranslating(false);
    }
  }, [originalContent, translateText]);

  // **4. Update useEffect for Translation**
  useEffect(() => {
    if (language === 'en') {
      setContent(originalContent);
      setIsTranslating(false);
      setTranslationError(null);
    } else {
      translateContent(language);
    }
  }, [language, translateContent, originalContent]);


  // --- Existing Logic ---
  const categoryMap: Record<string, string> = {
    blood: "blood",
    ultrasound: "ultrasound",
    infectious: "infectious",
    thyroid: "thyroid",
    other: "other",
  };

  useEffect(() => {
    setSelectedFiles([]); // Clear files when tab changes
    setNotes(""); // Clear notes when tab changes
    // Set default report type based on the new active tab
    const defaultReportTypes: Record<string, string> = {
      blood: "cbc",
      ultrasound: "dating",
      infectious: "hiv",
      thyroid: "tsh",
      other: "custom", // Or empty string for manual input
    };
    setReportType(defaultReportTypes[activeTab] || "custom");
  }, [activeTab]);

  // Simplified handleUpload (uses MultiFileUploader) - Focuses on adding metadata
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No files selected", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
        const currentCategory = categoryMap[activeTab];
        let successCount = 0;
        for (const selectedFile of selectedFiles) {
            const fileUrl = await uploadFile(selectedFile.file);
            const newReport = {
                id: `report_${Date.now()}_${selectedFile.id}`, // Use file ID for uniqueness
                type: reportType, // Use the type selected for the section
                category: currentCategory,
                date: reportDate,
                fileUrl,
                notes: notes, // Use the common notes field for the section
                analysisResults: null, // No analysis done on simple upload
            };
            const added = addMedicalReport(newReport);
            if (added) successCount++;
        }

        if (successCount > 0) {
            toast({ title: "Upload successful", description: `${successCount} report(s) uploaded.` });
            setSelectedFiles([]); // Clear selection
            setNotes(""); // Clear notes
        }
        if (successCount < selectedFiles.length) {
            toast({ title: "Some uploads skipped", description: "Category limits might be reached.", variant: "destructive" });
        }

    } catch (error) {
        toast({ title: "Upload failed", description: "An error occurred during upload.", variant: "destructive" });
        console.error("Upload error:", error);
    } finally {
        setUploading(false);
    }
  };

  // Simplified handleAnalyze (uses MultiFileUploader) - Analyzes selected files
  const handleAnalyze = async () => {
     if (selectedFiles.length === 0) {
        toast({ title: "No files selected", description: "Select files to analyze.", variant: "destructive" });
        return;
     }
     if (!patientData?.patient_id) {
         toast({ title: "Patient ID Missing", description: "Cannot analyze without patient ID.", variant: "destructive" });
         return;
     }
     setAnalyzing(true);
     let reportsAddedCount = 0;
     let highRiskCount = 0;
     let borderlineCount = 0;

     try {
        const currentCategory = categoryMap[activeTab];
        for (const selectedFile of selectedFiles) {
            console.log(`Analyzing file: ${selectedFile.file.name}, Type: ${reportType}, Lang: ${language}`);
            const analysis = await analyzeReport(
                selectedFile.file,
                reportType, // Use the type selected for the section
                language as 'en' | 'hi' | 'bn', // Pass current language
                patientData.patient_id,
                reportDate
            );

            // Process regardless of analysis status to potentially save the report with error/warning
            const fileUrl = await uploadFile(selectedFile.file); // Upload the file

            const newReport = {
                id: `report_${Date.now()}_${selectedFile.id}`,
                type: reportType,
                category: currentCategory,
                date: reportDate,
                fileUrl,
                notes: notes, // Use common notes for the batch
                analysisResults: analysis, // Store the full result (including status/message)
            };

            const added = addMedicalReport(newReport); // Add to context
            if (added) {
                 reportsAddedCount++;
                 if (analysis.status === 'success' || analysis.status === 'warning') {
                     highRiskCount += analysis.high_risk_results || 0;
                     borderlineCount += analysis.borderline_results || 0;
                 }
                 // Optionally show individual analysis status toasts
                 // toast({ title: `Analyzed: ${selectedFile.file.name}`, description: analysis.message || analysis.status, variant: analysis.status === 'error' ? 'destructive' : 'default' });
            } else {
                 // Handle case where adding report failed (e.g., limit reached)
                 toast({ title: `Could not add ${selectedFile.file.name}`, description: "Category limit might be reached.", variant: "destructive" });
            }
        } // End loop

        // Show summary toast
        if (reportsAddedCount > 0) {
             let summaryTitle = "Analysis Complete";
             let summaryDesc = `${reportsAddedCount} report(s) processed.`;
             let summaryVariant: "default" | "destructive" = "default";

             if (highRiskCount > 0) {
                 summaryTitle = "High Risk Detected";
                 summaryDesc += ` Found ${highRiskCount} high risk factor(s).`;
                 summaryVariant = "destructive";
             } else if (borderlineCount > 0) {
                 summaryTitle = "Borderline Results Detected";
                 summaryDesc += ` Found ${borderlineCount} borderline result(s).`;
             } else if (highRiskCount === 0 && borderlineCount === 0) {
                 summaryDesc += " No major risks detected.";
             }
             toast({ title: summaryTitle, description: summaryDesc, variant: summaryVariant });
             setSelectedFiles([]); // Clear selection
             setNotes(""); // Clear notes
             navigate("/view-reports"); // Navigate after successful processing
        } else {
             toast({ title: "Analysis Failed", description: "No reports could be processed.", variant: "destructive" });
        }

     } catch (error: any) {
         toast({ title: "Analysis Error", description: error?.message || "An unexpected error occurred.", variant: "destructive" });
         console.error("Bulk analysis error:", error);
     } finally {
         setAnalyzing(false);
     }
  };

  const getUsedSlots = (category: string): number => {
    return getCategoryReportCount(category);
  };

  // Render Helper for Report Type Options (to avoid repetition)
  const renderReportTypeOptions = (typeKeys: string[]) => {
      return typeKeys.map(key => ({
          value: key,
          // Use translated label from content.reportTypes, fallback to original
          label: content.reportTypes?.[key] || originalContent.reportTypes[key] || key
      }));
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 animate-fade-in">
        {isTranslating ? (
           <div className="flex justify-center items-center h-40">
               <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-3" />
               <span>{content.loadingTranslations || "Loading..."}</span>
           </div>
        ) : translationError ? (
           <div className="text-center text-red-600 bg-red-100 p-4 rounded border border-red-300 my-4">
              {translationError}
           </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-6">{content.title}</h1>
            {/* Patient Card */}
            <Card className="mb-8">
              <CardHeader className="bg-blue-50 rounded-t-lg p-4">
                <CardTitle className="text-xl">
                  {content.patientLabel} {patientData?.firstName || ''} {patientData?.lastName || ''}
                </CardTitle>
                <CardDescription>
                   {content.patientIdLabel} {patientData?.patient_id || 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 p-4">
                <ProgressMetrics /> {/* Assumes this component handles its own text or needs props */}
              </CardContent>
            </Card>

            {/* Timeline */}
            {patientData?.lmp && (
                 <div className="mb-8">
                   <h2 className="text-lg font-semibold mb-4">{content.timeline}</h2>
                   <Progress progress={calculatePregnancyProgress(new Date(patientData.lmp))} />
                 </div>
             )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-8">
                <TabsTrigger value="blood">{content.tabs?.blood}</TabsTrigger>
                <TabsTrigger value="ultrasound">{content.tabs?.ultrasound}</TabsTrigger>
                <TabsTrigger value="infectious">{content.tabs?.infectious}</TabsTrigger>
                <TabsTrigger value="thyroid">{content.tabs?.thyroid}</TabsTrigger>
                <TabsTrigger value="other">{content.tabs?.other}</TabsTrigger>
              </TabsList>

              {/* --- Tab Content --- */}

              {/* Blood Tests Tab */}
              <TabsContent value="blood">
                <h2 className="text-lg font-semibold mb-6">{content.bloodTestHeader}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Pass translated props to ReportUploadSection */}
                  <ReportUploadSection
                    reportType="cbc"
                    title={content.bloodCBCReportTitle}
                    category="blood"
                    reportTypeOptions={renderReportTypeOptions(['cbc', 'hemoglobin', 'platelet'])}
                    labelReportType={content.labelReportType}
                    labelSelectReportType={content.labelSelectReportType}
                    labelReportDate={content.labelReportDate}
                    labelUploadFile={content.labelUploadFile}
                    labelNotes={content.labelNotes}
                    placeholderNotes={content.placeholderNotes}
                    buttonAnalyze={content.buttonAnalyze}
                    buttonAnalyzing={content.buttonAnalyzing}
                  />
                  <ReportUploadSection
                    reportType="blood-type"
                    title={content.bloodTypingReportTitle}
                    category="blood"
                    reportTypeOptions={renderReportTypeOptions(['blood-type'])}
                     labelReportType={content.labelReportType}
                    labelSelectReportType={content.labelSelectReportType}
                    labelReportDate={content.labelReportDate}
                    labelUploadFile={content.labelUploadFile}
                    labelNotes={content.labelNotes}
                    placeholderNotes={content.placeholderNotes}
                    buttonAnalyze={content.buttonAnalyze}
                    buttonAnalyzing={content.buttonAnalyzing}
                  />
                   <ReportUploadSection
                    reportType="glucose"
                    title={content.glucoseFastingReportTitle}
                    category="blood"
                    reportTypeOptions={renderReportTypeOptions(['glucose'])}
                    labelReportType={content.labelReportType}
                    labelSelectReportType={content.labelSelectReportType}
                    labelReportDate={content.labelReportDate}
                    labelUploadFile={content.labelUploadFile}
                    labelNotes={content.labelNotes}
                    placeholderNotes={content.placeholderNotes}
                    buttonAnalyze={content.buttonAnalyze}
                    buttonAnalyzing={content.buttonAnalyzing}
                  />
                </div>
              </TabsContent>

              {/* Ultrasound Tab (Uses MultiFileUploader) */}
              <TabsContent value="ultrasound">
                <h2 className="text-lg font-semibold mb-6">{content.ultrasoundHeader}</h2>
                <div className="grid gap-6 p-4 border rounded-lg">
                  {/* Ultrasound Type Select */}
                  <div className="space-y-2">
                    <Label htmlFor="ultrasound-type">{content.ultrasoundTypeLabel}</Label>
                    <Select value={reportType} onValueChange={(value) => setReportType(value)}>
                      <SelectTrigger id="ultrasound-type">
                        <SelectValue placeholder={content.selectUltrasoundTypePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                         {renderReportTypeOptions(['dating', 'anatomy', 'growth', 'doppler', '3d-4d']).map(opt => (
                             <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                         ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* File Uploader */}
                  <MultiFileUploader
                    selectedFiles={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    maxFiles={3} // Example limit
                    category="ultrasound"
                    usedSlots={getUsedSlots("ultrasound")}
                  />
                  {/* Common Date */}
                  <div className="space-y-2">
                    <Label htmlFor="ultrasound-date">{content.scanDateLabel}</Label>
                    <Input
                      id="ultrasound-date"
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                  </div>
                  {/* Optional Gestational Age */}
                  <div className="space-y-2">
                    <Label htmlFor="gestational-age">{content.gestationalAgeLabel}</Label>
                    <Input id="gestational-age" type="number" placeholder="e.g., 20" />
                  </div>
                  {/* Common Notes */}
                   <div className="space-y-2">
                    <Label htmlFor="ultrasound-notes">{content.notesLabel}</Label>
                    <Textarea
                      id="ultrasound-notes"
                      placeholder={content.multiUploadSectionNotesPlaceholder}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || uploading || analyzing} className="materna-button w-full">
                          {uploading ? <span className="flex items-center gap-2 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> {content.uploadingButton}</span> : <span className="flex items-center gap-2 justify-center"><Upload size={18} /> {content.uploadButton}</span>}
                      </Button>
                      <Button onClick={handleAnalyze} disabled={selectedFiles.length === 0 || uploading || analyzing} variant="outline" className="w-full border-blue-500 text-blue-600 hover:bg-blue-50">
                          {analyzing ? <span className="flex items-center gap-2 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> {content.analyzingButton}</span> : <span className="flex items-center gap-2 justify-center"><AlertTriangle size={18} /> {content.analyzeButton}</span>}
                      </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Infectious Disease Tab */}
              <TabsContent value="infectious">
                <h2 className="text-lg font-semibold mb-6">{content.infectiousHeader}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <ReportUploadSection
                    reportType="hiv" // Default type for this section
                    title={content.hivReportTitle}
                    category="infectious"
                    reportTypeOptions={renderReportTypeOptions(['hiv', 'hep-c', 'hepb'])} // Allow selection
                     labelReportType={content.labelReportType}
                    labelSelectReportType={content.labelSelectReportType}
                    labelReportDate={content.labelReportDate}
                    labelUploadFile={content.labelUploadFile}
                    labelNotes={content.labelNotes}
                    placeholderNotes={content.placeholderNotes}
                    buttonAnalyze={content.buttonAnalyze}
                    buttonAnalyzing={content.buttonAnalyzing}
                  />
                   <ReportUploadSection
                    reportType="hepb" // Default type for this section
                    title={content.hepBReportTitle}
                    category="infectious"
                    reportTypeOptions={renderReportTypeOptions(['hiv', 'hep-c', 'hepb'])} // Allow selection
                    labelReportType={content.labelReportType}
                    labelSelectReportType={content.labelSelectReportType}
                    labelReportDate={content.labelReportDate}
                    labelUploadFile={content.labelUploadFile}
                    labelNotes={content.labelNotes}
                    placeholderNotes={content.placeholderNotes}
                    buttonAnalyze={content.buttonAnalyze}
                    buttonAnalyzing={content.buttonAnalyzing}
                  />
                </div>
              </TabsContent>

              {/* Thyroid & Genetic Tab */}
               <TabsContent value="thyroid">
                <h2 className="text-lg font-semibold mb-6">{content.thyroidHeader}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <ReportUploadSection
                    reportType="tsh"
                    title={content.tshReportTitle}
                    category="thyroid"
                    reportTypeOptions={renderReportTypeOptions(['tsh', 't4', 't3'])}
                    labelReportType={content.labelReportType}
                    labelSelectReportType={content.labelSelectReportType}
                    labelReportDate={content.labelReportDate}
                    labelUploadFile={content.labelUploadFile}
                    labelNotes={content.labelNotes}
                    placeholderNotes={content.placeholderNotes}
                    buttonAnalyze={content.buttonAnalyze}
                    buttonAnalyzing={content.buttonAnalyzing}
                  />
                  <ReportUploadSection
                    reportType="cfdna" // Default to common genetic screen
                    title={content.geneticTestReportTitle}
                    category="thyroid" // Keeping in thyroid/genetic category
                    reportTypeOptions={renderReportTypeOptions(['nips', 'nipt', 'cfdna', 'carrier', 'amnio', 'cvs'])}
                    labelReportType={content.labelReportType}
                    labelSelectReportType={content.labelSelectReportType}
                    labelReportDate={content.labelReportDate}
                    labelUploadFile={content.labelUploadFile}
                    labelNotes={content.labelNotes}
                    placeholderNotes={content.placeholderNotes}
                    buttonAnalyze={content.buttonAnalyze}
                    buttonAnalyzing={content.buttonAnalyzing}
                  />
                </div>
              </TabsContent>

              {/* Other Reports Tab (Uses MultiFileUploader) */}
              <TabsContent value="other">
                 <h2 className="text-lg font-semibold mb-6">{content.otherHeader}</h2>
                 <div className="grid gap-6 p-4 border rounded-lg">
                    {/* Manual Report Type Input */}
                    <div className="space-y-2">
                        <Label htmlFor="other-report-type">{content.reportTypeLabel}</Label>
                        <Input
                            id="other-report-type"
                            placeholder={content.otherReportPlaceholder}
                            value={reportType === 'custom' ? '' : reportType} // Clear if default 'custom'
                            onChange={(e) => setReportType(e.target.value || "custom")} // Set to custom if empty
                        />
                    </div>
                    {/* File Uploader */}
                    <MultiFileUploader
                        selectedFiles={selectedFiles}
                        onFilesChange={setSelectedFiles}
                        maxFiles={3} // Example limit
                        category="other"
                        usedSlots={getUsedSlots("other")}
                    />
                     {/* Common Date */}
                    <div className="space-y-2">
                        <Label htmlFor="other-date">{content.scanDateLabel}</Label>
                        <Input
                            id="other-date"
                            type="date"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                        />
                    </div>
                     {/* Common Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="other-notes">{content.notesLabel}</Label>
                        <Textarea
                            id="other-notes"
                            placeholder={content.multiUploadSectionNotesPlaceholder}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                     {/* Action Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || uploading || analyzing} className="materna-button w-full">
                            {uploading ? <span className="flex items-center gap-2 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> {content.uploadingButton}</span> : <span className="flex items-center gap-2 justify-center"><Upload size={18} /> {content.uploadButton}</span>}
                        </Button>
                        <Button onClick={handleAnalyze} disabled={selectedFiles.length === 0 || uploading || analyzing || !reportType || reportType === 'custom'} variant="outline" className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"> {/* Disable analyze if type is empty/custom */}
                            {analyzing ? <span className="flex items-center gap-2 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> {content.analyzingButton}</span> : <span className="flex items-center gap-2 justify-center"><AlertTriangle size={18} /> {content.analyzeButton}</span>}
                        </Button>
                    </div>
                 </div>
              </TabsContent>

            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
};

// --- Progress Component (remains unchanged) ---
const Progress: React.FC<{ progress: number }> = ({ progress }) => {
  const clampedProgress = Math.max(0, Math.min(100, progress)); // Ensure 0-100
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
      <div
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
};

export default UploadReportsPage;