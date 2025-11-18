// app/page.tsx
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import RuleSidebar from "../components/RuleSidebar"; 
import { type AutomataRule } from "../lib/rule30";

// --- ТИПИ ---
type ContentType = 'text' | 'file';
type Mode = 'encrypt' | 'decrypt';

// --- НАЛАШТУВАННЯ ВОРКЕРА ---
declare global {
  interface Window {
    worker?: Worker;
  }
}

export default function Home() {
  // --- СТАН ---
  const [text, setText] = useState("");
  const [key, setKey] = useState("");
  const [result, setResult] = useState("");
  const [mode, setMode] = useState<Mode>("encrypt");
  const [selectedRule, setSelectedRule] = useState<AutomataRule>("R30"); 

  const [contentType, setContentType] = useState<ContentType>('text');
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Стан для мобільного меню
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Прогрес виконання
  const [progress, setProgress] = useState(0); 
  const workerRef = useRef<Worker | null>(null);
  const currentOperationId = useRef(0); 

  // --- ЛОГІКА WEB WORKER ---
  useEffect(() => {
    if (typeof window !== 'undefined' && !workerRef.current) {
        workerRef.current = new Worker('/worker.js');

        workerRef.current.onmessage = (e) => {
            const { type, result: outputResult, fileName: outputFileName, progress, message, operationId } = e.data;
            
            if (operationId !== currentOperationId.current) return;
            
            if (type === 'progress') {
                setProgress(progress);
            } else if (type === 'result') {
                setProgress(100); 
                
                if (contentType === 'text') {
                    setResult(outputResult as string);
                } else {
                    const outputBytes = outputResult as Uint8Array;
                    let finalDownloadName = '';
                    if (mode === 'encrypt') {
                        finalDownloadName = outputFileName ? `${outputFileName}.enc` : 'encrypted_file.enc';
                    } else {
                        finalDownloadName = outputFileName || 'decrypted_file.bin';
                    }
                    downloadCipherFile(outputBytes, finalDownloadName);
                    setResult(`Файл успішно оброблено та збережено як: ${finalDownloadName}`); 
                }
                setTimeout(() => setProgress(0), 1000); 
            } else if (type === 'error') {
                setError(`Помилка обробки: ${message}`);
                setProgress(0);
            }
        };
        
        workerRef.current.onerror = (err) => {
            setError(`Критична помилка воркера: ${err.message}`);
            setProgress(0);
        };
    }
    return () => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
    };
  }, [contentType, mode]); 

  // --- ДОПОМІЖНІ ФУНКЦІЇ ---
  const resetFields = () => {
      setText("");
      setResult("");
      setFile(null);
      setFileData(null);
      setError(null);
      setProgress(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError(null);
    setResult('');
    
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result instanceof ArrayBuffer) {
          setFileData(new Uint8Array(event.target.result));
        }
      };
      reader.onerror = () => setError("Помилка читання файлу.");
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setFileData(null);
    }
  };

  const downloadCipherFile = (data: Uint8Array, fileName: string) => {
    const blob = new Blob([data as BlobPart], { type: 'application/octet-stream' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (progress > 0) return; 

    if (!key || (contentType === 'text' && !text) || (contentType === 'file' && !fileData)) {
      setError("Будь ласка, введіть ключ та дані.");
      return;
    }
    
    currentOperationId.current += 1; 
    const dataToSend = contentType === 'text' ? text : fileData;
    const isBinary = contentType === 'file';
    
    let fileNameToSend = '';
    if (isBinary && file) {
        if (mode === 'encrypt') {
            fileNameToSend = file.name; 
        } else {
            fileNameToSend = file.name.endsWith('.enc') ? file.name.slice(0, -4) : file.name;
        }
    }
    
    setProgress(1); 
    workerRef.current?.postMessage({
        data: dataToSend,
        key: key,
        rule: selectedRule,
        mode: mode,
        isBinary: isBinary,
        fileName: fileNameToSend,
        operationId: currentOperationId.current
    });
  };
  
  // --- UI COMPONENTS ---
  const ContentInput = useMemo(() => {
    if (contentType === 'text') {
      return (
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition font-mono text-sm"
          placeholder={mode === "encrypt" ? "Введіть секретний текст..." : "Вставте Base64 шифротекст..."}
        />
      );
    } else { 
      return (
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-600 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition duration-300 relative">
          <input 
            type="file" 
            id="file-upload" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="text-center pointer-events-none">
              <p className="text-lg text-blue-400 font-medium">
                {file ? file.name : "Натисніть або перетягніть файл"}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {file ? `${(file.size / 1024).toFixed(2)} KB` : "Будь-який формат (jpg, pdf, mp3, etc.)"}
              </p>
              {fileData && <p className="text-xs text-green-400 mt-2">✓ Дані завантажено</p>}
          </div>
        </div>
      );
    }
  }, [contentType, mode, text, file, fileData]);
  
  const ResultArea = useMemo(() => {
      if (!result) return null;
      if (contentType === 'text') {
          return (
            <div className="mt-8">
                <label className="block mb-2 text-sm font-medium text-gray-300">Результат:</label>
                <textarea
                    readOnly
                    value={result}
                    rows={6}
                    className="w-full p-4 bg-gray-800 border border-gray-600 rounded-lg resize-none font-mono text-green-400 text-sm"
                />
                <button 
                    onClick={() => navigator.clipboard.writeText(result)}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                    Копіювати в буфер обміну
                </button>
            </div>
          );
      } else {
          return (
              <div className="mt-6 p-4 bg-green-900/30 border border-green-600 rounded-lg">
                  <p className="text-green-400 font-medium flex items-center"><span className="mr-2">✓</span> {result}</p>
              </div>
          );
      }
  }, [contentType, result]);

  return (
    <div className="flex min-h-screen bg-gray-900 text-white font-sans relative overflow-hidden">
      
      {/* === MOBILE OVERLAY === */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      {/* === SIDEBAR (Responsive) === */}
      {/* На десктопі (md:): static, block, translate-0
         На мобільному: fixed, inset-y-0, z-50, transition-transform
      */}
      <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Кнопка закриття для мобільних */}
        <div className="md:hidden absolute top-4 right-4">
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <RuleSidebar 
          currentRule={selectedRule}
          onRuleChange={(rule) => {
              setSelectedRule(rule);
              resetFields();
              setIsSidebarOpen(false); // Закриваємо меню на мобільному після вибору
          }}
        />
      </aside>

      {/* === MAIN CONTENT === */}
      <main className="flex-grow p-4 md:p-10 overflow-y-auto h-screen">
        <div className="max-w-4xl mx-auto pb-20">
            
            <header className="mb-8 md:mb-10 border-b border-gray-700 pb-6 flex flex-col md:block">
                
                <div className="flex items-center justify-between mb-4 md:mb-2">
                     {/* Кнопка відкриття меню (Мобільна) */}
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="md:hidden p-2 -ml-2 mr-4 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition"
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>

                    <h1 className="text-2xl md:text-4xl font-bold text-blue-400 flex-grow">
                        CA Crypto
                    </h1>
                </div>

                <p className="text-sm md:text-base text-gray-400">
                    Система шифрування на основі клітинних автоматів (Wolfram's <span className="text-blue-300 font-mono">{selectedRule}</span>).
                </p>
            </header>

            {error && (
                <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-lg flex items-start text-sm">
                    <span className="mr-2 font-bold">!</span>
                    <p>{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            
            {/* Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Mode Selection */}
                <div className="bg-gray-800 p-4 md:p-5 rounded-xl shadow-lg">
                    <h3 className="text-xs md:text-sm font-semibold text-gray-400 uppercase mb-3 tracking-wider">Режим роботи</h3>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setMode("encrypt"); setResult(''); }}
                            className={`flex-1 py-2.5 rounded-lg font-medium text-sm md:text-base transition ${mode === 'encrypt' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            🔒 Шифрування
                        </button>
                        <button
                            type="button"
                            onClick={() => { 
                                setMode("decrypt"); 
                                if (contentType === 'text' && result) {
                                    setText(result);
                                    setResult('');
                                } else {
                                    setResult('');
                                }
                            }}
                            className={`flex-1 py-2.5 rounded-lg font-medium text-sm md:text-base transition ${mode === 'decrypt' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            🔓 Дешифрування
                        </button>
                    </div>
                </div>

                {/* Content Type Selection */}
                <div className="bg-gray-800 p-4 md:p-5 rounded-xl shadow-lg">
                    <h3 className="text-xs md:text-sm font-semibold text-gray-400 uppercase mb-3 tracking-wider">Тип даних</h3>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setContentType("text"); resetFields(); }}
                            className={`flex-1 py-2.5 rounded-lg font-medium text-sm md:text-base transition ${contentType === 'text' ? 'bg-gray-600 text-white ring-2 ring-blue-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            📝 Текст
                        </button>
                        <button
                            type="button"
                            onClick={() => { setContentType("file"); resetFields(); }}
                            className={`flex-1 py-2.5 rounded-lg font-medium text-sm md:text-base transition ${contentType === 'file' ? 'bg-gray-600 text-white ring-2 ring-blue-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            📁 Файл
                        </button>
                    </div>
                </div>
            </div>

            {/* Input Section */}
            <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                    {contentType === 'text' 
                    ? (mode === "encrypt" ? "Введіть текст для захисту" : "Введіть зашифрований текст")
                    : (mode === "encrypt" ? "Оберіть файл для шифрування" : "Оберіть файл .enc для дешифрування")
                    }
                </label>
                {ContentInput}
            </div>

            {/* Key Section */}
            <div>
                <label htmlFor="key" className="block mb-2 text-sm font-medium text-gray-300">
                    Секретний ключ
                </label>
                <div className="relative">
                    <input
                        type="password"
                        id="key"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        className="w-full p-4 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition text-white placeholder-gray-500"
                        placeholder="Пароль..."
                    />
                    <span className="absolute left-3 top-4 text-gray-500">🔑</span>
                </div>
            </div>

            {/* Progress Bar */}
            {progress > 0 && (
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner relative">
                    <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 transition-all duration-300 ease-out" 
                        style={{ width: `${progress}%` }}
                    ></div>
                    <p className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                        {progress}%
                    </p>
                </div>
            )}

            {/* Action Button */}
            <button
                type="submit"
                disabled={(contentType === 'file' && !fileData) || progress > 0}
                className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-widest shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0 
                ${progress > 0 
                    ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                    : mode === 'encrypt' 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
            >
                {progress > 0 ? "Обробка..." : mode === "encrypt" ? "Зашифрувати" : "Розшифрувати"}
            </button>

            {/* Result Section */}
            {ResultArea}

            </form>
        </div>
      </main>
    </div>
  );
}