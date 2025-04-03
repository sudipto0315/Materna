// src/pages/Chatbot.tsx
import React, { useState } from 'react';
import Navigation from '../components/Navigation'; // Adjust the path if needed
import TextChatbot from '../components/TextChatbot';
import VoiceChatbot from '../components/VoiceChatbot';
import '../App.css'; // Ensure App.css styles are applied

const ChatbotPage: React.FC = () => {
  const [mode, setMode] = useState<'text' | 'voice'>('text'); // Default to text mode

  return (
    <div>
      <Navigation /> {/* Add navigation bar at the top */}
      <div className="app">
        <h1>चैटबॉट ऐप</h1>
        <div className="mode-selector">
          <button onClick={() => setMode('text')}>टेक्स्ट चैटबॉट</button>
          <button onClick={() => setMode('voice')}>वॉयस चैटबॉट</button>
        </div>
        {mode === 'text' ? <TextChatbot /> : <VoiceChatbot />}
      </div>
    </div>
  );
};

export default ChatbotPage;