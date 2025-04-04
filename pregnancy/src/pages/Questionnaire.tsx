// src/components/QuestionnaireForm.tsx (adjust path as needed)
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// --- Context Imports (Replace with your actual paths) ---
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from "@/hooks/use-toast"; // Assuming this is your toast hook path

// --- UI Component Imports (Replace with your actual paths) ---
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react"; // Icon library

// --- Helper Component: QuestionSection ---
interface QuestionSectionProps {
    title: string;
    children: React.ReactNode;
}

const QuestionSection: React.FC<QuestionSectionProps> = ({ title, children }) => {
    return (
        <div className="mb-8 bg-white rounded-lg shadow-md p-6 animate-fade-in">
            <h2 className="text-xl font-semibold mb-4">{title}</h2>
            <div className="space-y-6">{children}</div>
        </div>
    );
};

// --- Type Definition for Translatable Content ---
type ContentType = {
    pageTitle: string;
    patientLabel: string;
    vitalSigns: string;
    obstetricHistory: string;
    isFirstPregnancy: string;
    previousPregnancyDetails: string;
    lmpLabel: string;
    dueDateLabel: string;
    medicalHistory: string;
    preexistingConditions: string;
    pcosPcod: string;
    pcosPcodDetails: string;
    allergies: string;
    currentMedications: string;
    familyMedicalHistory: string;
    geneticDisorders: string;
    geneticDisordersDetails: string;
    familyPregnancyComplications: string;
    familyPregnancyComplicationsDetails: string;
    lifestyleHabits: string;
    smokingStatus: string;
    alcoholConsumption: string;
    drugUse: string;
    dietHabits: string;
    exerciseFrequency: string;
    exerciseActivity: string;
    physicalActivityTypes: string;
    activityFrequencyLabel: string;
    additionalComments: string;
    additionalCommentsPrompt: string;
    saveButton: string;
    yes: string;
    no: string;
    notSure: string;
    neverSmoked: string;
    quitBefore: string;
    quitAfter: string;
    currentlySmoking: string;
    none: string;
    occasionalAlcohol: string;
    monthlyAlcohol: string;
    weeklyAlcohol: string;
    dailyAlcohol: string;
    neverExercise: string;
    rarelyExercise: string;
    occasionallyExercise: string;
    regularlyExercise: string;
    dailyExercise: string;
    dailyActivity: string;
    weeklyActivity3_5: string;
    weeklyActivity1_2: string;
    occasionalActivity: string;
    neverActivity: string;
    questionnaireSaved: string;
    questionnaireSuccessfullySaved: string;
    // Option Labels
    drugUseOptionNone: string;
    drugUseOptionPrescription: string;
    drugUseOptionOTC: string;
    drugUseOptionHerbal: string;
    drugUseOptionRecreational: string;
    activityTypeWalking: string;
    activityTypeJoggingRunning: string;
    activityTypeSwimming: string;
    activityTypeYogaPilates: string;
    activityTypeStrengthTraining: string;
    activityTypeOther: string;
};

// --- Constants for Options ---
const drugUseOptions = [
    { value: "None", translationKey: "drugUseOptionNone" as keyof ContentType },
    { value: "Prescription medications", translationKey: "drugUseOptionPrescription" as keyof ContentType },
    { value: "Over-the-counter medications", translationKey: "drugUseOptionOTC" as keyof ContentType },
    { value: "Herbal supplements", translationKey: "drugUseOptionHerbal" as keyof ContentType },
    { value: "Recreational drugs", translationKey: "drugUseOptionRecreational" as keyof ContentType },
];

const physicalActivityOptions = [
    { value: "None", translationKey: "none" as keyof ContentType }, // Added None option here
    { value: "Walking", translationKey: "activityTypeWalking" as keyof ContentType },
    { value: "Jogging/Running", translationKey: "activityTypeJoggingRunning" as keyof ContentType },
    { value: "Swimming", translationKey: "activityTypeSwimming" as keyof ContentType },
    { value: "Yoga/Pilates", translationKey: "activityTypeYogaPilates" as keyof ContentType },
    { value: "Strength Training", translationKey: "activityTypeStrengthTraining" as keyof ContentType },
    { value: "Other", translationKey: "activityTypeOther" as keyof ContentType },
];

