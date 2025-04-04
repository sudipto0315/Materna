// src/utils/reportAnalysis.ts
import { ReportAnalysisSummary } from "@/contexts/AppContext"; // Assuming this type is defined correctly
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfjsLib from "pdfjs-dist";

// --- Configuration ---

// Configure pdfjs worker - ENSURE this path is correct relative to your public/build output
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"; // Or use a CDN URL

// !!! SECURITY WARNING !!! - Keep this warning prominent
// Hardcoding API keys in client-side code is extremely insecure.
// Use environment variables loaded securely.
const GEMINI_API_KEY = "AIzaSyCUtaGU9Ijs8PQ89nf7_jDU_qlG-o5nEXI"; // <<< --- THIS IS INSECURE - Replace with secure loading

// Initialize Gemini Client (handle potential missing key)
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.error(
    "Gemini API Key is missing. Report analysis functionality will be disabled."
  );
}

// Define expected language type
type LanguageCode = 'en' | 'hi' | 'bn'; // Example language codes

// --- PDF Text Extraction ---

interface PdfTextItem {
    str?: string;
    // other properties like transform, width, height, etc. exist but str is key here
}

export const extractTextFromFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let text = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => (item as PdfTextItem).str || "")
        .join(" ");
      text += pageText + "\n";
    }

    if (!text.trim()) {
        console.warn("Warning: Extracted text from PDF is empty.");
        // Consider if throwing an error is better here depending on UX
        // throw new Error("Extracted text from PDF is empty.");
    }

    return text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};


// --- AI Analysis ---

interface ExtractedResult {
    test_name: string;
    result_value: string;
    result_unit?: string | null; // Allow null
    ref_range_low?: string | null;
    ref_range_high?: string | null;
    ref_range_text?: string | null;
}

/**
 * Analyzes extracted report text using the Gemini AI model.
 * @param reportText The extracted text from the report.
 * @param reportType A key identifying the type of report (e.g., 'cbc', 'hiv').
 * @param language The desired language for the analysis output ('en', 'hi', 'bn').
 * @returns A promise resolving to an array of extracted test results.
 * @throws An error if AI analysis fails or the API key is missing.
 */
