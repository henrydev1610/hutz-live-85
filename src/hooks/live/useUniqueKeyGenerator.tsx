
import { useRef, useCallback } from 'react';

export const useUniqueKeyGenerator = () => {
  const keyMapRef = useRef(new Map<string, string>());
  const counterRef = useRef(0);

  const generateUniqueKey = useCallback((id: string, prefix = 'item') => {
    // Se já existe uma chave para este ID, reutilizar
    if (keyMapRef.current.has(id)) {
      return keyMapRef.current.get(id)!;
    }

    // Gerar nova chave única
    const uniqueKey = `${prefix}-${id}-${Date.now()}-${counterRef.current++}`;
    keyMapRef.current.set(id, uniqueKey);
    return uniqueKey;
  }, []);

  const clearKey = useCallback((id: string) => {
    keyMapRef.current.delete(id);
  }, []);

  const clearAllKeys = useCallback(() => {
    keyMapRef.current.clear();
    counterRef.current = 0;
  }, []);

  return {
    generateUniqueKey,
    clearKey,
    clearAllKeys
  };
};
