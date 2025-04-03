// src/hooks/useTranslations.ts
import { useState, useEffect } from 'react';
import { useLanguage, useTranslateBatch } from '@/contexts/LanguageContext';

/**
 * A custom hook for managing translations with caching
 * @param originalContent Object containing original English content
 * @returns Object with translated content, loading state, and error state
 */
export function useTranslations<T extends Record<string, string>>(originalContent: T) {
  const { language } = useLanguage();
  const { translateBatch, isTranslating } = useTranslateBatch();
  const [content, setContent] = useState<T>(originalContent);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateTranslations = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        if (language === 'en') {
          setContent(originalContent);
        } else {
          const translatedContent = await translateBatch(originalContent);
          setContent(translatedContent);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Translation error:', err);
        setError('Failed to translate content');
        setContent(originalContent); // Fallback to original content
        setIsLoading(false);
      }
    };

    updateTranslations();
  }, [language, originalContent, translateBatch]);

  return {
    content,
    isLoading: isLoading || isTranslating,
    error
  };
}