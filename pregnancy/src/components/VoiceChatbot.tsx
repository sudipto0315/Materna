// src/components/VoiceChatbot.tsx
import React, { useState, useEffect } from 'react';
import { sendToGemini } from '../lib/api';
import Layout from "@/components/Layout";

const VoiceChatbot: React.FC = () => {
  const [history, setHistory] = useState<{ user: string; bot: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [hindiVoice, setHindiVoice] = useState<any>(null);

  console.log('VoiceChatbot rendered, history:', history); // Debug log

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.lang = 'hi-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setRecognition(rec);
    } else {
      alert('इस ब्राउज़र में वॉयस रिकॉग्निशन समर्थित नहीं है। कृपया दूसरा ब्राउज़र आज़माएं।');
    }

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const voices = synth.getVoices();
      const voice = voices.find((v) => v.lang === 'hi-IN');
      setHindiVoice(voice);
    };
    synth.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const speak = (text: string) => {
    if (hindiVoice) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = hindiVoice;
      window.speechSynthesis.speak(utterance);
    } else {
      console.log('हिंदी वॉयस उपलब्ध नहीं है।');
    }
  };

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
          const response = await sendToGemini(transcript);
          setHistory([...history, { user: transcript, bot: response }]);
          speak(response);
        } catch (error) {
          console.error('Error:', error);
          setHistory([...history, { user: transcript, bot: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।' }]);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setHistory([...history, { user: transcript || 'सुनाई नहीं दिया', bot: 'कृपया फिर से बोलें।' }]);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    }
  }, [recognition, history]);

  return (
    <div className="chatbot">
      <div className="chat-window">
        {history.length === 0 ? (
          <p>कोई संदेश नहीं। बोलना शुरू करने के लिए नीचे बटन दबाएं!</p>
        ) : (
          history.map((msg, index) => (
            <div key={index} className="message-pair">
              <p className="message user"><strong>आप:</strong> {msg.user}</p>
              <p className="message bot"><strong>बॉट:</strong> {msg.bot}</p>
            </div>
          ))
        )}
      </div>
      <div className="voice-control">
        <button onClick={isListening ? handleStopListening : handleStartListening}>
          {isListening ? 'सुनना बंद करें' : 'सुनना शुरू करें'}
        </button>
        {isListening && transcript && <p>सुन रहा है: {transcript}</p>}
      </div>
    </div>
  );
};

export default VoiceChatbot;