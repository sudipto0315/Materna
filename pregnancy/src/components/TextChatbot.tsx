// src/components/TextChatbot.tsx
import React, { useState, useEffect } from 'react';
import { sendToGemini } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../locales/translations';
import { languageNames } from '../constants/languageNames';
import Layout from "@/components/Layout";

interface TextChatbotProps {
  initialPrompt: string;
  language: string;
}

const TextChatbot: React.FC<TextChatbotProps> = ({ initialPrompt, language }) => {
  const { language: currentLanguage } = useLanguage();
  const t = (key: string) => translations[currentLanguage][key];
  const [history, setHistory] = useState<{ user: string; bot: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  console.log('TextChatbot rendered, history:', history); // Debug log

  // Send initial prompt when component mounts and history is empty
  useEffect(() => {
    if (initialPrompt && history.length === 0) {
      const sendInitialPrompt = async () => {
        setLoading(true);
        try {
          const response = await sendToGemini(initialPrompt);
          setHistory([{ user: '', bot: response }]);
        } catch (error) {
          console.error('Error sending initial prompt:', error);
          setHistory([{ user: '', bot: t('errorMessage') }]);
        } finally {
          setLoading(false);
        }
      };
      sendInitialPrompt();
    }
  }, [initialPrompt, t]);

  const handleSend = async () => {
    if (input.trim() === '') return;
    setLoading(true);
    try {
      const modifiedInput = `User says: ${input}. Please respond in ${languageNames[language]}.`;
      const response = await sendToGemini(modifiedInput);
      setHistory([...history, { user: input, bot: response }]);
      setInput('');
    } catch (error) {
      console.error('Error:', error);
      setHistory([...history, { user: input, bot: t('errorMessage') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot">
      <div className="chat-window">
        {history.length === 0 ? (
          <p>{t('noMessagesText')}</p>
        ) : (
          history.map((msg, index) => (
            <div key={index} className="message-pair">
              {msg.user && (
                <p className="message user">
                  <strong>{t('you')}:</strong> {msg.user}
                </p>
              )}
              <p className="message bot" style={{ whiteSpace: 'pre-wrap' }}>
                <strong>{t('bot')}:</strong> {msg.bot}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t('typeYourMessage')}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading}>
          {loading ? t('sending') : t('send')}
        </button>
      </div>
    </div>
  );
};

export default TextChatbot;