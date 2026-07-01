import { useState, useEffect } from 'react';
import type { Chatbot } from '../types';

interface UseChatbotNameReturn {
  chatbotName: string;
  isEditingName: boolean;
  tempChatbotName: string;
  handleStartEditingName: () => void;
  handleSaveName: () => void;
  handleCancelEditingName: () => void;
  setTempChatbotName: (name: string) => void;
}

export const useChatbotName = (
  chatbot: Chatbot | null,
  updateChatbotName: (name: string) => void,
  defaultName: string
): UseChatbotNameReturn => {
  const [chatbotName, setChatbotName] = useState<string>(defaultName);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempChatbotName, setTempChatbotName] = useState<string>(defaultName);

  useEffect(() => {
    if (chatbot?.CHATBOT_NAME) {
      setChatbotName(chatbot.CHATBOT_NAME);
      setTempChatbotName(chatbot.CHATBOT_NAME);
    }
  }, [chatbot]);

  const handleStartEditingName = () => {
    setIsEditingName(true);
    setTempChatbotName(chatbotName);
  };

  const handleSaveName = () => {
    setChatbotName(tempChatbotName);
    setIsEditingName(false);
    if (chatbot) updateChatbotName(tempChatbotName);
  };

  const handleCancelEditingName = () => {
    setIsEditingName(false);
    setTempChatbotName(chatbotName);
  };

  return {
    chatbotName,
    isEditingName,
    tempChatbotName,
    handleStartEditingName,
    handleSaveName,
    handleCancelEditingName,
    setTempChatbotName,
  };
};
