import React, { useState, useEffect } from 'react';
import { sendToGemini } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../locales/translations';
import { languageNames, recognitionLangMap } from '../constants/languageNames';

interface VoiceChatbotProps {
  initialPrompt: string;
  language: string;
}

const VoiceChatbot: React.FC<VoiceChatbotProps> = ({ initialPrompt, language }) => {
  const { language: currentLanguage } = useLanguage();
  const t = (key: string) => translations[currentLanguage][key];
  const [history, setHistory] = useState<{ user: string; bot: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [selectedVoice, setSelectedVoice] = useState<any>(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setRecognition(rec);
    } else {
      alert(t('speechRecognitionNotSupported'));
    }
  }, []);

  useEffect(() => {
    if (recognition) {
      recognition.lang = recognitionLangMap[language];
    }
  }, [language, recognition]);

  useEffect(() => {
    const synth = window.speechSynthesis;
    const updateVoice = () => {
      const voices = synth.getVoices();
      const voice = voices.find((v) => v.lang.startsWith(language + '-'));
      setSelectedVoice(voice);
    };
    synth.onvoiceschanged = updateVoice;
    updateVoice();
  }, [language]);

  const speak = (text: string) => {
    if (selectedVoice) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedVoice;
      window.speechSynthesis.speak(utterance);
    } else {
      console.log(`No voice available for language: ${language}`);
    }
  };

  useEffect(() => {
    if (initialPrompt && history.length === 0) {
      const sendInitialPrompt = async () => {
        try {
          const response = await sendToGemini(initialPrompt);
          setHistory([{ user: '', bot: response }]);
          speak(response);
        } catch (error) {
          console.error('Error sending initial prompt:', error);
          setHistory([{ user: '', bot: t('errorMessage') }]);
        }
      };
      sendInitialPrompt();
    }
  }, [initialPrompt, t, speak]);

  const handleStartListening = () => {
    if (recognition && !isListening) {
      setIsListening(true);
      setTranscript('');
      recognition.start();
    }
  };

  const handleStopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  useEffect(() => {
    if (recognition) {
      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTranscript(transcript);
        try {
          const modifiedInput = `User says: ${transcript}. Please respond in ${languageNames[language]}.`;
          const response = await sendToGemini(modifiedInput);
          setHistory([...history, { user: transcript, bot: response }]);
          speak(response);
        } catch (error) {
          console.error('Error:', error);
          setHistory([...history, { user: transcript, bot: t('errorMessage') }]);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setHistory([...history, { user: transcript || t('didNotHear'), bot: t('pleaseSpeakAgain') }]);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    }
  }, [recognition, history, language, t, speak]);

  return (
    <div className="chatbot">
      <div className="chat-window">
        {history.length === 0 ? (
          <p>{t('noMessagesVoice')}</p>
        ) : (
          history.map((msg, index) => (
            <div key={index} className="message-pair">
              {msg.user && (
                <p className="message user">
                  <strong>{t('you')}:</strong> <span className="user-text">{msg.user}</span>
                </p>
              )}
              <p className="message bot" style={{ whiteSpace: 'pre-wrap' }}>
                <strong>{t('bot')}:</strong> <span className="bot-text">{msg.bot}</span>
              </p>
            </div>
          ))
        )}
      </div>
      <div className="voice-control">
        <button onClick={isListening ? handleStopListening : handleStartListening}>
          {isListening ? t('stopListening') : t('startListening')}
        </button>
        {isListening && transcript && <p>{t('listening')}: {transcript}</p>}
      </div>
    </div>
  );
};

export default VoiceChatbot;