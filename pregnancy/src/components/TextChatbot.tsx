// src/components/TextChatbot.tsx
import React, { useState } from 'react';
import { sendToGemini } from '../lib/api';
import Layout from "@/components/Layout";

const TextChatbot: React.FC = () => {
  const [history, setHistory] = useState<{ user: string; bot: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  console.log('TextChatbot rendered, history:', history); // Debug log

  const handleSend = async () => {
    if (input.trim() === '') return;
    setLoading(true);
    try {
      const response = await sendToGemini(input);
      setHistory([...history, { user: input, bot: response }]);
      setInput('');
    } catch (error) {
      console.error('Error:', error);
      setHistory([...history, { user: input, bot: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot">
      <div className="chat-window">
        {history.length === 0 ? (
          <p>कोई संदेश नहीं। चैट शुरू करने के लिए नीचे टाइप करें!</p>
        ) : (
          history.map((msg, index) => (
            <div key={index} className="message-pair">
              <p className="message user"><strong>आप:</strong> {msg.user}</p>
              <p className="message bot"><strong>बॉट:</strong> {msg.bot}</p>
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
          placeholder="अपना संदेश टाइप करें"
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading}>
          {loading ? 'भेज रहा है...' : 'भेजें'}
        </button>
      </div>
    </div>
  );
};

export default TextChatbot;