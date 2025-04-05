import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { calculateGestationalAge, calculatePregnancyProgress, daysUntilDueDate, getTrimester } from "@/lib/utils";
import Layout from "@/components/Layout";
import ProgressMetrics from "@/components/ProgressMetrics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Info, ArrowUpRight, ArrowDownRight, FileText, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf"; // Import jsPDF for PDF generation
import { useLanguage } from "../contexts/LanguageContext"; // Import useLanguage hook
import axios from "axios";
import  BACKEND_URL  from '../configs/config';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isRegistered, 
    patientData, 
    questionnaireCompleted, 
    medicalReports 
  } = useApp();
  const { language } = useLanguage(); // Access language context from navigation bar

  // Translation states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalContent] = useState({
    pageTitle: "Pregnancy Health Dashboard",
    progressTitle: "Pregnancy Progress",
    progressDescription: "Currently {progress}% through your pregnancy",
    reportsSummaryTitle: "Medical Reports Summary",
    normalLabel: "Normal",
    borderlineLabel: "Borderline",
    highRiskLabel: "High Risk",
    reportsUploaded: "You have uploaded {count} medical reports.",
    viewReportsButton: "View All Reports",
    downloadReportButton: "Download Detailed Patient Report",
    healthSummaryTab: "Health Summary",
    riskAssessmentTab: "Risk Assessment",
    testResultsTab: "Test Results Analysis",
    recommendationsTab: "Recommendations",
    healthIndicatorsTitle: "Health Indicators",
    bmiTitle: "Body Mass Index (BMI)",
    bmiNormal: "Current BMI: {bmi} - Normal",
    prePregnancyWeight: "Pre-pregnancy weight: {weight} kg",
    currentWeight: "Current weight: {weight} kg",
    heightLabel: "Height: {height} cm",
    incompleteProfile: "Please complete your health profile to see BMI calculations.",
    noReportsUploaded: "No medical reports have been uploaded yet.",
    uploadReportsPrompt: "Please upload your medical reports to see health indicators.",
    uploadReportsButton: "Upload Reports",
    riskAssessmentTitle: "Pregnancy Risk Assessment",
    insufficientData: "Insufficient data for risk assessment.",
    completeQuestionnairePrompt: "Please upload medical reports and complete the health questionnaire for risk assessment.",
    completeQuestionnaireButton: "Complete Questionnaire",
    identifiedRiskFactors: "Identified Risk Factors",
    viewAllRiskFactors: "View all {count} risk factors",
    noRiskFactors: "No significant risk factors identified from your test results.",
    testResultsTitle: "Test Results Analysis",
    noTestResults: "No test result risk factors have been identified yet.",
    uploadTestResultsPrompt: "This section will display any abnormal test results after you upload and analyze your medical reports.",
    viewDetailedAnalysis: "View Detailed Analysis",
    recommendationsTitle: "Recommendations and Next Steps",
    highRiskAlert: "Alert: High-risk factors have been detected in your test reports. It is strongly recommended to consult your doctor as soon as possible.",
    thirdTrimesterTitle: "3rd Trimester Essentials",
    thirdTrimesterItem1: "Prepare for labor and delivery (birth plan, hospital bag)",
    thirdTrimesterItem2: "Monitor fetal movement daily",
    thirdTrimesterItem3: "Complete your baby preparations (car seat, nursery)",
    thirdTrimesterItem4: "Consider breastfeeding education if planning to breastfeed",
    thirdTrimesterItem5: "Discuss labor signs and when to go to the hospital with your provider",
    secondTrimesterTitle: "2nd Trimester Recommendations",
    secondTrimesterItem1: "Schedule your 20-week anatomy scan",
    secondTrimesterItem2: "Begin prenatal education classes",
    secondTrimesterItem3: "Continue taking prenatal vitamins",
    secondTrimesterItem4: "Stay physically active with pregnancy-safe exercises",
    secondTrimesterItem5: "Begin planning for maternity leave and childcare",
    firstTrimesterTitle: "1st Trimester Recommendations",
    firstTrimesterItem1: "Schedule your first prenatal appointment",
    firstTrimesterItem2: "Begin taking prenatal vitamins with folic acid",
    firstTrimesterItem3: "Avoid alcohol, smoking, and limit caffeine",
    firstTrimesterItem4: "Stay hydrated and get plenty of rest",
    firstTrimesterItem5: "Consider first trimester screening tests",
    downloadSummaryButton: "Download Summary JSON",
    updateRegistration: "Update Registration",
    registrationIssue: "There seems to be an issue with your registration data. Please update your information.",
  });
  const [content, setContent] = useState(originalContent);



  if (!patientData.lmp) {
    return (
      <Layout>
        <div className="container mx-auto p-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-md">
            <p className="text-yellow-700">
              {content.registrationIssue}
            </p>
            <Link to="/register" className="mt-4 inline-block">
              <Button variant="outline" className="mt-2">
                {content.updateRegistration}
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const lmpDate = new Date(patientData.lmp);
  const dueDate = new Date(patientData.dueDate || "");
  const remainingDays = daysUntilDueDate(dueDate);
  const { weeks, days } = calculateGestationalAge(lmpDate);
  const trimester = getTrimester(lmpDate);
  const progress = calculatePregnancyProgress(lmpDate);

  // Process risk factors from all reports
  const allRiskFactors = medicalReports.flatMap(report => 
    report.analysisResults?.risk_factors || []
  );

  // Count test results by risk level
  const testResultCounts = {
    normal: medicalReports.reduce((sum, report) => sum + (report.analysisResults?.normal_results || 0), 0),
    borderline: medicalReports.reduce((sum, report) => sum + (report.analysisResults?.borderline_results || 0), 0),
    high_risk: medicalReports.reduce((sum, report) => sum + (report.analysisResults?.high_risk_results || 0), 0),
    unknown: medicalReports.reduce((sum, report) => sum + (report.analysisResults?.unknown_results || 0), 0),
  };

  // Direction indicator for test results
  const DirectionIndicator = ({ direction }: { direction: string }) => {
    switch (direction) {
      case "high":
        return <ArrowUpRight className="text-red-500" size={16} />;
      case "low":
        return <ArrowDownRight className="text-blue-500" size={16} />;
      default:
        return null;
    }
  };

  // Badge for risk levels
  const RiskBadge = ({ riskLevel }: { riskLevel: string }) => {
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

  // Function to generate patient summary data
  const generatePatientSummary = () => {
    const bmi = patientData.height && patientData.currentWeight
      ? (patientData.currentWeight / Math.pow(patientData.height / 100, 2)).toFixed(1)
      : null;

    const healthSummary = {
      bmi,
      prePregnancyWeight: patientData.preWeight,
      currentWeight: patientData.currentWeight,
      height: patientData.height,
    };

    // Add all test results from medical reports
    const allTestResults = medicalReports.flatMap(report => 
      (report.analysisResults?.all_results || []).map(result => ({
        test_name: result.test_name,
        result_value: result.result_value,
        result_unit: result.result_unit,
        risk_level: result.risk_level,
        direction: result.direction,
        reportDate: report.date,
        reportId: report.id,
      }))
    );

    const riskFactors = allRiskFactors.map(risk => ({
      test_name: risk.test_name,
      result_value: risk.result_value,
      result_unit: risk.result_unit,
      reference_range: risk.reference_range,
      risk_level: risk.risk_level,
      direction: risk.direction,
    }));

    const testAnalysis = {
      normal: testResultCounts.normal,
      borderline: testResultCounts.borderline,
      high_risk: testResultCounts.high_risk,
      unknown: testResultCounts.unknown,
    };

    const currentTrimester = getTrimester(new Date(patientData.lmp));

    return {
      patientId: patientData.id,
      healthSummary,
      allTestResults,
      riskFactors,
      testAnalysis,
      currentTrimester,
      generatedAt: new Date().toISOString(),
    };
  };

  // Function to download the summary as a JSON file
  const downloadSummaryJSON = () => {
    const summary = generatePatientSummary();
    const jsonString = JSON.stringify(summary, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patient_${patientData.id}_summary.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Hardcoded report string for testing
  const hardcodedReport = `
Response:
 
1. Patient Overview:
Name: Yashavi Patel
Age: 35 years
Gender: Female
Due Date: 2025-03-27
Last Menstrual Period: 2024-06-15
Current Week: 40
Blood Group: A+
Pre-existing Conditions: Diabetes, Thyroid Disorder
Height: 156 cm
Current Weight: 64 kg
Pre-pregnancy Weight: 60 kg

2. Health Assessment:
- The patient is 35 years old and is currently 40 weeks pregnant, with a due date of 2025-03-27.
- She has a history of Diabetes and a Thyroid Disorder.
- Her blood group is A+.
- Her height is 156 cm, and her current weight is 64 kg, which is an increase of 4 kg from her pre-pregnancy weight of 60 kg.
- She is in her first pregnancy.
- She exercises occasionally (1-2 times/week).
- Her emotional wellbeing is mostly positive.
- She takes prenatal vitamins regularly.

3. Potential Risk Indicators:
- The patient's packed cell volume (PCV) is 57.5 %,, which is borderline (range: 40.0 - 50.0).
- Her hemoglobin level is 12.5 g/dL, which is also borderline (Range: 13.0 - 17.0).
- Her GLUCOSE fasting level is 315.0 mg/dL, which is high-risk (Range: 70.0 - 100.0).
- Her Index Value is 11.0, which is high-risk (Range: NaN - 1.0).
- Her TSH level is 10.1 mU/L, which is high-risk (Range: 0.4 - 4.0).

4. Recommendations:
- The patient should be closely monitored for anemia and gestational diabetes.
- She should be referred to a specialist for her diabetes and thyroid disorder.
- She should be advised to maintain a balanced diet, focusing on nutrient-rich foods and limiting high-risk foods such as sweets and fats.
- She should be encouraged to engage in regular, low-impact exercise, such as walking.
- She should be advised to take her prenatal vitamins as prescribed.

5. Next Steps:
- Schedule follow-up appointments with the obstetrician and specialists as necessary.
- Arrange for additional testing and monitoring as recommended by the healthcare team.
- Provide the patient with educational materials on pregnancy, diabetes, and thyroid disorders.
- Encourage the patient to attend prenatal education classes and support groups.
- Offer the patient counseling and emotional support throughout her pregnancy.
  `.trim();

  const [reportId, setReportId] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>("idle");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Function to trigger report generation and polling
  const handleGenerateReport = async (patientData: any) => {
    try {
      setIsGenerating(true);
      setReportContent(null); // Clear old report

      const response = await fetch(`${BACKEND_URL}/generate_report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientData.id,
          patient_data: patientData,
        }),
      });

      if (!response.ok) throw new Error("Failed to start report generation");

      const data = await response.json();
      setReportId(data.report_id);
      setStatus(data.status);

      pollReportStatus(data.report_id);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to start report generation. Please try again.");
      setIsGenerating(false);
    }
  };

  // Function to poll report status periodically
  const pollReportStatus = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/check_report/${id}`);
        if (!response.ok) throw new Error("Failed to fetch report status");

        const data = await response.json();
        setStatus(data.status);

        if (data.status === "completed" && data.report_content) {
          setReportContent(data.report_content);
          clearInterval(interval);
          setIsGenerating(false);
        }
      } catch (error) {
        console.error("Error checking report status:", error);
      }
    }, 5000);
  };

  // Function to generate and download PDF
  const handleDownloadReport = () => {
    if (!reportContent) {
      alert("Report is still being generated. Please wait.");
      return;
    }

    try {
      const doc = new jsPDF();
      let y = 10;

      doc.setFontSize(20);
      doc.text("Maternal Health Report", 10, y);
      y += 15;

      const lines = reportContent.split("\n");
      lines.forEach((line) => {
        if (line.match(/^\d+\.\s/)) {
          doc.setFontSize(14);
          doc.text(line, 10, y);
        } else if (line.startsWith("- ")) {
          doc.setFontSize(9);
          doc.text(`• ${line.substring(2)}`, 15, y);
        } else {
          doc.setFontSize(9);
          doc.text(line, 10, y);
        }
        y += 8;
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
      });

      doc.save(`detailed_patient_report.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to download the report.");
    }
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
            <h1 className="text-3xl font-bold mb-8 text-gray-800">{content.pageTitle}</h1>
            
            <ProgressMetrics />
            
            <div className="mt-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">{content.progressTitle}</h2>
              <p className="text-sm text-gray-500 mb-2">{content.progressDescription.replace("{progress}", progress.toString())}</p>
              <Progress value={progress} className="h-2" />
            </div>

            {medicalReports.length > 0 && (
              <Card className="mb-8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{content.reportsSummaryTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 mb-4">
                    <Badge variant="outline" className="flex gap-1 text-green-600 border-green-600">
                      <CheckCircle size={12} />
                      {testResultCounts.normal} {content.normalLabel}
                    </Badge>
                    {testResultCounts.borderline > 0 && (
                      <Badge variant="default" className="flex gap-1 bg-yellow-500">
                        <Info size={12} />
                        {testResultCounts.borderline} {content.borderlineLabel}
                      </Badge>
                    )}
                    {testResultCounts.high_risk > 0 && (
                      <Badge variant="destructive" className="flex gap-1">
                        <AlertTriangle size={12} />
                        {testResultCounts.high_risk} {content.highRiskLabel}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-2">
                    {content.reportsUploaded.replace("{count}", medicalReports.length.toString())}
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <Link to="/view-reports">
                      <Button variant="outline" size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        {content.viewReportsButton}
                      </Button>
                    </Link>
                    {/* Button to Generate & Download Report */}
                    {status === "idle" || status === "failed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateReport(patientData)}
                        disabled={isGenerating}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isGenerating ? "Generating..." : "Generate Report"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadReport}
                        disabled={status !== "completed"}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Detailed Patient Report
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Tabs defaultValue="health" className="mt-8">
              <TabsList className="mb-6">
                <TabsTrigger value="health">{content.healthSummaryTab}</TabsTrigger>
                <TabsTrigger value="risk">{content.riskAssessmentTab}</TabsTrigger>
                <TabsTrigger value="tests">{content.testResultsTab}</TabsTrigger>
                <TabsTrigger value="recommendations">{content.recommendationsTab}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="health" className="space-y-6">
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4">{content.healthIndicatorsTitle}</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-md font-medium mb-1">{content.bmiTitle}</h4>
                      {patientData.height && patientData.currentWeight ? (
                        <>
                          <p className="mb-2">
                            {content.bmiNormal.replace("{bmi}", (patientData.currentWeight / Math.pow(patientData.height / 100, 2)).toFixed(1))}
                          </p>
                          <p className="text-sm text-gray-500">{content.prePregnancyWeight.replace("{weight}", patientData.preWeight.toString())}</p>
                          <p className="text-sm text-gray-500">{content.currentWeight.replace("{weight}", patientData.currentWeight.toString())}</p>
                          <p className="text-sm text-gray-500">{content.heightLabel.replace("{height}", patientData.height.toString())}</p>
                        </>
                      ) : (
                        <p className="text-yellow-600">{content.incompleteProfile}</p>
                      )}
                    </div>
                    
                    {medicalReports.length === 0 && (
                      <div className="bg-yellow-50 p-4 rounded-md">
                        <p className="text-yellow-700">{content.noReportsUploaded}</p>
                        <p className="text-sm mt-2">{content.uploadReportsPrompt}</p>
                        <Link to="/upload-reports">
                          <Button variant="outline" size="sm" className="mt-2">
                            {content.uploadReportsButton}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="risk" className="space-y-6">
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4">{content.riskAssessmentTitle}</h3>
                  
                  {!questionnaireCompleted || medicalReports.length === 0 ? (
                    <div className="bg-yellow-50 p-4 rounded-md">
                      <p className="text-yellow-700">{content.insufficientData}</p>
                      <p className="text-sm mt-2">
                        {content.completeQuestionnairePrompt}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {!questionnaireCompleted && (
                          <Link to="/questionnaire">
                            <Button variant="outline" size="sm">
                              {content.completeQuestionnaireButton}
                            </Button>
                          </Link>
                        )}
                        {medicalReports.length === 0 && (
                          <Link to="/upload-reports">
                            <Button variant="outline" size="sm">
                              {content.uploadReportsButton}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : allRiskFactors.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="text-md font-medium">{content.identifiedRiskFactors}</h4>
                      <div className="space-y-2">
                        {allRiskFactors.slice(0, 5).map((risk, idx) => (
                          <div key={idx} className="p-2 rounded bg-gray-50 text-sm flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <DirectionIndicator direction={risk.direction} />
                              <span className="font-medium">{risk.test_name}:</span> 
                              <span>{risk.result_value} {risk.result_unit}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Ref: {risk.reference_range}</span>
                              <RiskBadge riskLevel={risk.risk_level} />
                            </div>
                          </div>
                        ))}
                        
                        {allRiskFactors.length > 5 && (
                          <Link to="/view-reports" className="text-sm text-materna-600 block mt-2">
                            {content.viewAllRiskFactors.replace("{count}", allRiskFactors.length.toString())}
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-green-600">{content.noRiskFactors}</p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="tests" className="space-y-6">
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4">{content.testResultsTitle}</h3>
                  
                  {medicalReports.length === 0 ? (
                    <div className="bg-yellow-50 p-4 rounded-md">
                      <p className="text-yellow-700">{content.noTestResults}</p>
                      <p className="text-sm mt-2">
                        {content.uploadTestResultsPrompt}
                      </p>
                      <Link to="/upload-reports">
                        <Button variant="outline" size="sm" className="mt-2">
                          {content.uploadReportsButton}
                        </Button>
                      </Link>
                    </div>
                  ) : testResultCounts.high_risk === 0 && testResultCounts.borderline === 0 ? (
                    <p className="text-green-600">{content.noTestResults}</p>
                  ) : (
                    <div>
                      <p className="mb-4">
                        {content.noTestResults.replace("{count}", (testResultCounts.high_risk + testResultCounts.borderline).toString())}
                      </p>
                      <Link to="/view-reports">
                        <Button variant="outline" size="sm">
                          {content.viewDetailedAnalysis}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="recommendations" className="space-y-6">
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4">{content.recommendationsTitle}</h3>
                  
                  {testResultCounts.high_risk > 0 && (
                    <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6 rounded-md">
                      <p className="text-red-700 font-medium">
                        {content.highRiskAlert}
                      </p>
                    </div>
                  )}
                  
                  {trimester === 3 && (
                    <div>
                      <h4 className="text-md font-medium mb-3">{content.thirdTrimesterTitle}</h4>
                      <ul className="space-y-4">
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.thirdTrimesterItem1}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.thirdTrimesterItem2}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.thirdTrimesterItem3}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.thirdTrimesterItem4}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.thirdTrimesterItem5}</span>
                        </li>
                      </ul>
                    </div>
                  )}
                  
                  {trimester === 2 && (
                    <div>
                      <h4 className="text-md font-medium mb-3">{content.secondTrimesterTitle}</h4>
                      <ul className="space-y-4">
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.secondTrimesterItem1}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.secondTrimesterItem2}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.secondTrimesterItem3}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.secondTrimesterItem4}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.secondTrimesterItem5}</span>
                        </li>
                      </ul>
                    </div>
                  )}
                  
                  {trimester === 1 && (
                    <div>
                      <h4 className="text-md font-medium mb-3">{content.firstTrimesterTitle}</h4>
                      <ul className="space-y-4">
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.firstTrimesterItem1}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.firstTrimesterItem2}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.firstTrimesterItem3}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.firstTrimesterItem4}</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-materna-500 mr-2">•</span>
                          <span>{content.firstTrimesterItem5}</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Button to download the JSON summary */}
            <div className="mt-8">
              <Button onClick={downloadSummaryJSON} className="w-full md:w-auto">
                {content.downloadSummaryButton}
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;