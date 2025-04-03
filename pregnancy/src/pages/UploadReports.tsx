// src/pages/UploadReports.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useLanguage } from "@/contexts/LanguageContext"; // Import useLanguage
import axios from "axios";
import { toast } from "@/hooks/use-toast";
import { uploadFile, calculatePregnancyProgress } from "@/lib/utils";
import { analyzeReport } from "@/utils/reportAnalysis";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProgressMetrics from "@/components/ProgressMetrics";
import { FileUp, Upload, AlertTriangle } from "lucide-react";
import MultiFileUploader, { ReportFile } from "@/components/MultiFileUploader";

// AnalysisDisplay Component (unchanged)
const AnalysisDisplay = ({ result }) => {
  if (!result) return null;

  const displaySpecificResult = (testName, label) => {
    const testResult = result.all_results.find((r) => r.test_name === testName);
    if (testResult) {
      return (
        <p>
          {label}: {testResult.result_value}{" "}
          {testResult.ref_range_text && `(Reference: ${testResult.ref_range_text}, Risk Level: ${testResult.risk_level})`}
        </p>
      );
    }
    return null;
  };

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded">
      <h4 className="font-semibold">Analysis Results</h4>
      {result.report_type === "blood-type" && (
        <div>
          {displaySpecificResult("Blood Group", "Blood Group")}
          {displaySpecificResult("Rh Factor", "Rh Factor")}
        </div>
      )}
      {result.report_type === "hiv" && displaySpecificResult("HIV Result", "HIV Result")}
      {result.report_type === "hepb" && displaySpecificResult("Hepatitis B Result", "Hepatitis B Result")}
      <p>Total Tests: {result.total_tests}</p>
      <p>Normal Results: {result.normal_results}</p>
      <p>Borderline Results: {result.borderline_results}</p>
      <p>High Risk Results: {result.high_risk_results}</p>
      {result.risk_factors.length > 0 && (
        <div>
          <h5 className="font-medium mt-2">Risk Factors:</h5>
          <ul className="list-disc pl-5">
            {result.risk_factors.map((factor, index) => (
              <li key={index}>
                {factor.test_name}: {factor.result_value} {factor.result_unit}{" "}
                (Reference: {factor.reference_range}, Risk Level: {factor.risk_level})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ReportUploadSection Component (modified to accept translated props)
const ReportUploadSection = ({ reportType, title, category, reportTypeOptions }) => {
  const { patientData, addMedicalReport } = useApp();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState(reportType || "");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to analyze.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedReportType && reportTypeOptions) {
      toast({
        title: "No report type selected",
        description: "Please select a report type.",
        variant: "destructive",
      });
      return;
    }
    setAnalyzing(true);
    try {
      const fileUrl = await uploadFile(file);
      const analysis = await analyzeReport(
        file,
        selectedReportType || reportType,
        patientData.patient_id,
        date
      );
      if (analysis.status === "success") {
        const newReport = {
          id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: selectedReportType || reportType,
          category,
          date,
          fileUrl,
          notes,
          analysisResults: analysis,
        };
        addMedicalReport(newReport);
        setAnalysisResult(analysis);
        toast({
          title: "Analysis complete",
          description: "Report has been analyzed successfully.",
        });
      } else {
        toast({
          title: "Analysis failed",
          description: analysis.message || "Failed to analyze the report.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while analyzing the report.",
        variant: "destructive",
      });
      console.error("Analysis error:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {reportTypeOptions && (
        <div className="mb-4">
          <Label htmlFor="report-type">Report Type</Label>
          <Select value={selectedReportType} onValueChange={setSelectedReportType}>
            <SelectTrigger>
              <SelectValue placeholder="Select Report Type" />
            </SelectTrigger>
            <SelectContent>
              {reportTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="mb-4">
        <Label htmlFor={`${title}-date`}>Report Date</Label>
        <Input
          id={`${title}-date`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="mb-4">
        <Label htmlFor={`${title}-file`}>Upload File</Label>
        <Input
          id={`${title}-file`}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
        />
      </div>
      <div className="mb-4">
        <Label htmlFor={`${title}-notes`}>Notes</Label>
        <Textarea
          id={`${title}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes..."
        />
      </div>
      <Button
        onClick={handleAnalyze}
        disabled={analyzing || !file}
        className="w-full"
      >
        {analyzing ? "Analyzing..." : "Analyze Report"}
      </Button>
      {analysisResult && <AnalysisDisplay result={analysisResult} />}
    </div>
  );
};

// UploadReportsPage Component (with translation)
const UploadReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientData, medicalReports, addMedicalReport, getCategoryReportCount } = useApp();
  const { language } = useLanguage(); // Access language context
  const [activeTab, setActiveTab] = useState("blood");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reportType, setReportType] = useState("cbc");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<ReportFile[]>([]);

  // Translation states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalContent] = useState({
    title: "Upload Medical Reports",
    patientLabel: "Patient:",
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
    scanDateLabel: "Scan Date",
    gestationalAgeLabel: "Gestational Age at Scan (weeks)",
    notesLabel: "Notes",
    uploadButton: "Upload Reports",
    analyzeButton: "Analyze for Risks",
    infectiousHeader: "Infectious Disease Screening",
    hivReportTitle: "HIV/AIDS Report",
    hepBReportTitle: "Hepatitis B Report",
    thyroidHeader: "Thyroid & Genetic Tests",
    tshReportTitle: "TSH Report",
    geneticTestReportTitle: "Genetic Test Report (Optional)",
    otherHeader: "Other Reports",
    reportTypeLabel: "Report Type",
  });
  const [content, setContent] = useState(originalContent);

  // Translation function
  const translateText = async (text: string, targetLang: string) => {
    if (targetLang === 'en') return text;
    try {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2?key=${import.meta.env.VITE_GOOGLE_API_KEY}`,
        {
          q: text,
          source: 'en',
          target: targetLang,
          format: 'text',
        }
      );
      return response.data.data.translations[0].translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      setError('Failed to translate content.');
      return text;
    }
  };

  const translateContent = useCallback(async (targetLang: string) => {
    setIsLoading(true);
    setError(null);
    const translatedContent = { ...originalContent };

    // Translate top-level fields
    translatedContent.title = await translateText(originalContent.title, targetLang);
    translatedContent.patientLabel = await translateText(originalContent.patientLabel, targetLang);
    translatedContent.timeline = await translateText(originalContent.timeline, targetLang);
    translatedContent.bloodTestHeader = await translateText(originalContent.bloodTestHeader, targetLang);
    translatedContent.bloodCBCReportTitle = await translateText(originalContent.bloodCBCReportTitle, targetLang);
    translatedContent.bloodTypingReportTitle = await translateText(originalContent.bloodTypingReportTitle, targetLang);
    translatedContent.glucoseFastingReportTitle = await translateText(originalContent.glucoseFastingReportTitle, targetLang);
    translatedContent.ultrasoundHeader = await translateText(originalContent.ultrasoundHeader, targetLang);
    translatedContent.ultrasoundTypeLabel = await translateText(originalContent.ultrasoundTypeLabel, targetLang);
    translatedContent.scanDateLabel = await translateText(originalContent.scanDateLabel, targetLang);
    translatedContent.gestationalAgeLabel = await translateText(originalContent.gestationalAgeLabel, targetLang);
    translatedContent.notesLabel = await translateText(originalContent.notesLabel, targetLang);
    translatedContent.uploadButton = await translateText(originalContent.uploadButton, targetLang);
    translatedContent.analyzeButton = await translateText(originalContent.analyzeButton, targetLang);
    translatedContent.infectiousHeader = await translateText(originalContent.infectiousHeader, targetLang);
    translatedContent.hivReportTitle = await translateText(originalContent.hivReportTitle, targetLang);
    translatedContent.hepBReportTitle = await translateText(originalContent.hepBReportTitle, targetLang);
    translatedContent.thyroidHeader = await translateText(originalContent.thyroidHeader, targetLang);
    translatedContent.tshReportTitle = await translateText(originalContent.tshReportTitle, targetLang);
    translatedContent.geneticTestReportTitle = await translateText(originalContent.geneticTestReportTitle, targetLang);
    translatedContent.otherHeader = await translateText(originalContent.otherHeader, targetLang);
    translatedContent.reportTypeLabel = await translateText(originalContent.reportTypeLabel, targetLang);

    // Translate nested tabs
    translatedContent.tabs = {
      blood: await translateText(originalContent.tabs.blood, targetLang),
      ultrasound: await translateText(originalContent.tabs.ultrasound, targetLang),
      infectious: await translateText(originalContent.tabs.infectious, targetLang),
      thyroid: await translateText(originalContent.tabs.thyroid, targetLang),
      other: await translateText(originalContent.tabs.other, targetLang),
    };

    setContent(translatedContent);
    setIsLoading(false);
  }, [originalContent]);

  useEffect(() => {
    if (language === 'en') {
      setContent(originalContent);
      setIsLoading(false);
      setError(null);
    } else {
      translateContent(language);
    }
  }, [language, translateContent]);

  // Existing logic (unchanged)
  const categoryMap: Record<string, string> = {
    blood: "blood",
    ultrasound: "ultrasound",
    infectious: "infectious",
    thyroid: "thyroid",
    other: "other",
  };

  useEffect(() => {
    setSelectedFiles([]);
    const defaultReportTypes: Record<string, string> = {
      blood: "cbc",
      ultrasound: "dating",
      infectious: "hiv",
      thyroid: "tsh",
      other: "custom",
    };
    setReportType(defaultReportTypes[activeTab] || "custom");
  }, [activeTab]);

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const currentCategory = categoryMap[activeTab];
      const promises = selectedFiles.map(async (selectedFile) => {
        const fileUrl = await uploadFile(selectedFile.file);

        const newReport = {
          id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: reportType,
          category: currentCategory,
          date: reportDate,
          fileUrl,
          notes,
        };

        return addMedicalReport(newReport);
      });

      const results = await Promise.all(promises);
      const successCount = results.filter((result) => result).length;

      if (successCount > 0) {
        toast({
          title: "Upload successful",
          description: `${successCount} report(s) have been uploaded successfully.`,
        });
      }

      if (successCount < selectedFiles.length) {
        toast({
          title: "Some uploads skipped",
          description: "Some reports were not uploaded due to category limits.",
          variant: "destructive",
        });
      }

      setSelectedFiles([]);
      setNotes("");
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your reports. Please try again.",
        variant: "destructive",
      });
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 || !patientData.patient_id) {
      toast({
        title: "Cannot analyze report",
        description: "Please select at least one file and ensure your patient information is complete.",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);

    try {
      const currentCategory = categoryMap[activeTab];
      let successCount = 0;
      let highRiskCount = 0;
      let borderlineCount = 0;

      for (const selectedFile of selectedFiles) {
        const analysisResults = await analyzeReport(
          selectedFile.file,
          reportType,
          patientData.patient_id || "unknown",
          reportDate
        );

        if (analysisResults.status === "error") {
          toast({
            title: "Analysis failed",
            description: analysisResults.message || `Failed to analyze ${selectedFile.file.name}`,
            variant: "destructive",
          });
          continue;
        }

        highRiskCount += analysisResults.high_risk_results || 0;
        borderlineCount += analysisResults.borderline_results || 0;

        const fileUrl = await uploadFile(selectedFile.file);

        const newReport = {
          id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: reportType,
          category: currentCategory,
          date: reportDate,
          fileUrl,
          notes,
          analysisResults,
        };

        const added = addMedicalReport(newReport);
        if (added) successCount++;
      }

      if (successCount > 0) {
        if (highRiskCount > 0) {
          toast({
            title: "High Risk Factors Detected",
            description: `Found ${highRiskCount} high risk factors in your reports.`,
            variant: "destructive",
          });
        } else if (borderlineCount > 0) {
          toast({
            title: "Borderline Results Detected",
            description: `Found ${borderlineCount} borderline results in your reports.`,
            variant: "default",
          });
        } else {
          toast({
            title: "Analysis Complete",
            description: "No risk factors detected in your reports. Everything looks normal.",
            variant: "default",
          });
        }

        setSelectedFiles([]);
        setNotes("");
        navigate("/view-reports");
      } else {
        toast({
          title: "No reports processed",
          description: "No reports could be processed. Please check category limits.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: "There was an error analyzing your reports. Please try again.",
        variant: "destructive",
      });
      console.error("Analysis error:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const getUsedSlots = () => {
    return getCategoryReportCount(categoryMap[activeTab]);
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 animate-fade-in">
        {isLoading ? (
          <p>Loading translations...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-6">{content.title}</h1>
            <Card className="mb-8">
              <CardHeader className="bg-blue-50 rounded-t-lg">
                <CardTitle className="text-xl">
                  {content.patientLabel} {patientData.firstName} {patientData.lastName}
                </CardTitle>
                <CardDescription>ID: {patientData.patient_id}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ProgressMetrics />
              </CardContent>
            </Card>
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">{content.timeline}</h2>
              <Progress progress={patientData.lmp ? calculatePregnancyProgress(new Date(patientData.lmp)) : 0} />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-5 mb-8">
                <TabsTrigger value="blood">{content.tabs.blood}</TabsTrigger>
                <TabsTrigger value="ultrasound">{content.tabs.ultrasound}</TabsTrigger>
                <TabsTrigger value="infectious">{content.tabs.infectious}</TabsTrigger>
                <TabsTrigger value="thyroid">{content.tabs.thyroid}</TabsTrigger>
                <TabsTrigger value="other">{content.tabs.other}</TabsTrigger>
              </TabsList>
              <TabsContent value="blood">
                <h2 className="text-lg font-semibold mb-6">{content.bloodTestHeader}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ReportUploadSection
                    reportType="cbc"
                    title={content.bloodCBCReportTitle}
                    category="blood"
                    reportTypeOptions={[
                      { value: "cbc", label: "Complete Blood Count (CBC)" },
                      { value: "hemoglobin", label: "Hemoglobin Test" },
                      { value: "platelet", label: "Platelet Count" },
                    ]}
                  />
                  <ReportUploadSection
                    reportType="blood-type"
                    title={content.bloodTypingReportTitle}
                    category="blood"
                    reportTypeOptions={[{ value: "blood-type", label: "Blood Typing" }]}
                  />
                  <ReportUploadSection
                    reportType="glucose"
                    title={content.glucoseFastingReportTitle}
                    category="blood"
                    reportTypeOptions={[{ value: "glucose", label: "Glucose Fasting Test" }]}
                  />
                </div>
              </TabsContent>
              <TabsContent value="ultrasound">
                <h2 className="text-lg font-semibold mb-6">{content.ultrasoundHeader}</h2>
                <div className="grid gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="ultrasound-type">{content.ultrasoundTypeLabel}</Label>
                    <Select value={reportType} onValueChange={(value) => setReportType(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Ultrasound Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dating">Dating Scan</SelectItem>
                        <SelectItem value="anatomy">Anatomy Scan</SelectItem>
                        <SelectItem value="growth">Growth Scan</SelectItem>
                        <SelectItem value="doppler">Doppler Ultrasound</SelectItem>
                        <SelectItem value="3d-4d">3D/4D Ultrasound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <MultiFileUploader
                    selectedFiles={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    maxFiles={3}
                    category="ultrasound"
                    usedSlots={getUsedSlots()}
                  />
                  <div className="space-y-3">
                    <Label htmlFor="test-date">{content.scanDateLabel}</Label>
                    <Input
                      id="test-date"
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="gestational-age">{content.gestationalAgeLabel}</Label>
                    <Input
                      id="gestational-age"
                      type="number"
                      placeholder="e.g., 20"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="notes">{content.notesLabel}</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any notes about this scan..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={handleUpload}
                      disabled={selectedFiles.length === 0 || uploading || analyzing}
                      className="materna-button w-full"
                    >
                      {uploading ? (
                        <span className="flex items-center gap-2">
                          <FileUp className="animate-pulse" size={18} />
                          Uploading...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Upload size={18} />
                          {content.uploadButton}
                        </span>
                      )}
                    </Button>
                    <Button
                      onClick={handleAnalyze}
                      disabled={selectedFiles.length === 0 || uploading || analyzing}
                      variant="outline"
                      className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      {analyzing ? (
                        <span className="flex items-center gap-2">
                          <FileUp className="animate-pulse" size={18} />
                          Analyzing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <AlertTriangle size={18} />
                          {content.analyzeButton}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="infectious">
                <h2 className="text-lg font-semibold mb-6">{content.infectiousHeader}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ReportUploadSection
                    reportType="hiv"
                    title={content.hivReportTitle}
                    category="infectious"
                    reportTypeOptions={[
                      { value: "hiv", label: "HIV/AIDS Test" },
                      { value: "hep-c", label: "Hepatitis C Test" },
                      { value: "hepb", label: "Hepatitis B Test" },
                    ]}
                  />
                  <ReportUploadSection
                    reportType="hepb"
                    title={content.hepBReportTitle}
                    category="infectious"
                    reportTypeOptions={[
                      { value: "hiv", label: "HIV/AIDS Test" },
                      { value: "hep-c", label: "Hepatitis C Test" },
                      { value: "hepb", label: "Hepatitis B Test" },
                    ]}
                  />
                </div>
              </TabsContent>
              <TabsContent value="thyroid">
                <h2 className="text-lg font-semibold mb-6">{content.thyroidHeader}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ReportUploadSection
                    reportType="tsh"
                    title={content.tshReportTitle}
                    category="thyroid"
                    reportTypeOptions={[
                      { value: "tsh", label: "Thyroid-Stimulating Hormone (TSH)" },
                      { value: "t4", label: "Thyroxine (T4)" },
                      { value: "t3", label: "Triiodothyronine (T3)" },
                    ]}
                  />
                  <ReportUploadSection
                    reportType="nips"
                    title={content.geneticTestReportTitle}
                    category="thyroid"
                    reportTypeOptions={[
                      { value: "nips", label: "Non-Invasive Prenatal Screening (NIPS)" },
                      { value: "nipt", label: "Non-Invasive Prenatal Testing (NIPT)" },
                      { value: "cfdna", label: "Cell-Free DNA Screening" },
                      { value: "carrier", label: "Carrier Screening" },
                      { value: "amnio", label: "Amniocentesis Results" },
                      { value: "cvs", label: "Chorionic Villus Sampling (CVS) Results" },
                    ]}
                  />
                </div>
              </TabsContent>
              <TabsContent value="other">
                <h2 className="text-lg font-semibold mb-6">{content.otherHeader}</h2>
                <div className="grid gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="other-report-type">{content.reportTypeLabel}</Label>
                    <Input
                      id="other-report-type"
                      placeholder="Enter report type..."
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                    />
                  </div>
                  <MultiFileUploader
                    selectedFiles={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    maxFiles={3}
                    category="other"
                    usedSlots={getUsedSlots()}
                  />
                  <div className="space-y-3">
                    <Label htmlFor="report-date">{content.scanDateLabel}</Label>
                    <Input
                      id="report-date"
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="notes">{content.notesLabel}</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any notes about this report..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={handleUpload}
                      disabled={selectedFiles.length === 0 || uploading || analyzing}
                      className="materna-button w-full"
                    >
                      {uploading ? (
                        <span className="flex items-center gap-2">
                          <FileUp className="animate-pulse" size={18} />
                          Uploading...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Upload size={18} />
                          {content.uploadButton}
                        </span>
                      )}
                    </Button>
                    <Button
                      onClick={handleAnalyze}
                      disabled={selectedFiles.length === 0 || uploading || analyzing}
                      variant="outline"
                      className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      {analyzing ? (
                        <span className="flex items-center gap-2">
                          <FileUp className="animate-pulse" size={18} />
                          Analyzing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <AlertTriangle size={18} />
                          {content.analyzeButton}
                        </span>
                      )}
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

// Progress Component (unchanged)
const Progress: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
      <div
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-in-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default UploadReportsPage;