export const analyzeReportWithAI = async (
  reportText: string,
  reportType: string,
  language: LanguageCode // Pass language as a parameter
): Promise<ExtractedResult[]> => {
  if (!genAI) {
    throw new Error("Gemini AI client is not initialized (API Key missing?).");
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Use desired model

    // Consider making this mapping more robust or externally configurable
    const reportTypes: Record<string, string> = {
      cbc: "Complete Blood Count (CBC)",
      "blood-type": "Blood Typing",
      glucose: "Glucose Tolerance Test",
      doppler: "Doppler Ultrasound",
      "3d-4d": "3D/4D Ultrasound",
      hiv: "HIV Test",
      hepb: "Hepatitis B Test",
      tsh: "Thyroid Function Test",
      cfdna: "Cell-Free DNA Screening",
      carrier: "Carrier Screening",
      amnio: "Amniocentesis Results",
      cvs: "Chorionic Villus Sampling (CVS) Results",
      custom: "Medical Test", // Default/fallback
    };

    const reportDescription = reportTypes[reportType.toLowerCase()] || reportTypes.custom;

    // --- Construct the Prompt ---

    // Determine the target language name for the prompt
    let targetLanguageName: string;
    let languageInstruction: string;

    switch (language) {
        case 'hi':
            targetLanguageName = "Hindi";
            // Ensure Hindi text is accurate and clearly states the requirement for specific JSON fields
            languageInstruction = `LANGUAGE REQUIREMENT: The final JSON output MUST contain strings in ${targetLanguageName}. Specifically, the value for the "test_name" field, any textual "result_value" (like "पॉजिटिव", "नेगेटिव"), and any textual "ref_range_text" (like "नेगेटिव") MUST be provided in ${targetLanguageName} ONLY. Numeric values and units should remain as extracted. Example field in ${targetLanguageName}: "test_name": "हीमोग्लोबिन".`;
            break;
        case 'bn':
            targetLanguageName = "Bengali";
            // Ensure Bengali text is accurate and clearly states the requirement for specific JSON fields
            languageInstruction = `LANGUAGE REQUIREMENT: The final JSON output MUST contain strings in ${targetLanguageName}. Specifically, the value for the "test_name" field, any textual "result_value" (like "পজিটিভ", "নেতিবাচক"), and any textual "ref_range_text" (like "নেতিবাচক") MUST be provided in ${targetLanguageName} ONLY. Numeric values and units should remain as extracted. Example field in ${targetLanguageName}: "test_name": "হিমোগ্লোবিন".`;
            break;
        case 'en':
        default:
            targetLanguageName = "English";
            languageInstruction = `LANGUAGE REQUIREMENT: The final JSON output MUST contain strings in ${targetLanguageName}. Specifically, the value for the "test_name" field, any textual "result_value" (like "Positive", "Negative"), and any textual "ref_range_text" (like "Negative") MUST be provided in ${targetLanguageName} ONLY. Numeric values and units should remain as extracted. Example field in ${targetLanguageName}: "test_name": "Hemoglobin".`;
            break;
    }


    let prompt = `
You are a highly specialized medical data extraction AI. Your primary task is to analyze the provided medical report text, identify all relevant test parameters, and extract their corresponding values and reference ranges accurately. Your secondary, but equally important task, is to format the output according to strict JSON specifications AND language requirements.

Report Type Being Analyzed: ${reportDescription}
TARGET OUTPUT LANGUAGE: ${targetLanguageName}

Instructions:
1.  Carefully read the entire report text provided below.
2.  Extract every distinct test parameter mentioned in the report.
3.  For each parameter:
    *   Extract its measured value. This could be numeric (e.g., "12.5") or qualitative (e.g., "Positive", "Negative", "A+", "Not Detected").
    *   Extract the unit of measurement if provided (e.g., "g/dL", "%", "IU/L"). Leave as extracted.
    *   Extract the reference range associated with the parameter. This might be:
        *   A numeric range (e.g., "11.0-15.0"). Extract the lower and upper bounds separately. Leave numbers as extracted.
        *   A textual description (e.g., "Negative", "< 5.0", "Normal").
        *   Not Applicable ("N/A") or missing.
4.  Format the results STRICTLY as a single JSON array. Each object in the array must represent one test parameter and have the following fields:
    *   "test_name": (string) The name of the test parameter. **MUST be in ${targetLanguageName}**.
    *   "result_value": (string) The measured value or qualitative result. **If textual, MUST be in ${targetLanguageName}**. Numeric values remain as numbers in string format.
    *   "result_unit": (string | null) The unit of measurement, or null if not applicable/found. (Keep unit as extracted, do not translate).
    *   "ref_range_low": (string | null) The lower numeric limit of the reference range, as a string, or null if not numeric/applicable/found. (Keep number as extracted).
    *   "ref_range_high": (string | null) The upper numeric limit of the reference range, as a string, or null if not numeric/applicable/found. (Keep number as extracted).
    *   "ref_range_text": (string | null) The textual description of the reference range (use this if the range isn't purely numeric low-high, e.g., "Negative", "< 5.0"). **If textual, MUST be in ${targetLanguageName}**. Null if not applicable/found.

5.  ${languageInstruction} <-- CRITICAL LANGUAGE CONSTRAINT REITERATED

Specific Handling Notes:
`;

    // Add report-type specific instructions (these should also ideally respect the target language for test_name)
    const lowerCaseReportType = reportType.toLowerCase();
     // Helper to get translated terms (replace with actual translations)
    const getTranslatedTerm = (term: string, lang: LanguageCode): string => {
        const terms: Record<string, Record<LanguageCode, string>> = {
            "Blood Group": { en: "Blood Group", hi: "ब्लड ग्रुप", bn: "রক্তের গ্রুপ" },
            "Rh Factor": { en: "Rh Factor", hi: "आरएच फैक्टर", bn: "আরএইচ ফ্যাক্টর" },
            "HIV Result": { en: "HIV Result", hi: "एचआईवी परिणाम", bn: "এইচআইভি ফলাফল" },
            "Hepatitis B Surface Antigen (HBsAg)": { en: "Hepatitis B Surface Antigen (HBsAg)", hi: "हेपेटाइटिस बी सरफेस एंटीजन (HBsAg)", bn: "হেপাটাইটিস বি সারফেস অ্যান্টিজেন (HBsAg)" },
            "Negative": { en: "Negative", hi: "नेगेटिव", bn: "নেতিবাচক" },
            "Non-Reactive": { en: "Non-Reactive", hi: "नॉन-रिएक्टिव", bn: "নন-রিঅ্যাক্টিভ" },
             "N/A": { en: "N/A", hi: "लागू नहीं", bn: "প্রযোজ্য নয়" }
        };
        return terms[term]?.[lang] || term; // Fallback to original term if translation missing
    };


    if (lowerCaseReportType === "blood-type") {
      prompt += `
- For Blood Typing:
    - Extract the ABO group (A, B, AB, O). Use test_name: "${getTranslatedTerm('Blood Group', language)}", result_value: [extracted group], ref_range_text: "${getTranslatedTerm('N/A', language)}".
    - Extract the Rh factor (Positive, Negative). Use test_name: "${getTranslatedTerm('Rh Factor', language)}", result_value: [extracted factor in ${targetLanguageName}], ref_range_text: "${getTranslatedTerm('N/A', language)}". (Ensure "Positive"/"Negative" result is also in ${targetLanguageName}).
`;
    } else if (lowerCaseReportType === "hiv") {
      prompt += `
- For HIV Test: Extract the primary result (e.g., "Positive", "Negative", "Non-Reactive", "Reactive"). Use test_name: "${getTranslatedTerm('HIV Result', language)}", result_value: [extracted result in ${targetLanguageName}], ref_range_text: "${getTranslatedTerm('Negative', language)}" (or "${getTranslatedTerm('Non-Reactive', language)}"). Ensure result_value is translated.
`;
    } else if (lowerCaseReportType === "hepb") {
      prompt += `
- For Hepatitis B Test (likely HBsAg): Extract the primary result (e.g., "Positive", "Negative", "Non-Reactive", "Reactive"). Use test_name: "${getTranslatedTerm('Hepatitis B Surface Antigen (HBsAg)', language)}", result_value: [extracted result in ${targetLanguageName}], ref_range_text: "${getTranslatedTerm('Negative', language)}" (or "${getTranslatedTerm('Non-Reactive', language)}"). Adjust test_name if a different Hep B marker is specified, translating it to ${targetLanguageName}. Ensure result_value is translated.
`;
    }
    // Add more specific instructions for other report types if needed, ensuring translation hints.

    prompt += `
6.  Double-check your extraction for accuracy AND language compliance. Do not invent data. If a value or range is unclear or missing, use null for the corresponding JSON field.
7.  Output ONLY the final JSON array. Do not include ANY introductory text, explanations, apologies, or markdown formatting like \`\`\`json ... \`\`\` around the array. The output MUST start with '[' and end with ']'.

Report Content to Analyze:
--- START REPORT ---
${reportText}
--- END REPORT ---

${targetLanguageName} JSON Array Output:
`;

    // console.log("Sending Prompt to Gemini:", prompt); // Uncomment for debugging

    const result = await model.generateContent(prompt);
    const response = result.response;
    let responseText = "";
    try {
        responseText = response.text().trim();
    } catch (error) {
        console.error("Error getting text from Gemini response:", error);
        // Handle cases where response might be blocked or invalid
        if (response.promptFeedback?.blockReason) {
             throw new Error(`Gemini request blocked: ${response.promptFeedback.blockReason} - ${response.promptFeedback.blockReasonMessage || ''}`);
        }
        throw new Error(`Failed to get text from Gemini response: ${error instanceof Error ? error.message : String(error)}`);
    }

    // console.log("Received Response Text from Gemini:", responseText); // Uncomment for debugging

    // Attempt to parse the response directly as JSON
    try {
        // Clean potential markdown fences or leading/trailing text just in case
        const cleanedText = responseText.replace(/^.*?(\[.*\]).*?$/s, '$1').trim();

        if (!cleanedText.startsWith('[') || !cleanedText.endsWith(']')) {
             console.error("Gemini response does not appear to be a valid JSON array structure:", cleanedText);
             throw new Error("AI response did not conform to the expected JSON array structure.");
        }

        const parsedJson = JSON.parse(cleanedText);

        if (!Array.isArray(parsedJson)) {
             console.error("Gemini response parsed, but it's not an array:", parsedJson);
             throw new Error("AI response was not a valid JSON array.");
        }
        // Optional: Add detailed validation of array item structure here if needed

        // Ensure properties exist, default to reasonable values if missing/null from AI
         return parsedJson.map((item: any) => ({
            test_name: item.test_name || "Unknown Test", // Provide default
            result_value: item.result_value !== null && item.result_value !== undefined ? String(item.result_value) : "", // Ensure string, handle null/undefined
            result_unit: item.result_unit || null, // Default to null
            ref_range_low: item.ref_range_low || null,
            ref_range_high: item.ref_range_high || null,
            ref_range_text: item.ref_range_text || null,
        })) as ExtractedResult[];


    } catch (parseError) {
      console.error("Could not parse Gemini response as JSON:", parseError);
      console.error("Raw response text was:", responseText); // Log raw text for debugging
      throw new Error(`AI did not return valid JSON. Parse Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      // Removed the regex fallback as it's less reliable and the prompt is now stricter
    }
  } catch (error) {
    console.error("Error analyzing report with Gemini:", error);
    throw new Error(`Error during AI analysis: ${error instanceof Error ? error.message : String(error)}`);
  }
};


// --- Result Interpretation ---

type RiskLevel = "normal" | "borderline" | "high_risk" | "unknown";
type RiskDirection = "normal" | "low" | "high" | "positive" | "unknown"; // Keep "positive" for qualitative high risk

export const determineNumericRiskLevel = (
  value: string,
  refLow: string | undefined | null,
  refHigh: string | undefined | null
): [RiskLevel, RiskDirection] => {
  try {
    const numValue = parseFloat(value);
    const numRefLow = (refLow && !isNaN(parseFloat(refLow))) ? parseFloat(refLow) : null;
    const numRefHigh = (refHigh && !isNaN(parseFloat(refHigh))) ? parseFloat(refHigh) : null;

    if (isNaN(numValue) || !isFinite(numValue)) { // Added !isFinite check
        return ["unknown", "unknown"];
    }

    if (numRefLow !== null && numRefHigh !== null) {
        // Standard range check
        if (numValue < numRefLow) return ["borderline", "low"]; // Or high_risk depending on clinical significance context
        if (numValue > numRefHigh) return ["borderline", "high"]; // Or high_risk
        return ["normal", "normal"];
    } else if (numRefLow !== null && numRefHigh === null) {
        // Lower bound only (e.g. "> 10")
        if (numValue < numRefLow) return ["borderline", "low"]; // Potentially abnormal
        return ["normal", "normal"]; // Assuming higher is normal/ok
    } else if (numRefLow === null && numRefHigh !== null) {
        // Upper bound only (e.g., "< 150")
        if (numValue > numRefHigh) return ["borderline", "high"]; // Potentially abnormal
        return ["normal", "normal"]; // Assuming lower is normal/ok
    }

    // If numeric ranges aren't clear or only one non-numeric bound was provided
    return ["unknown", "unknown"];

  } catch (error) {
    console.error("Error determining numeric risk level:", error);
    return ["unknown", "unknown"];
  }
};

export const analyzeQualitativeResult = (
  resultValue: string | undefined | null,
  refRangeText: string | undefined | null
): [RiskLevel, RiskDirection] => {
  if (!resultValue || !refRangeText) {
    return ["unknown", "unknown"];
  }

  // Normalize inputs for comparison - use localeCompare for potential future broader language support robustness
  const result = resultValue.toLowerCase().trim();
  const refExpected = refRangeText.toLowerCase().trim();

  // Define patterns robustly (consider adding translated versions if needed, though AI should provide translated refRangeText)
  // English Centric for now, assuming AI translates refRangeText correctly.
  // If AI fails translation, this comparison might fail.
  const negativePatterns = ["negative", "non-reactive", "not detected", "absent", "नॉन-रिएक्टिव", "नेगेटिव", "गैर-प्रतिक्रियाशील", "नकारात्मक", "নেতিবাচক", "শনাক্ত করা যায়নি"]; // Add known translations
  const positivePatterns = ["positive", "reactive", "detected", "present", "पॉजिटिव", "रिएक्टिव", "सकारात्मक", "प्रतिक्रियाशील", "পজিটিভ", "রিయాক্টিভ", "শনাক্ত করা গেছে"]; // Add known translations

  const isRefNegative = negativePatterns.some(pattern => refExpected.includes(pattern));
  const isResultPositive = positivePatterns.some(pattern => result.includes(pattern));
  const isResultNegative = negativePatterns.some(pattern => result.includes(pattern));

  if (isRefNegative) {
    if (isResultPositive) {
      return ["high_risk", "positive"]; // Use 'positive' direction for clarity on this type of risk
    } else if (isResultNegative || result === refExpected) { // Check exact match too
      return ["normal", "normal"];
    }
  }
  // Add logic for positive expected reference range if necessary (less common)
  // else if (isRefPositive) { ... }

  // If the patterns don't match known positive/negative against a negative reference
  // It could be normal (e.g., result "A+" ref "N/A") or unknown. Default to unknown for safety.
  console.warn(`Qualitative analysis outcome unknown for Result: "${result}", Ref: "${refExpected}"`);
  return ["unknown", "unknown"];
};


export const analyzeTestResults = (testResults: ExtractedResult[]): any[] => { // Consider defining a specific AnalyzedResult type
  return testResults.map((test) => {
    const result = {
      test_name: test.test_name || "Unknown Test",
      result_value: test.result_value || "",
      result_unit: test.result_unit || null, // Use null for consistency
      ref_range_low: test.ref_range_low || null,
      ref_range_high: test.ref_range_high || null,
      ref_range_text: test.ref_range_text || null,
      risk_level: "unknown" as RiskLevel,
      direction: "unknown" as RiskDirection,
    };

    let riskLevel: RiskLevel = "unknown";
    let direction: RiskDirection = "unknown";

    // Prioritize Numeric Analysis if possible
    const potentialNumValue = parseFloat(result.result_value);
    const hasNumericRefs = (result.ref_range_low !== null && !isNaN(parseFloat(result.ref_range_low))) ||
                           (result.ref_range_high !== null && !isNaN(parseFloat(result.ref_range_high)));
    const valueIsNumeric = !isNaN(potentialNumValue) && isFinite(potentialNumValue);

    if (valueIsNumeric && hasNumericRefs) {
        [riskLevel, direction] = determineNumericRiskLevel(
            result.result_value,
            result.ref_range_low,
            result.ref_range_high
        );
         // If numeric analysis yields unknown (e.g., refs were '<5' not parsed, or only one bound), fall back to qualitative ONLY IF ref_range_text is present
         if (riskLevel === 'unknown' && result.ref_range_text) {
             const [qualRisk, qualDirection] = analyzeQualitativeResult(
                 result.result_value, // Still pass the numeric value as string
                 result.ref_range_text
             );
             // Only override if qualitative analysis gives a more definitive result than unknown
             if (qualRisk !== 'unknown') {
                 riskLevel = qualRisk;
                 direction = qualDirection;
             }
         }
    } else if (result.ref_range_text || !valueIsNumeric) { // If value is non-numeric OR if ref_range_text is available (even if value is numeric but refs weren't)
        // Perform qualitative analysis
         [riskLevel, direction] = analyzeQualitativeResult(
            result.result_value,
            result.ref_range_text // Primarily rely on ref_range_text for qualitative context
        );
    }
     // If still unknown after both attempts, it remains unknown.

    result.risk_level = riskLevel;
    result.direction = direction;
    return result;
  });
};


// --- Main Analysis Orchestration ---

/**
 * Main function to orchestrate the report analysis process.
 * @param file The uploaded PDF file.
 * @param reportType The type category of the report.
 * @param language The target language for the output.
 * @param patientId Optional: Patient identifier.
 * @param reportDate Optional: Date of the report.
 * @returns A promise resolving to a ReportAnalysisSummary object or an error status object.
 */
export const analyzeReport = async (
  file: File,
  reportType: string,
  language: LanguageCode,
  patientId: string,
  reportDate: string
): Promise<ReportAnalysisSummary | { status: 'error'; message: string }> => { // Explicit error return type
  try {
    // Step 1: Extract Text
    const reportText = await extractTextFromFile(file);
    if (!reportText) {
       // This case might occur if the warning in extractTextFromFile isn't changed to an error
      return { status: "error", message: "Extracted text from PDF was empty or could not be read." };
    }

    // Step 2: Analyze with AI
    const testResults = await analyzeReportWithAI(reportText, reportType, language);
    // testResults should now be an array, even if empty, unless an error was thrown.
    // Check if the AI returned an empty array specifically.
    if (testResults.length === 0) {
      console.warn("AI analysis completed but returned zero structured test results.");
      // Return a warning status, but include basic structure
      return { status: "warning", message: "AI analysis did not identify any specific test results in the document. It might be an unsupported format, have no clear results, or the AI couldn't parse it.", all_results: [], risk_factors: [], total_tests: 0, normal_results: 0, borderline_results: 0, high_risk_results: 0, unknown_results: 0, report_type: reportType };
    }

    // Step 3: Interpret Results (using potentially translated data)
    const analyzedResults = analyzeTestResults(testResults);

    // Step 4: Summarize
    const riskFactors = analyzedResults
      .filter((result) => ["borderline", "high_risk"].includes(result.risk_level))
      .map((result) => ({
        test_name: result.test_name,
        result_value: result.result_value,
        result_unit: result.result_unit || "N/A", // Ensure unit display fallback
        // Construct a readable reference range string from available data
        reference_range:
          result.ref_range_low && result.ref_range_high
            ? `${result.ref_range_low} - ${result.ref_range_high}${result.result_unit ? ' ' + result.result_unit : ''}` // Add unit to numeric range
            : result.ref_range_text || "N/A", // Use text range if no numeric, fallback N/A
        risk_level: result.risk_level,
        direction: result.direction,
      }));

    const summary: ReportAnalysisSummary = {
      status: "success",
      report_type: reportType,
      // Optional: Add patientId and reportDate if they are part of ReportAnalysisSummary type
      // patient_id: patientId,
      // report_date: reportDate,
      total_tests: analyzedResults.length,
      normal_results: analyzedResults.filter((r) => r.risk_level === "normal").length,
      borderline_results: analyzedResults.filter((r) => r.risk_level === "borderline").length,
      high_risk_results: analyzedResults.filter((r) => r.risk_level === "high_risk").length,
      unknown_results: analyzedResults.filter((r) => r.risk_level === "unknown").length,
      risk_factors: riskFactors,
      all_results: analyzedResults, // Include all detailed results
    };

    return summary;

  } catch (error) {
    console.error("Error in overall analyzeReport process:", error);
    // Return a structured error object consistent with the function signature
    return {
      status: "error",
      message: `An error occurred during report analysis: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};