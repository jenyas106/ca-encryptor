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
  timeTaken?: string; // Час у мс
}

export function useCryptoWorker() {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const currentOperationId = useRef(0);
  const lastMode = useRef<Mode>('encrypt'); 

  useEffect(() => {
    if (typeof window !== 'undefined' && !workerRef.current) {
      // timestamp для скидання кешу
      workerRef.current = new Worker(`/worker.js?v=${Date.now()}`);
      
      workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const { type, result: outputResult, fileName: outputFileName, progress: prog, message, operationId, timeTaken } = e.data;
        
        if (operationId !== currentOperationId.current) return;

        if (type === 'progress') {
          // Плавне оновлення прогресу
          setProgress(prev => Math.max(prev, prog || 0));
        } 
        else if (type === 'result') {
          setProgress(100);
          if (timeTaken) setExecutionTime(timeTaken);

          if (typeof outputResult === 'string') {
            setResult(outputResult);
          } else if (outputResult instanceof Uint8Array) {
             let finalDownloadName = '';
             if (lastMode.current === 'encrypt') {
                 finalDownloadName = outputFileName ? `${outputFileName}.enc` : 'encrypted_file.enc';
             } else {
                 finalDownloadName = outputFileName || 'decrypted_file.bin';
             }
             handleFileDownload(outputResult, finalDownloadName);
             setResult(`File processed successfully: ${finalDownloadName}`);
          }
          
          // Скидаємо прогрес через 1.5с
          setTimeout(() => setProgress(0), 1500);
        } 
        else if (type === 'error') {
          setError(message || "Unknown error occurred");
          setProgress(0);
        }
      };
    }
    return () => { workerRef.current?.terminate(); workerRef.current = null; };
  }, []);

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
    setExecutionTime(null);
    setProgress(1); // Починаємо з 1% для візуальної реакції
    
    currentOperationId.current += 1;
    lastMode.current = mode;

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

  const handleFileDownload = (data: Uint8Array, name: string) => {
    const blob = new Blob([data as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetWorkerState = () => {
    setResult("");
    setError(null);
    setProgress(0);
    setExecutionTime(null);
  };

  return {
    processData, progress, result, setResult, error, setError, resetWorkerState, executionTime
  };
}