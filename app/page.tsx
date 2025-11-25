// app/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import RuleSidebar from "../components/RuleSidebar"; 
import { useCryptoWorker } from "../hooks/useCryptoWorker"; 
import { type AutomataRule } from "../lib/rule30";

type ContentType = 'text' | 'file';
type Mode = 'encrypt' | 'decrypt';

declare global { interface Window { worker?: Worker; } }

export default function Home() {
  const [text, setText] = useState("");
  const [key, setKey] = useState("");
  const [mode, setMode] = useState<Mode>("encrypt");
  const [selectedRule, setSelectedRule] = useState<AutomataRule>("R30"); 
  const [contentType, setContentType] = useState<ContentType>('text');
  
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { 
    processData, progress, result, setResult, error, resetWorkerState, executionTime 
  } = useCryptoWorker();

  const resetFields = () => {
      setText("");
      setFile(null);
      setFileData(null);
      resetWorkerState();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    resetWorkerState();
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result instanceof ArrayBuffer) {
          setFileData(new Uint8Array(ev.target.result));
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setFileData(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (progress > 0) return; 
    const dataToSend = contentType === 'text' ? text : fileData;
    
    if (!key || !dataToSend) {
      alert("Please enter data and a secret key."); 
      return;
    }
    processData(dataToSend, key, selectedRule, mode, contentType, file?.name);
  };
  
  const ContentInput = useMemo(() => {
    if (contentType === 'text') {
      return (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition font-mono text-base"
          placeholder={mode === "encrypt" ? "Enter secret text..." : "Paste encoded text..."}
        />
      );
    } else { 
      return (
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-600 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition duration-300 relative">
          <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} />
          <div className="text-center pointer-events-none">
              <p className="text-lg text-blue-400 font-medium">{file ? file.name : "Click to select file"}</p>
              <p className="mt-2 text-sm text-gray-400">{file ? `${(file.size / 1024).toFixed(2)} KB` : "Any format supported"}</p>
              {fileData && <p className="text-xs text-green-400 mt-2 font-bold">✓ Loaded in memory</p>}
          </div>
        </div>
      );
    }
  }, [contentType, mode, text, file, fileData]);
  
  const ResultArea = useMemo(() => {
      if (!result) return null;
      if (contentType === 'text') {
          return (
            <div className="mt-8 animate-fade-in">
                <label className="block mb-2 text-sm font-medium text-gray-300">Output:</label>
                <textarea readOnly value={result} rows={6} className="w-full p-4 bg-gray-800 border border-gray-600 rounded-lg resize-none font-mono text-green-400 text-sm mb-2" />
                <button onClick={() => navigator.clipboard.writeText(result)} className="text-xs text-blue-400 hover:text-blue-300 underline">Copy to clipboard</button>
            </div>
          );
      } else {
          return (
              <div className="mt-6 p-4 bg-green-900/30 border border-green-600 rounded-lg animate-fade-in">
                  <p className="text-green-400 font-medium flex items-center"><span className="mr-2">✓</span> {result}</p>
              </div>
          );
      }
  }, [contentType, result]);

  return (
    <div className="flex min-h-screen bg-gray-900 text-white font-sans relative overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="md:hidden absolute top-4 right-4">
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white p-2">✕</button>
        </div>
        <RuleSidebar currentRule={selectedRule} onRuleChange={(rule) => { setSelectedRule(rule); resetFields(); setIsSidebarOpen(false); }} />
      </aside>

      <main className="flex-grow p-4 md:p-10 overflow-y-auto h-screen">
        <div className="max-w-4xl mx-auto pb-20">
            <header className="mb-8 md:mb-10 border-b border-gray-700 pb-6 flex flex-col md:block">
                <div className="flex items-center justify-between mb-4 md:mb-2">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 mr-4 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg">☰</button>
                    <h1 className="text-2xl md:text-4xl font-bold text-blue-400 flex-grow">CA Crypto <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded ml-2 align-middle">Thesis</span></h1>
                </div>
                <p className="text-sm md:text-base text-gray-400">Selected Algorithm: <span className="text-blue-300 font-mono font-bold">{selectedRule}</span></p>
            </header>

            {error && <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-lg flex items-start"><span className="mr-2 font-bold">!</span> {error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-gray-800 p-4 md:p-5 rounded-xl shadow-lg">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-widest">Operation</h3>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => { setMode("encrypt"); resetWorkerState(); }} className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${mode === 'encrypt' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>🔒 Encrypt</button>
                        <button type="button" onClick={() => { setMode("decrypt"); if (contentType === 'text' && result) { setText(result); resetWorkerState(); } else { resetWorkerState(); } }} className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${mode === 'decrypt' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>🔓 Decrypt</button>
                    </div>
                </div>
                <div className="bg-gray-800 p-4 md:p-5 rounded-xl shadow-lg">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-widest">Data Type</h3>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => { setContentType("text"); resetFields(); }} className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${contentType === 'text' ? 'bg-gray-600 text-white ring-2 ring-blue-500' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>📝 Text</button>
                        <button type="button" onClick={() => { setContentType("file"); resetFields(); }} className={`flex-1 py-3 rounded-lg font-bold text-sm transition ${contentType === 'file' ? 'bg-gray-600 text-white ring-2 ring-blue-500' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>📁 File</button>
                    </div>
                </div>
            </div>

            <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">{contentType === 'text' ? (mode === "encrypt" ? "Input Text" : "Ciphertext") : "Input File"}</label>
                {ContentInput}
            </div>

            <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">Secret Key</label>
                <div className="relative">
                    <input type="password" value={key} onChange={(e) => setKey(e.target.value)} className="w-full p-4 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition text-base text-white placeholder-gray-600" placeholder="Enter strong password..." />
                    <span className="absolute left-3 top-4 text-gray-500">🔑</span>
                </div>
            </div>

            {progress > 0 && (
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner relative">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                    <p className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm tracking-widest">PROCESSING {progress}%</p>
                </div>
            )}

            {executionTime && (
                <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg flex justify-between items-center animate-fade-in">
                    <span className="text-xs text-blue-300 uppercase font-bold tracking-widest">Time Taken</span>
                    <span className="font-mono font-bold text-white">{executionTime} ms</span>
                </div>
            )}

            <button type="submit" disabled={(contentType === 'file' && !fileData) || progress > 0} className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-widest shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0 ${progress > 0 ? 'bg-gray-600 cursor-not-allowed text-gray-400' : mode === 'encrypt' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>
                {progress > 0 ? "Processing..." : mode === "encrypt" ? "Encrypt Data" : "Decrypt Data"}
            </button>

            {ResultArea}
            </form>
        </div>
      </main>
    </div>
  );
}