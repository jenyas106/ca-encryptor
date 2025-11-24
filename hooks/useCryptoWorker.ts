// hooks/useCryptoWorker.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { type AutomataRule } from "../lib/rule30";

type Mode = 'encrypt' | 'decrypt';
type ContentType = 'text' | 'file';

interface WorkerMessage {
  type: 'progress' | 'result' | 'error';
  result?: string | Uint8Array;
  fileName?: string;
  progress?: number;
  message?: string;
  operationId?: number;
}

export function useCryptoWorker() {
  // Стан для результатів та прогресу
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  // Референси
  const workerRef = useRef<Worker | null>(null);
  const currentOperationId = useRef(0);

  // Ініціалізація воркера
  useEffect(() => {
    if (typeof window !== 'undefined' && !workerRef.current) {
      workerRef.current = new Worker('/worker.js');
      
      workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const { type, result: outputResult, fileName: outputFileName, progress: prog, message, operationId } = e.data;
        
        // Ігноруємо старі запити
        if (operationId !== currentOperationId.current) return;

        if (type === 'progress') {
          setProgress(prog || 0);
        } 
        else if (type === 'result') {
          setProgress(100);
          
          if (typeof outputResult === 'string') {
            setResult(outputResult);
          } else if (outputResult instanceof Uint8Array) {
             // Логіка скачування файлу
             handleFileDownload(outputResult, outputFileName || 'file.bin');
             setResult(`Файл успішно збережено: ${outputFileName}`);
          }
          
          setTimeout(() => setProgress(0), 1000);
        } 
        else if (type === 'error') {
          setError(message || "Невідома помилка");
          setProgress(0);
        }
      };

      workerRef.current.onerror = (err) => {
        setError(`Помилка воркера: ${err.message}`);
        setProgress(0);
      };
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Функція запуску (експортуємо її назовні)
  const processData = useCallback((
    data: string | Uint8Array, 
    key: string, 
    rule: AutomataRule, 
    mode: Mode, 
    contentType: ContentType,
    fileName?: string
  ) => {
    setError(null);
    setResult("");
    setProgress(1);
    
    currentOperationId.current += 1;

    // Підготовка імені файлу
    let fileNameToSend = fileName || '';
    if (contentType === 'file' && fileName) {
        if (mode === 'encrypt') {
            fileNameToSend = fileName;
        } else {
            fileNameToSend = fileName.endsWith('.enc') ? fileName.slice(0, -4) : fileName;
        }
    }

    workerRef.current?.postMessage({
      data,
      key,
      rule,
      mode,
      isBinary: contentType === 'file',
      fileName: fileNameToSend,
      operationId: currentOperationId.current
    });
  }, []);

  // Допоміжна функція скачування (внутрішня)
  const handleFileDownload = (data: Uint8Array, name: string) => {
    // 👇 ВИПРАВЛЕННЯ: додаємо "as any" або "as BlobPart", щоб заспокоїти TS
    const blob = new Blob([data as any], { type: 'application/octet-stream' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Чистимо пам'ять
    URL.revokeObjectURL(url);
  };

  // Функція скидання станів
  const resetWorkerState = () => {
    setResult("");
    setError(null);
    setProgress(0);
  };

  return {
    processData,
    progress,
    result,
    setResult, // Експортуємо, щоб можна було очищати вручну
    error,
    setError,
    resetWorkerState
  };
}