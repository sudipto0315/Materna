import React, { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../locales/translations';
import Navigation from '../components/Navigation';
import TextChatbot from '../components/TextChatbot';
import VoiceChatbot from '../components/VoiceChatbot';
import { useApp } from '../contexts/AppContext';
import { languageNames } from '../constants/languageNames.ts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStethoscope, faKeyboard, faMicrophone } from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const ChatbotPage: React.FC = () => {
  const { language } = useLanguage();
  const t = (key: string) => translations[language][key];
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const { medicalReports, patientData } = useApp();

  const initialPrompt = useMemo(() => {
    if (!medicalReports || medicalReports.length === 0) {
      return 'No medical reports available for analysis.';
    }

    let prompt = `Here is the medical report data for patient ${patientData.firstName} ${patientData.lastName} (ID: ${patientData.id}):\n\n`;
    medicalReports.forEach((report, index) => {
      prompt += `Report ${index + 1}: Date: ${report.date}, Category: ${report.category}\n`;
      if (report.analysisResults && report.analysisResults.status === 'success') {
        const analysis = report.analysisResults;
        prompt += `Analysis: ${analysis.normal_results} normal, ${analysis.borderline_results} borderline, ${analysis.high_risk_results} high risk\n`;
        if (analysis.all_results && analysis.all_results.length > 0) {
          prompt += "Test Results:\n";
          analysis.all_results.forEach((result: any) => {
            prompt += `- ${result.test_name}: ${result.result_value} ${result.result_unit} (Ref: ${result.reference_range}, Risk: ${result.risk_level}, Direction: ${result.direction})\n`;
          });
        }
      } else {
        prompt += "No analysis data available.\n";
      }
      if (report.notes) {
        prompt += `Notes: ${report.notes}\n`;
      }
      prompt += "\n";
    });
    prompt += `Analyze this maternal patient profile and provide a health assessment in ${languageNames[language]}. Please format the response with each section starting on a new line, and within each section, list each piece of information or detail on a separate line. The sections to include are:\n`;
    prompt += "1. Patient Profile\n";
    prompt += "2. Health Status Analysis\n";
    prompt += "3. Potential Risk Indicators\n";
    prompt += "4. Recommendations\n";
    prompt += "5. Next Steps\n";
    return prompt;
  }, [medicalReports, patientData, language]);

  return (
    <div>
      <Navigation />
      <div className="app">
        <h1>
          <FontAwesomeIcon icon={faStethoscope} /> {t('chatbotApp')}
        </h1>
        <div className="mode-selector">
          <button onClick={() => setMode('text')}>
            <FontAwesomeIcon icon={faKeyboard} /> {t('textChatbot')}
          </button>
          <button onClick={() => setMode('voice')}>
            <FontAwesomeIcon icon={faMicrophone} /> {t('voiceChatbot')}
          </button>
        </div>
        {mode === 'text' ? (
          <TextChatbot initialPrompt={initialPrompt} language={language} />
        ) : (
          <VoiceChatbot initialPrompt={initialPrompt} language={language} />
        )}
      </div>
    </div>
  );
};

export default ChatbotPage;