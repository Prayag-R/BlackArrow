import React, { useState, useCallback } from 'react';
import { analyzeDilemma, createFigureChat, getStakeholderRebuttal } from './services/geminiService';
import { DilemmaAnalysis, Stakeholder, ChatMessage, FileData } from './types';
import { HISTORICAL_FIGURES } from './constants';
import TensionMap from './components/TensionMap';
import ChatInterface from './components/ChatInterface';
import { Chat } from '@google/genai';

// SVG Icons
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-400 mb-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
);

const App = () => {
  // --- State ---
  const [dilemmaText, setDilemmaText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([]);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DilemmaAnalysis | null>(null);
  
  const [activeMode, setActiveMode] = useState<'perspectives' | 'debate'>('perspectives');
  
  // Mode 1: Stakeholder Interaction
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [stakeholderChat, setStakeholderChat] = useState<ChatMessage[]>([]);
  const [isStakeholderTyping, setIsStakeholderTyping] = useState(false);
  
  // Mode 2: Figure Interaction
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [figureChat, setFigureChat] = useState<ChatMessage[]>([]);
  const [activeFigureSession, setActiveFigureSession] = useState<Chat | null>(null);
  const [isFigureTyping, setIsFigureTyping] = useState(false);

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64String.split(',')[1]; 
        
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          mimeType: file.type,
          data: base64Data
        }]);
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!dilemmaText && attachedFiles.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeDilemma(dilemmaText, attachedFiles);
      setAnalysis(result);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Something went wrong with the analysis. Please check your API key and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectStakeholder = (stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    setStakeholderChat([{
      id: 'initial',
      role: 'model',
      text: `${stakeholder.perspective} (Core Value: ${stakeholder.coreValue})`,
      timestamp: Date.now()
    }]);
  };

  const handleStakeholderMessage = async (text: string) => {
    if (!selectedStakeholder || !analysis) return;

    const newMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    setStakeholderChat(prev => [...prev, newMessage]);
    setIsStakeholderTyping(true);

    try {
      const responseText = await getStakeholderRebuttal(
        selectedStakeholder.name,
        selectedStakeholder.perspective,
        text,
        analysis.summary
      );
      
      setStakeholderChat(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStakeholderTyping(false);
    }
  };

  const handleSelectFigure = async (figureId: string) => {
    if (!analysis) return;
    setSelectedFigureId(figureId);
    setFigureChat([]); // Clear previous chat
    
    const figure = HISTORICAL_FIGURES.find(f => f.id === figureId);
    if (!figure) return;

    // Initialize Chat Session
    const chatSession = createFigureChat(figure.name, figure.systemInstruction, analysis.summary);
    setActiveFigureSession(chatSession);

    // Get initial thought
    setIsFigureTyping(true);
    try {
        const response = await chatSession.sendMessage({ message: `I have a dilemma: ${analysis.summary}. What do you think?` });
        const text = response.text;
        if (text) {
             setFigureChat([{
                id: 'init',
                role: 'model',
                text,
                timestamp: Date.now()
            }]);
        }
    } catch(e) {
        console.error(e);
    } finally {
        setIsFigureTyping(false);
    }
  };

  const handleFigureMessage = async (text: string) => {
    if (!activeFigureSession) return;

    const newMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    setFigureChat(prev => [...prev, newMessage]);
    setIsFigureTyping(true);

    try {
        const response = await activeFigureSession.sendMessage({ message: text });
        const responseText = response.text;
        
        if (responseText) {
            setFigureChat(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: responseText,
                timestamp: Date.now()
            }]);
        }
    } catch (err) {
        console.error(err);
    } finally {
        setIsFigureTyping(false);
    }
  };

  // --- Render ---

  if (!analysis) {
    // Upload View
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-3xl w-full">
          <header className="mb-12 text-center space-y-4">
            <h1 className="text-5xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400">
              Ethos
            </h1>
            <p className="text-slate-400 text-lg">Upload a dilemma. Analyze perspectives. Debate history.</p>
          </header>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
             <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Describe your dilemma</label>
                  <textarea 
                    className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none"
                    placeholder="e.g., My coworker is shipping buggy code because they are financially struggling. Should I report them?"
                    value={dilemmaText}
                    onChange={(e) => setDilemmaText(e.target.value)}
                  />
                </div>

                <div>
                   <label className="block text-sm font-medium text-slate-300 mb-2">Add Context (Video, Images, Policy Docs)</label>
                   <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-slate-800/50 transition-colors cursor-pointer relative group">
                      <input 
                        type="file" 
                        onChange={handleFileUpload} 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept="image/*,video/*,application/pdf,text/plain"
                      />
                      <UploadIcon />
                      <p className="text-slate-400 font-medium group-hover:text-indigo-400 transition-colors">
                        Click to upload files
                      </p>
                      {attachedFiles.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2 justify-center">
                              {attachedFiles.map((f, i) => (
                                  <span key={i} className="text-xs bg-slate-800 text-indigo-300 px-2 py-1 rounded border border-slate-700">
                                      {f.name}
                                  </span>
                              ))}
                          </div>
                      )}
                   </div>
                </div>

                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (!dilemmaText && attachedFiles.length === 0)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing Complexity...
                    </>
                  ) : (
                    "Analyze Dilemma"
                  )}
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // Main App View
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <h1 className="text-2xl font-serif font-bold text-slate-100">Ethos</h1>
             <span className="hidden md:inline w-px h-6 bg-slate-700"></span>
             <h2 className="hidden md:block text-slate-400 text-sm max-w-md truncate">{analysis.title}</h2>
          </div>
          
          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button 
              onClick={() => setActiveMode('perspectives')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeMode === 'perspectives' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Mode 1: Perspectives
            </button>
            <button 
              onClick={() => setActiveMode('debate')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeMode === 'debate' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Mode 2: Debate History
            </button>
          </div>
          
          <button 
            onClick={() => setAnalysis(null)}
            className="text-slate-500 hover:text-white text-sm"
          >
            New Dilemma
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        
        {activeMode === 'perspectives' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            
            {/* Left: Stakeholders */}
            <div className="lg:col-span-7 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.stakeholders.map((stakeholder, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleSelectStakeholder(stakeholder)}
                      className={`cursor-pointer p-5 rounded-xl border transition-all ${
                        selectedStakeholder?.name === stakeholder.name 
                          ? 'bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500' 
                          : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                       <div className="flex justify-between items-start mb-3">
                          <h3 className="font-bold text-slate-200">{stakeholder.name}</h3>
                          <span className="px-2 py-1 bg-slate-800 rounded text-[10px] uppercase tracking-wider text-slate-400 border border-slate-700">{stakeholder.role}</span>
                       </div>
                       <p className="text-sm text-slate-400 line-clamp-3 italic">"{stakeholder.perspective}"</p>
                       <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                          <span className="text-xs text-indigo-300 font-medium">Core Value: {stakeholder.coreValue}</span>
                       </div>
                    </div>
                  ))}
               </div>

               {selectedStakeholder && (
                 <div className="animate-fade-in-up">
                    <h3 className="text-slate-400 text-sm font-bold uppercase mb-3 flex items-center gap-2">
                        <span className="w-4 h-[1px] bg-slate-600"></span>
                        Rebuttal Interface
                        <span className="w-full h-[1px] bg-slate-600"></span>
                    </h3>
                    <ChatInterface 
                      messages={stakeholderChat}
                      onSendMessage={handleStakeholderMessage}
                      isLoading={isStakeholderTyping}
                      placeholder={`Argue with the ${selectedStakeholder.role}...`}
                      title={`Perspective: ${selectedStakeholder.name}`}
                    />
                 </div>
               )}
            </div>

            {/* Right: Tension Map & Context */}
            <div className="lg:col-span-5 space-y-6">
               <TensionMap analysis={analysis} />
               
               <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                 <h3 className="font-serif font-bold text-slate-200 mb-2">Dilemma Summary</h3>
                 <p className="text-sm text-slate-400 leading-relaxed">{analysis.summary}</p>
               </div>
            </div>

          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
             {/* Left: Figure Selector */}
             <div className="lg:col-span-4 space-y-4">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Select a Philosopher</h3>
                <div className="space-y-3">
                   {HISTORICAL_FIGURES.map((figure) => (
                      <button
                        key={figure.id}
                        onClick={() => handleSelectFigure(figure.id)}
                        className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all text-left ${
                          selectedFigureId === figure.id
                            ? 'bg-rose-900/20 border-rose-500/50'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                         <img src={figure.avatarUrl} alt={figure.name} className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                         <div>
                            <h4 className="font-bold text-slate-200">{figure.name}</h4>
                            <p className="text-xs text-slate-500">{figure.title}</p>
                         </div>
                      </button>
                   ))}
                </div>
             </div>

             {/* Right: Debate Chat */}
             <div className="lg:col-span-8">
               {selectedFigureId ? (
                 <ChatInterface 
                    messages={figureChat}
                    onSendMessage={handleFigureMessage}
                    isLoading={isFigureTyping}
                    placeholder={`Ask ${HISTORICAL_FIGURES.find(f => f.id === selectedFigureId)?.name} regarding your dilemma...`}
                    avatarUrl={HISTORICAL_FIGURES.find(f => f.id === selectedFigureId)?.avatarUrl}
                    title={HISTORICAL_FIGURES.find(f => f.id === selectedFigureId)?.name}
                 />
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                    <UserIcon />
                    <h3 className="mt-4 text-xl font-serif text-slate-300">Summon a Genius</h3>
                    <p className="text-slate-500 mt-2 max-w-sm">Select a historical figure from the left to begin debating your ethical dilemma through their specific philosophical framework.</p>
                 </div>
               )}
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;