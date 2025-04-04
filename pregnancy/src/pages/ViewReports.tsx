import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, AlertTriangle, CheckCircle, Info, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext"; // Import useLanguage hook
import axios from "axios";

const ViewReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isRegistered, patientData, medicalReports } = useApp();
  const { language } = useLanguage(); // Access language context from navigation bar
  const [activeTab, setActiveTab] = useState("all");

  // Translation states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalContent] = useState({
    pageTitle: "View Medical Reports",
    downloadJsonButton: "Download JSON Summary",
    uploadNewReportButton: "Upload New Report",
    patientLabel: "Patient:", // Simplified to avoid placeholder issues during translation
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
  });
  const [content, setContent] = useState(originalContent);



  // Filter reports based on active tab
  const filteredReports = activeTab === "all"
    ? medicalReports
    : medicalReports.filter((report) => report.category === activeTab);

  // Group reports by type
  const reportsByType = filteredReports.reduce((acc, report) => {
    const type = report.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(report);
    return acc;
  }, {} as Record<string, typeof medicalReports>);

  // Function to generate and download JSON summary
  const downloadJsonSummary = () => {
    const allTestResults = medicalReports.flatMap((report) =>
      report.analysisResults?.all_results || []
    );
    const summary = {
      patientId: patientData.id,
      patientName: `${patientData.firstName} ${patientData.lastName}`,
      allTestResults: allTestResults.map((result) => ({
        test_name: result.test_name,
        result_value: result.result_value,
        result_unit: result.result_unit,
        risk_level: result.risk_level,
        direction: result.direction,
        date: medicalReports.find((r) =>
          r.analysisResults?.all_results.includes(result)
        )?.date,
      })),
      generatedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(summary, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `patient_${patientData.id}_summary.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Translation function
  const translateText = async (text: string, targetLang: string) => {
    if (targetLang === "en") return text;
    try {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2?key=${import.meta.env.VITE_GOOGLE_API_KEY}`,
        {
          q: text,
          source: "en",
          target: targetLang,
          format: "text",
        }
      );
      return response.data.data.translations[0].translatedText;
    } catch (error) {
      console.error("Translation error:", error);
      setError("Failed to translate content.");
      return text;
    }
  };

  // Translate content based on language
  const translateContent = useCallback(async (targetLang: string) => {
    setIsLoading(true);
    setError(null);
    const translatedContent = { ...originalContent };

    // Translate all fields
    for (const key in originalContent) {
      translatedContent[key as keyof typeof originalContent] = await translateText(
        originalContent[key as keyof typeof originalContent],
        targetLang
      );
    }

    setContent(translatedContent);
    setIsLoading(false);
  }, [originalContent]);

  useEffect(() => {
    if (language === "en") {
      setContent(originalContent);
      setIsLoading(false);
      setError(null);
    } else {
      translateContent(language);
    }
  }, [language, translateContent]);

  return (
    <Layout>
      <div className="container mx-auto p-6 animate-fade-in">
        {isLoading ? (
          <p>Loading translations...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">{content.pageTitle}</h1>
              <div className="flex gap-4">
                <Button onClick={downloadJsonSummary} className="materna-button">
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

            <Card className="mb-8">
              <CardHeader className="bg-blue-50 rounded-t-lg">
                <CardTitle>
                  {content.patientLabel} {patientData.firstName} {patientData.lastName}
                </CardTitle>
                <CardDescription>
                  {content.patientIdLabel.replace("{id}", patientData.patient_id)}
                </CardDescription>
              </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-8">
              <TabsList className="grid grid-cols-6">
                <TabsTrigger value="all">{content.allReportsTab}</TabsTrigger>
                <TabsTrigger value="blood">{content.bloodTestsTab}</TabsTrigger>
                <TabsTrigger value="ultrasound">{content.ultrasoundTab}</TabsTrigger>
                <TabsTrigger value="infectious">{content.infectiousTab}</TabsTrigger>
                <TabsTrigger value="thyroid">{content.thyroidTab}</TabsTrigger>
                <TabsTrigger value="other">{content.otherTab}</TabsTrigger>
              </TabsList>
            </Tabs>

            {filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
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
                  <div key={type} className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold mb-4 capitalize">
                      {content.reportsTitle.replace("{type}", type.replace("-", " "))}
                    </h2>
                    <div className="grid gap-4">
                      {reports.map((report) => (
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

// Badge for risk levels
const RiskBadge: React.FC<{ riskLevel: string; content: any }> = ({ riskLevel, content }) => {
  switch (riskLevel) {
    case "high_risk":
      return (
        <Badge variant="destructive" className="flex gap-1 items-center">
          <AlertTriangle size={12} />
          {content.highRiskLabel}
        </Badge>
      );
    case "borderline":
      return (
        <Badge variant="default" className="flex gap-1 items-center bg-yellow-500">
          <Info size={12} />
          {content.borderlineLabel}
        </Badge>
      );
    case "normal":
      return (
        <Badge variant="outline" className="flex gap-1 items-center text-green-600 border-green-600">
          <CheckCircle size={12} />
          {content.normalLabel}
        </Badge>
      );
    default:
      return null;
  }
};

// Direction indicator for test results
const DirectionIndicator: React.FC<{ direction: string }> = ({ direction }) => {
  switch (direction) {
    case "high":
      return <ArrowUpRight className="text-red-500" size={16} />;
    case "low":
      return <ArrowDownRight className="text-blue-500" size={16} />;
    default:
      return null;
  }
};

// Updated ReportCard component to open PDF in a new tab
const ReportCard: React.FC<{ report: any; content: any }> = ({ report, content }) => {
  const analysis = report.analysisResults;

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-md">{report.date}</CardTitle>
            <CardDescription className="text-xs">
              {content.categoryLabel.replace("{category}", report.category)}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(report.fileUrl, "_blank")}
          >
            <FileText className="h-4 w-4 mr-1" />
            {content.viewButton}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {report.notes && (
          <CardDescription className="mb-2">{report.notes}</CardDescription>
        )}

        {analysis && analysis.status === "success" && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2 mb-3">
              {analysis.normal_results > 0 && (
                <Badge variant="outline" className="flex gap-1 text-green-600 border-green-600">
                  <CheckCircle size={12} />
                  {analysis.normal_results} {content.normalLabel}
                </Badge>
              )}
              {analysis.borderline_results > 0 && (
                <Badge variant="default" className="flex gap-1 bg-yellow-500">
                  <Info size={12} />
                  {analysis.borderline_results} {content.borderlineLabel}
                </Badge>
              )}
              {analysis.high_risk_results > 0 && (
                <Badge variant="destructive" className="flex gap-1">
                  <AlertTriangle size={12} />
                  {analysis.high_risk_results} {content.highRiskLabel}
                </Badge>
              )}
            </div>

            {analysis.all_results && analysis.all_results.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">{content.testResultsTitle}</h4>
                <div className="space-y-2">
                  {analysis.all_results.map((result: any, index: number) => (
                    <div
                      key={index}
                      className="p-2 rounded bg-gray-50 text-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1">
                        <DirectionIndicator direction={result.direction} />
                        <span className="font-medium">{result.test_name}:</span>
                        <span>
                          {result.result_value} {result.result_unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {content.refLabel.replace("{range}", result.reference_range)}
                        </span>
                        <RiskBadge riskLevel={result.risk_level} content={content} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {!report.analysisResults && (
        <CardFooter className="bg-gray-50 py-2">
          <span className="text-xs text-gray-500 italic">
            {content.noAnalysisData}
          </span>
        </CardFooter>
      )}
    </Card>
  );
};

export default ViewReportsPage;