// --- Main Questionnaire Form Component ---
const QuestionnaireForm: React.FC = () => {
    const navigate = useNavigate();
    const { patientData, setQuestionnaireCompleted, setQuestionnaireData } = useApp();
    const { language } = useLanguage();

    // --- State ---
    const [formData, setFormData] = useState({
        // Vital Signs
        bloodPressure: "",
        bodyTemperature: "",
        pulseRate: "",
        // Obstetric History
        isFirstPregnancy: "Yes",
        previousPregnancyDetails: "",
        // Medical History
        allergies: "",
        currentMedications: "",
        pcosPcod: "No",
        pcosPcodDetails: "",
        // Family Medical History
        geneticDisorders: "No",
        geneticDisordersDetails: "",
        familyPregnancyComplications: "No",
        familyPregnancyComplicationsDetails: "",
        // Lifestyle and Habits
        smokingStatus: "Never smoked",
        alcoholConsumption: "None",
        drugUse: ["None"],
        dietHabits: "",
        exerciseFrequency: "Occasionally (1-2 times/week)",
        // Exercise and Physical Activity
        physicalActivityTypes: ["None"], // Default to None
        otherPhysicalActivity: "",
        activityFrequency: "Occasionally", // Match one of the option values
        // Additional comments
        additionalComments: "",
    });

    const originalContent: ContentType = {
        pageTitle: "Pregnancy Health Questionnaire",
        patientLabel: "Patient:",
        vitalSigns: "Vital Signs",
        obstetricHistory: "1. Obstetric History",
        isFirstPregnancy: "Is this your first pregnancy?",
        previousPregnancyDetails: "Please provide details of previous pregnancies (outcomes, complications, etc.)",
        lmpLabel: "Last Menstrual Period (LMP)",
        dueDateLabel: "Estimated Due Date",
        medicalHistory: "2. Medical History",
        preexistingConditions: "Pre-existing medical conditions recorded during registration:",
        pcosPcod: "Do you have or have you ever had PCOS/PCOD?",
        pcosPcodDetails: "Please provide details about your PCOS/PCOD (e.g., diagnosis, treatment, current status):",
        allergies: "Do you have any allergies? If yes, please list them.",
        currentMedications: "List any current medications or supplements you are taking:",
        familyMedicalHistory: "3. Family Medical History",
        geneticDisorders: "Are there any genetic disorders or birth defects in your family?",
        geneticDisordersDetails: "Please provide details about the genetic disorders or birth defects:",
        familyPregnancyComplications: "Is there a history of pregnancy complications in your close relatives?",
        familyPregnancyComplicationsDetails: "Please provide details about the family history of pregnancy complications:",
        lifestyleHabits: "4. Lifestyle and Habits",
        smokingStatus: "Smoking status:",
        alcoholConsumption: "Alcohol consumption during pregnancy:",
        drugUse: "Current medication or drug use (select all that apply):",
        dietHabits: "Describe your current diet habits:",
        exerciseFrequency: "How often do you exercise?",
        exerciseActivity: "8. Exercise and Physical Activity",
        physicalActivityTypes: "What types of physical activity do you engage in? (select all that apply)",
        activityFrequencyLabel: "How often do you engage in these physical activities?",
        additionalComments: "Additional Comments",
        additionalCommentsPrompt: "Any additional comments or concerns you would like to share with your healthcare provider:",
        saveButton: "Save Questionnaire",
        yes: "Yes",
        no: "No",
        notSure: "Not sure",
        neverSmoked: "Never smoked",
        quitBefore: "Quit before pregnancy",
        quitAfter: "Quit after becoming pregnant",
        currentlySmoking: "Currently smoking",
        none: "None",
        occasionalAlcohol: "Occasionally (less than once a month)",
        monthlyAlcohol: "Monthly",
        weeklyAlcohol: "Weekly",
        dailyAlcohol: "Daily",
        neverExercise: "Never",
        rarelyExercise: "Rarely (1-2 times/month)",
        occasionallyExercise: "Occasionally (1-2 times/week)",
        regularlyExercise: "Regularly (3-5 times/week)",
        dailyExercise: "Daily",
        dailyActivity: "Daily",
        weeklyActivity3_5: "3-5 times per week",
        weeklyActivity1_2: "1-2 times per week",
        occasionalActivity: "Occasionally",
        neverActivity: "Never",
        questionnaireSaved: "Questionnaire Saved",
        questionnaireSuccessfullySaved: "Your health questionnaire has been successfully saved.",
        // Option Labels
        drugUseOptionNone: "None",
        drugUseOptionPrescription: "Prescription medications",
        drugUseOptionOTC: "Over-the-counter medications",
        drugUseOptionHerbal: "Herbal supplements",
        drugUseOptionRecreational: "Recreational drugs",
        activityTypeWalking: "Walking",
        activityTypeJoggingRunning: "Jogging/Running",
        activityTypeSwimming: "Swimming",
        activityTypeYogaPilates: "Yoga/Pilates",
        activityTypeStrengthTraining: "Strength Training",
        activityTypeOther: "Other (Please specify below)",
    };

    const [content, setContent] = useState<ContentType>(originalContent);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- Cache ---
    const translationCache = useRef<{ [lang: string]: ContentType }>({
        en: originalContent,
    });

    // --- Event Handlers ---
    const handleCheckboxGroupChange = (field: 'drugUse', value: string) => { // Type field specifically
        const currentValues = formData[field];
        let updatedValues: string[];

        if (!Array.isArray(currentValues)) {
            console.warn(`Field "${String(field)}" is not an array in formData.`);
            return;
        }

        if (value === "None") {
            updatedValues = currentValues.includes("None") ? [] : ["None"];
        } else {
            updatedValues = currentValues.filter((v) => v !== "None");
            if (updatedValues.includes(value)) {
                updatedValues = updatedValues.filter((v) => v !== value);
            } else {
                updatedValues.push(value);
            }
            if (updatedValues.length === 0) { // Default back to none if empty
                updatedValues = ["None"];
            }
        }

        setFormData({ ...formData, [field]: updatedValues });
    };

    const handleActivityCheckboxChange = (value: string, checked: boolean | string) => {
        const currentTypes = formData.physicalActivityTypes;
        let newTypes: string[];

        if (checked) {
            if (value === 'None') {
                newTypes = ['None']; // Selecting None clears others
            } else {
                newTypes = [...currentTypes.filter(type => type !== 'None'), value]; // Add new, remove None
            }
        } else {
            newTypes = currentTypes.filter(type => type !== value); // Remove the unchecked item
            if (newTypes.length === 0) {
                newTypes = ['None']; // If removing the last item, default back to None
            }
        }
        // Ensure unique values if needed, though standard checkbox logic handles this
        // newTypes = [...new Set(newTypes)];

        setFormData({ ...formData, physicalActivityTypes: newTypes });
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Basic validation example
        if (!formData.bloodPressure || !formData.bodyTemperature || !formData.pulseRate) {
            toast({
                title: "Missing Information",
                description: "Please fill in all Vital Signs fields.",
                variant: "destructive",
            });
            return;
        }

        console.log("Submitting Questionnaire:", formData);
        setQuestionnaireData(formData);
        setQuestionnaireCompleted(true);

        // Use the potentially translated content for the toast
        const displayContent = (error && language !== 'en') ? originalContent : content;
        toast({
            title: displayContent.questionnaireSaved,
            description: displayContent.questionnaireSuccessfullySaved,
        });

        navigate("/dashboard"); // Or wherever you navigate after submission
    };

    // --- Translation Logic ---
    const translateText = async (text: string | string[], targetLang: string): Promise<string | string[]> => {
        if (targetLang === "en" || !text || (Array.isArray(text) && text.length === 0)) {
            return text;
        }
        // Ensure API Key is available
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) {
             console.error("Google Translate API key (VITE_GOOGLE_API_KEY) is missing.");
             setError("Translation service is not configured correctly (Missing API Key).");
             return text; // Return original text if key is missing
        }

        try {
            const response = await axios.post(
                `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
                { q: text, source: "en", target: targetLang, format: "text" }
            );
            const translations = response.data.data.translations;
            if (Array.isArray(text)) {
                return translations.map((t: { translatedText: string }) => t.translatedText);
            } else {
                return translations[0].translatedText;
            }
        } catch (err: any) {
            console.error("Translation API error:", err.response?.data || err.message || err);
            setError(`Failed to translate content to ${targetLang}. ${err.response?.data?.error?.message || ''}`);
            return text;
        }
    };

    const fetchAndCacheTranslations = useCallback(async (targetLang: string) => {
        if (targetLang === 'en') return;

        console.log(`Fetching translations for: ${targetLang}`);
        setIsLoading(true);
        setError(null); // Clear previous errors before fetching

        try {
            const keysToTranslate = Object.keys(originalContent) as Array<keyof ContentType>;
            const textsToTranslate = keysToTranslate.map(key => originalContent[key]);
            const translatedTexts = await translateText(textsToTranslate, targetLang) as string[];

            // Check if translation failed (error would be set in translateText)
            // Or if content didn't change (basic check)
             const checkIndex = keysToTranslate.indexOf('pageTitle');
             if (error || (checkIndex !== -1 && textsToTranslate[checkIndex] === translatedTexts[checkIndex])) {
                 if (!error) { // If no specific error from API, set a generic one
                     setError(`Translation to ${targetLang} might have failed (content unchanged).`);
                     console.warn(`Translation check failed for ${targetLang}. Content seems unchanged.`);
                 }
                 setIsLoading(false);
                 return; // Don't update cache or content if translation likely failed
             }

            const translatedContent: Partial<ContentType> = {};
            keysToTranslate.forEach((key, index) => {
                 if (index < translatedTexts.length) {
                    translatedContent[key] = translatedTexts[index];
                 } else {
                     console.warn(`Mismatch between keysToTranslate and translatedTexts at index ${index} for key ${key}`);
                     translatedContent[key] = originalContent[key]; // Fallback
                 }
            });

            translationCache.current[targetLang] = translatedContent as ContentType;
            console.log(`Cached translations for: ${targetLang}`);
            setContent(translatedContent as ContentType);

        } catch (err) { // Catch unexpected errors during reconstruction/caching
            console.error(`Error in fetchAndCacheTranslations for ${targetLang}:`, err);
            if (!error) setError(`An unexpected error occurred during translation processing for ${targetLang}.`);
        } finally {
            setIsLoading(false);
        }
    // Include 'error' in dependency array if setError is used inside a condition within the callback
    }, [originalContent, error]);


    // --- Effect for Language Change ---
    useEffect(() => {
        if (language === "en") {
            // console.log("Setting language to English (from original).");
            if (content !== originalContent) setContent(originalContent);
            setIsLoading(false);
            setError(null);
            return;
        }

        if (translationCache.current[language]) {
            // console.log(`Using cached translations for: ${language}`);
            if (content !== translationCache.current[language]) setContent(translationCache.current[language]);
            setIsLoading(false);
            setError(null);
            return;
        }

        // console.log(`Cache miss for: ${language}. Fetching...`);
        fetchAndCacheTranslations(language);

    // Prevent re-fetching if content object itself changes unnecessarily
    // Only re-run if language or the fetch function changes
    }, [language, fetchAndCacheTranslations, originalContent, content]); // `content` might be needed if comparison relies on it

    // --- Render Logic ---
    const displayContent = (error && language !== 'en') ? originalContent : content;

    // Loading state specifically for initial fetch for a new language
    if (isLoading && !translationCache.current[language] && language !== 'en') {
        return <Layout><div className="container mx-auto p-6 text-center">Loading translations for language: {language}...</div></Layout>;
    }

    return (
        <Layout>
            <div className="container mx-auto p-6 pb-16">
                {/* Subtle loading indicator for background updates */}
                {isLoading && <div className="text-sm text-gray-500 text-center mb-2">Updating language...</div>}
                {/* Prominent error display */}
                {error && language !== 'en' && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                        <p><strong>Translation Error:</strong> {error}</p>
                        <p className="text-sm">Displaying content in English.</p>
                    </div>
                )}

                {/* Form Title */}
                <h1 className="text-2xl font-bold mb-6">{displayContent.pageTitle}</h1>

                {/* Patient Info Card */}
                <Card className="mb-8">
                    <CardHeader className="bg-blue-50 rounded-t-lg">
                        <CardTitle>
                            {displayContent.patientLabel} {patientData.firstName} {patientData.lastName}
                        </CardTitle>
                    </CardHeader>
                </Card>

                {/* Form Sections */}
                <form onSubmit={handleSubmit}>
                    {/* Vital Signs */}
                    <QuestionSection title={displayContent.vitalSigns}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="blood-pressure">Blood Pressure (mmHg, e.g., 120/80)</Label>
                                <Input id="blood-pressure" type="text" placeholder="e.g., 120/80" value={formData.bloodPressure} onChange={(e) => setFormData({ ...formData, bloodPressure: e.target.value })} required/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="body-temperature">Body Temperature (°F, e.g., 98.6)</Label>
                                <Input id="body-temperature" type="text" placeholder="e.g., 98.6" value={formData.bodyTemperature} onChange={(e) => setFormData({ ...formData, bodyTemperature: e.target.value })} required/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pulse-rate">Pulse Rate (beats per minute, e.g., 72)</Label>
                                <Input id="pulse-rate" type="text" placeholder="e.g., 72" value={formData.pulseRate} onChange={(e) => setFormData({ ...formData, pulseRate: e.target.value })} required/>
                            </div>
                        </div>
                    </QuestionSection>

                    {/* Obstetric History */}
                    <QuestionSection title={displayContent.obstetricHistory}>
                        <div className="space-y-4">
                            <div>
                                <Label className="text-base font-medium">{displayContent.isFirstPregnancy}</Label>
                                <RadioGroup value={formData.isFirstPregnancy} onValueChange={(value) => setFormData({ ...formData, isFirstPregnancy: value })} className="mt-2">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id="first-preg-yes" /><Label htmlFor="first-preg-yes">{displayContent.yes}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="No" id="first-preg-no" /><Label htmlFor="first-preg-no">{displayContent.no}</Label></div>
                                </RadioGroup>
                            </div>
                            {formData.isFirstPregnancy === "No" && (
                                <div className="space-y-2">
                                    <Label htmlFor="previous-pregnancy-details" className="font-medium">{displayContent.previousPregnancyDetails}</Label>
                                    <Textarea id="previous-pregnancy-details" value={formData.previousPregnancyDetails} onChange={(e) => setFormData({ ...formData, previousPregnancyDetails: e.target.value })} />
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><Label className="text-base font-medium">{displayContent.lmpLabel}</Label><div className="mt-1">{patientData.lmp ? new Date(patientData.lmp).toLocaleDateString() : 'N/A'}</div></div>
                                <div><Label className="text-base font-medium">{displayContent.dueDateLabel}</Label><div className="mt-1">{patientData.dueDate ? new Date(patientData.dueDate).toLocaleDateString() : 'N/A'}</div></div>
                            </div>
                        </div>
                    </QuestionSection>

                    {/* Medical History */}
                    <QuestionSection title={displayContent.medicalHistory}>
                       <div className="space-y-4">
                           <div>
                               <Label className="text-base font-medium">{displayContent.preexistingConditions}</Label>
                               <div className="mt-2 ml-2 text-sm text-gray-700">
                                   {patientData.preexistingConditions && patientData.preexistingConditions.length > 0 ? (
                                       <ul className="list-disc list-inside space-y-1">
                                           {patientData.preexistingConditions.map((condition) => (<li key={condition}>{condition}</li>))}
                                           {patientData.preexistingConditions.includes("Other") && patientData.otherCondition && (<li>Other: {patientData.otherCondition}</li>)}
                                       </ul>
                                   ) : (<p className="italic">- None recorded -</p>)}
                               </div>
                           </div>
                           <div>
                               <Label className="text-base font-medium">{displayContent.pcosPcod}</Label>
                               <RadioGroup value={formData.pcosPcod} onValueChange={(value) => setFormData({ ...formData, pcosPcod: value })} className="mt-2">
                                   <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id="pcos-pcod-yes" /><Label htmlFor="pcos-pcod-yes">{displayContent.yes}</Label></div>
                                   <div className="flex items-center space-x-2"><RadioGroupItem value="No" id="pcos-pcod-no" /><Label htmlFor="pcos-pcod-no">{displayContent.no}</Label></div>
                                   <div className="flex items-center space-x-2"><RadioGroupItem value="Not sure" id="pcos-pcod-not-sure" /><Label htmlFor="pcos-pcod-not-sure">{displayContent.notSure}</Label></div>
                               </RadioGroup>
                           </div>
                           {formData.pcosPcod === "Yes" && ( <div className="space-y-2"><Label htmlFor="pcos-pcod-details" className="font-medium">{displayContent.pcosPcodDetails}</Label><Textarea id="pcos-pcod-details" value={formData.pcosPcodDetails} onChange={(e) => setFormData({ ...formData, pcosPcodDetails: e.target.value })}/></div>)}
                           <div className="space-y-2"><Label htmlFor="allergies" className="font-medium">{displayContent.allergies}</Label><Textarea id="allergies" value={formData.allergies} onChange={(e) => setFormData({ ...formData, allergies: e.target.value })} placeholder="e.g., Penicillin, Peanuts, None"/></div>
                           <div className="space-y-2"><Label htmlFor="current-medications" className="font-medium">{displayContent.currentMedications}</Label><Textarea id="current-medications" value={formData.currentMedications} onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })} placeholder="Include dosage and frequency if possible"/></div>
                       </div>
                    </QuestionSection>

                     {/* Family Medical History */}
                    <QuestionSection title={displayContent.familyMedicalHistory}>
                         <div className="space-y-4">
                             <div>
                                 <Label className="text-base font-medium">{displayContent.geneticDisorders}</Label>
                                 <RadioGroup value={formData.geneticDisorders} onValueChange={(value) => setFormData({ ...formData, geneticDisorders: value })} className="mt-2">
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id="genetic-yes" /><Label htmlFor="genetic-yes">{displayContent.yes}</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="No" id="genetic-no" /><Label htmlFor="genetic-no">{displayContent.no}</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="Not sure" id="genetic-not-sure" /><Label htmlFor="genetic-not-sure">{displayContent.notSure}</Label></div>
                                 </RadioGroup>
                             </div>
                              {formData.geneticDisorders === "Yes" && (<div className="space-y-2"><Label htmlFor="genetic-disorders-details" className="font-medium">{displayContent.geneticDisordersDetails}</Label><Textarea id="genetic-disorders-details" value={formData.geneticDisordersDetails} onChange={(e) => setFormData({ ...formData, geneticDisordersDetails: e.target.value })} placeholder="e.g., Cystic Fibrosis (cousin)"/></div>)}
                             <div>
                                 <Label className="text-base font-medium">{displayContent.familyPregnancyComplications}</Label>
                                 <RadioGroup value={formData.familyPregnancyComplications} onValueChange={(value) => setFormData({ ...formData, familyPregnancyComplications: value })} className="mt-2">
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id="complications-yes" /><Label htmlFor="complications-yes">{displayContent.yes}</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="No" id="complications-no" /><Label htmlFor="complications-no">{displayContent.no}</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="Not sure" id="complications-not-sure" /><Label htmlFor="complications-not-sure">{displayContent.notSure}</Label></div>
                                 </RadioGroup>
                             </div>
                             {formData.familyPregnancyComplications === "Yes" && (<div className="space-y-2"><Label htmlFor="family-pregnancy-complications-details" className="font-medium">{displayContent.familyPregnancyComplicationsDetails}</Label><Textarea id="family-pregnancy-complications-details" value={formData.familyPregnancyComplicationsDetails} onChange={(e) => setFormData({ ...formData, familyPregnancyComplicationsDetails: e.target.value })} placeholder="e.g., Preeclampsia (mother)"/></div>)}
                         </div>
                    </QuestionSection>

                    {/* Lifestyle and Habits */}
                    <QuestionSection title={displayContent.lifestyleHabits}>
                        <div className="space-y-6">
                           {/* Smoking */}
                            <div>
                                <Label className="text-base font-medium">{displayContent.smokingStatus}</Label>
                                <RadioGroup value={formData.smokingStatus} onValueChange={(value) => setFormData({ ...formData, smokingStatus: value })} className="mt-2 space-y-1">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Never smoked" id="smoking-never" /><Label htmlFor="smoking-never">{displayContent.neverSmoked}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Quit before pregnancy" id="smoking-quit-before" /><Label htmlFor="smoking-quit-before">{displayContent.quitBefore}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Quit after becoming pregnant" id="smoking-quit-after" /><Label htmlFor="smoking-quit-after">{displayContent.quitAfter}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Currently smoking" id="smoking-current" /><Label htmlFor="smoking-current">{displayContent.currentlySmoking}</Label></div>
                                </RadioGroup>
                            </div>
                            {/* Alcohol */}
                            <div>
                                <Label className="text-base font-medium">{displayContent.alcoholConsumption}</Label>
                                <RadioGroup value={formData.alcoholConsumption} onValueChange={(value) => setFormData({ ...formData, alcoholConsumption: value })} className="mt-2 space-y-1">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="None" id="alcohol-none" /><Label htmlFor="alcohol-none">{displayContent.none}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Occasionally (less than once a month)" id="alcohol-occasional" /><Label htmlFor="alcohol-occasional">{displayContent.occasionalAlcohol}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Monthly" id="alcohol-monthly" /><Label htmlFor="alcohol-monthly">{displayContent.monthlyAlcohol}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Weekly" id="alcohol-weekly" /><Label htmlFor="alcohol-weekly">{displayContent.weeklyAlcohol}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Daily" id="alcohol-daily" /><Label htmlFor="alcohol-daily">{displayContent.dailyAlcohol}</Label></div>
                                </RadioGroup>
                            </div>
                             {/* Drug Use */}
                            <div className="space-y-2">
                                <Label className="text-base font-medium">{displayContent.drugUse}</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                                    {drugUseOptions.map((option) => (
                                        <div key={option.value} className="flex items-center space-x-2">
                                        <Checkbox id={`drug-use-${option.value.replace(/\s+/g, '-')}`} checked={formData.drugUse.includes(option.value)} onCheckedChange={() => handleCheckboxGroupChange("drugUse", option.value)}/>
                                        <Label htmlFor={`drug-use-${option.value.replace(/\s+/g, '-')}`} className="font-normal">{displayContent[option.translationKey] || option.value}</Label>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Please be honest. This information is confidential and helps ensure the best care.</p>
                            </div>
                            {/* Diet Habits */}
                            <div className="space-y-2"><Label htmlFor="diet-habits" className="font-medium">{displayContent.dietHabits}</Label><Textarea id="diet-habits" value={formData.dietHabits} onChange={(e) => setFormData({ ...formData, dietHabits: e.target.value })} placeholder="e.g., Balanced, vegetarian, high protein..." rows={3}/></div>
                             {/* Exercise Frequency */}
                             <div>
                                <Label className="text-base font-medium">{displayContent.exerciseFrequency}</Label>
                                <RadioGroup value={formData.exerciseFrequency} onValueChange={(value) => setFormData({ ...formData, exerciseFrequency: value })} className="mt-2 space-y-1">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Never" id="exercise-never" /><Label htmlFor="exercise-never">{displayContent.neverExercise}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Rarely (1-2 times/month)" id="exercise-rarely" /><Label htmlFor="exercise-rarely">{displayContent.rarelyExercise}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Occasionally (1-2 times/week)" id="exercise-occasionally" /><Label htmlFor="exercise-occasionally">{displayContent.occasionallyExercise}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Regularly (3-5 times/week)" id="exercise-regularly" /><Label htmlFor="exercise-regularly">{displayContent.regularlyExercise}</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Daily" id="exercise-daily" /><Label htmlFor="exercise-daily">{displayContent.dailyExercise}</Label></div>
                                </RadioGroup>
                            </div>
                        </div>
                    </QuestionSection>

                     {/* Exercise and Physical Activity */}
                    <QuestionSection title={displayContent.exerciseActivity}>
                        <div className="space-y-6">
                            {/* Activity Types */}
                            <div className="space-y-2">
                                <Label className="text-base font-medium">{displayContent.physicalActivityTypes}</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                                    {physicalActivityOptions.map(option => (
                                        <div key={option.value} className="flex items-center space-x-2">
                                        <Checkbox id={`activity-type-${option.value.replace(/[\s/]/g, '-')}`} checked={formData.physicalActivityTypes.includes(option.value)} onCheckedChange={(checked) => handleActivityCheckboxChange(option.value, checked)}/>
                                        <Label htmlFor={`activity-type-${option.value.replace(/[\s/]/g, '-')}`} className="font-normal">{displayContent[option.translationKey] || option.value}</Label>
                                        </div>
                                    ))}
                                </div>
                                {formData.physicalActivityTypes.includes("Other") && (
                                    <div className="space-y-1 mt-2 pl-6">
                                        <Label htmlFor="other-physical-activity" className="text-sm font-medium">Specify "Other" activity:</Label>
                                        <Input id="other-physical-activity" value={formData.otherPhysicalActivity} onChange={(e) => setFormData({...formData, otherPhysicalActivity: e.target.value})} placeholder="e.g., Dancing, Cycling"/>
                                    </div>
                                )}
                            </div>
                            {/* Activity Frequency */}
                             <div>
                                <Label className="text-base font-medium">{displayContent.activityFrequencyLabel}</Label>
                                <RadioGroup value={formData.activityFrequency} onValueChange={(value) => setFormData({ ...formData, activityFrequency: value })} className="mt-2 space-y-1">
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="Daily" id="activity-daily" /><Label htmlFor="activity-daily">{displayContent.dailyActivity}</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="3-5 times per week" id="activity-3-5" /><Label htmlFor="activity-3-5">{displayContent.weeklyActivity3_5}</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="1-2 times per week" id="activity-1-2" /><Label htmlFor="activity-1-2">{displayContent.weeklyActivity1_2}</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="Occasionally" id="activity-occasionally" /><Label htmlFor="activity-occasionally">{displayContent.occasionalActivity}</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="Never" id="activity-never" /><Label htmlFor="activity-never">{displayContent.neverActivity}</Label></div>
                                 </RadioGroup>
                            </div>
                        </div>
                    </QuestionSection>

                    {/* Additional Comments */}
                    <QuestionSection title={displayContent.additionalComments}>
                         <div className="space-y-2"><Label htmlFor="additional-comments" className="font-medium">{displayContent.additionalCommentsPrompt}</Label><Textarea id="additional-comments" value={formData.additionalComments} onChange={(e) => setFormData({ ...formData, additionalComments: e.target.value })} className="min-h-[100px]" placeholder="Share any other relevant information or questions here."/></div>
                    </QuestionSection>

                    {/* Submit Button */}
                    <div className="flex justify-center mt-8 mb-4">
                        <Button type="submit" size="lg" className="materna-button w-full max-w-xs">
                            {displayContent.saveButton}
                        </Button>
                    </div>
                </form>
            </div>
        </Layout>
    );
};

export default QuestionnaireForm;