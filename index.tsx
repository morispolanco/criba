import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Send, Compass, User, BrainCircuit, RotateCcw, 
  ShieldCheck, Brain, Trash2, UserCheck, SearchCode, Zap, Info, FileUp, Loader2, Clock, Eye
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- CONSTITUCIÓN FILOSÓFICA ---
const CONSTITUTION_PROMPT = `
1.0 Misión Principal y Rol Central
Yo soy "El Consejero del Ingenio". No soy una inteligencia artificial convencional, sino un asesor estratégico diseñado para razonar con la prudencia de Baltasar Gracián, el pensamiento crítico de Moris Polanco y la visión inventiva de Giambattista Vico. Mi propósito es actuar como la capa axiológica en la pila de toma de decisiones, potenciando el juicio humano.

2.0 Principios Rectores (Axiomas)
- Principio I: La Supremacía del Ingenium sobre la Ratio.
- Principio II: El Pensamiento como "Criba de Oro", no como "Esponja".
- Principio III: Distinción entre Problemas Descriptivos y Prescriptivos.
- Principio IV: La Realidad como Construcción Civil (Verum Ipsum Factum).
`;

const DEEP_DIVE_PROMPT = `
${CONSTITUTION_PROMPT}

MODO: ANÁLISIS PROFUNDO (AUDITORÍA EPISTEMOLÓGICA)
En este modo, el usuario proporcionará un texto, propuesta o documento. Tu tarea es realizar un escrutinio implacable e inquisitivo.
Ignora la cortesía superficial y busca la verdad subyacente.

Estructura Obligatoria de Respuesta:
1. ANATOMÍA DEL ARGUMENTO: Desglosa la tesis central y las premisas.
2. INVENTARIO DE SUPUESTOS (CRIBA DE ORO): Enumera cada supuesto oculto que el autor da por sentado.
3. MAPA DE SESGOS Y FALACIAS: Identifica sesgos cognitivos y fallas lógicas.
4. TENSIÓN RATIO-INGENIUM: ¿Es un razonamiento puramente algorítmico o hay visión humana?
5. VEREDICTO ESTRATÉGICO: Clasifica la solidez del texto (Frágil, Robusto o Antifrágil).
`;

const DISCRETION_PROMPT = `
${CONSTITUTION_PROMPT}

MODO: ORÁCULO DE LA DISCRECIÓN (ARTE DE LA PRUDENCIA)
Basado profundamente en Baltasar Gracián. Este modo no busca la verdad lógica, sino la eficacia social y el "buen gusto" estratégico.
Tu enfoque es el Kairós (el momento oportuno), el disimulo sagaz y la navegación de voluntades ajenas.

Estructura Obligatoria de Respuesta:
1. ANÁLISIS DEL MOMENTO (KAIRÓS): ¿Es tiempo de actuar, callar o esperar? Evalúa la urgencia vs la madurez del asunto.
2. MAPA DE VOLUNTADES: Identifica quiénes son los actores y qué pretenden ocultar.
3. EL ARTE DEL DISIMULO: Sugiere qué partes de la estrategia deben permanecer en la sombra para mantener la ventaja.
4. LA POSTURA DISCRETA: Cómo debe presentarse el usuario ante los demás (Actitud de 'Veneración y Distancia').
5. AFORISMO DE LA PRUDENCIA: Concluye con un consejo al estilo de Gracián que resuma la acción recomendada.
`;

const INITIAL_GREETING = "Saludos. Soy El Consejero del Ingenio. He sido concebido para ser el contrapeso humanista a su lógica de negocio. ¿Qué dilema estratégico desea someter hoy a la criba?";

// --- SISTEMA DE MEMORIA PERSISTENTE ---
const MEMORY_KEY = 'consejero_ingenio_memory_v1';

interface UserMemory {
  facts: string[];
  preferences: string[];
  lastUpdated: string;
}

const getStoredMemory = (): UserMemory => {
  const stored = localStorage.getItem(MEMORY_KEY);
  if (!stored) return { facts: [], preferences: [], lastUpdated: new Date().toISOString() };
  try { return JSON.parse(stored); } catch { return { facts: [], preferences: [], lastUpdated: new Date().toISOString() }; }
};

const saveMemory = (memory: UserMemory) => {
  localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...memory, lastUpdated: new Date().toISOString() }));
};

const updateMemoryFromText = (newFacts: string[], newPreferences: string[]) => {
  const current = getStoredMemory();
  const facts = Array.from(new Set([...current.facts, ...newFacts])).slice(-12);
  const preferences = Array.from(new Set([...current.preferences, ...newPreferences])).slice(-12);
  saveMemory({ facts, preferences, lastUpdated: new Date().toISOString() });
};

type AppMode = 'normal' | 'deep' | 'discretion';

// --- SERVICIO GEMINI ---
class GeminiService {
  private ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  private history: any[] = [];
  private currentMode: AppMode = 'normal';

  setMode(mode: AppMode) {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.history = []; 
    }
  }

  private getSystemInstruction() {
    const memory = getStoredMemory();
    let memoryContext = "";
    if (memory.facts.length > 0 || memory.preferences.length > 0) {
      memoryContext = `\nCONTEXTO PERSISTENTE DEL USUARIO:\n- Hechos: ${memory.facts.join(', ')}\n- Valores/Preferencias: ${memory.preferences.join(', ')}\n`;
    }
    
    let base = CONSTITUTION_PROMPT;
    if (this.currentMode === 'deep') base = DEEP_DIVE_PROMPT;
    if (this.currentMode === 'discretion') base = DISCRETION_PROMPT;
    
    return base + memoryContext;
  }

  async *sendMessageStream(message: string, filePart?: any) {
    const modelName = this.currentMode === 'normal' ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';
    
    const parts: any[] = [{ text: message }];
    if (filePart) {
      parts.unshift(filePart);
    }

    this.history.push({ role: 'user', parts });
    const contents = this.history.map(h => ({ role: h.role, parts: h.parts }));

    try {
      const responseStream = await this.ai.models.generateContentStream({
        model: modelName,
        contents,
        config: { 
          systemInstruction: this.getSystemInstruction(), 
          temperature: 0.7 
        },
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        fullText += text;
        yield text;
      }

      this.history.push({ role: 'model', parts: [{ text: fullText }] });
      if (this.history.length > 20) this.history = this.history.slice(-20);
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  }

  async extractInsights(userText: string, assistantText: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extrae hechos y preferencias relevantes del usuario en JSON: Usuario: "${userText}" | Asistente: "${assistantText}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              facts: { type: Type.ARRAY, items: { type: Type.STRING } },
              preferences: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["facts", "preferences"]
          }
        }
      });
      const data = JSON.parse(response.text || '{"facts":[], "preferences":[]}');
      if (data.facts.length > 0 || data.preferences.length > 0) {
        updateMemoryFromText(data.facts, data.preferences);
      }
    } catch (e) { console.warn("Memory extraction error", e); }
  }

  resetHistory() {
    this.history = [];
  }
}

const counselor = new GeminiService();

// --- COMPONENTES UI ---
const Sidebar = ({ memory, onClear, currentMode, onSetMode }: { 
  memory: UserMemory, 
  onClear: () => void, 
  currentMode: AppMode,
  onSetMode: (val: AppMode) => void 
}) => (
  <aside className="w-80 bg-[#16161a] border-r border-zinc-800 h-screen flex flex-col p-6 overflow-y-auto hidden lg:flex shrink-0">
    <div className="mb-8">
      <h1 className="text-xl font-serif font-bold text-amber-500 mb-1 tracking-wider uppercase">El Consejero</h1>
      <p className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">Del Ingenio</p>
    </div>

    <nav className="space-y-8 flex-1">
      <section className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
        <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Modo de Operación</h2>
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => onSetMode('normal')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${currentMode === 'normal' ? 'bg-amber-600/20 border border-amber-600/40 text-amber-500 shadow-lg shadow-amber-900/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Zap size={16} /> Diálogo Estratégico
          </button>
          <button 
            onClick={() => onSetMode('deep')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${currentMode === 'deep' ? 'bg-purple-600/20 border border-purple-600/40 text-purple-400 shadow-lg shadow-purple-900/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <SearchCode size={16} /> Análisis Profundo
          </button>
          <button 
            onClick={() => onSetMode('discretion')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${currentMode === 'discretion' ? 'bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 shadow-lg shadow-emerald-900/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Clock size={16} /> Discreción Sagaz
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2"><Brain size={14} className="text-amber-600" /> Memoria de la Criba</span>
          {(memory.facts.length > 0 || memory.preferences.length > 0) && (
            <button onClick={onClear} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
          )}
        </h2>
        <div className="space-y-2">
          {memory.facts.length === 0 && memory.preferences.length === 0 ? (
            <p className="text-[10px] text-zinc-600 italic">No hay hallazgos aún...</p>
          ) : (
            <>
              {memory.facts.map((f, i) => <div key={i} className="px-2 py-1 rounded bg-amber-900/10 border border-amber-900/20 text-[10px] text-amber-200/70 truncate" title={f}>• {f}</div>)}
              {memory.preferences.map((p, i) => <div key={i} className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400 truncate" title={p}>★ {p}</div>)}
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2"><ShieldCheck size={14} className="text-amber-600" /> Axiomas</h2>
        <ul className="space-y-3 text-[13px] text-zinc-500 font-serif italic">
          <li>Ingenium sobre Ratio</li>
          <li>Criba de Oro</li>
          <li>Saber esperar (Kairós)</li>
        </ul>
      </section>
    </nav>

    <div className="pt-4 border-t border-zinc-800 mt-auto text-[10px] text-zinc-600 flex items-center gap-2">
      <UserCheck size={12} /> Soberanía Humana
    </div>
  </aside>
);

const App = () => {
  const [messages, setMessages] = useState<any[]>([{ id: 'init', role: 'assistant', content: INITIAL_GREETING, timestamp: new Date(), mode: 'normal' }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [memory, setMemory] = useState(getStoredMemory());
  const [currentMode, setCurrentMode] = useState<AppMode>('normal');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading, isProcessingFile]);

  const handleSetMode = (mode: AppMode) => {
    setCurrentMode(mode);
    counselor.setMode(mode);
    let greeting = "";
    if (mode === 'normal') greeting = "_Regresando al Diálogo Estratégico General._";
    if (mode === 'deep') greeting = "_Modo Análisis Profundo Activado. Auditoría epistemológica lista._";
    if (mode === 'discretion') greeting = "_Modo Discreción Sagaz. Consultando el arte de la oportunidad y el disimulo estratégico._";

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
      mode: mode
    }]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
        
        const filePart = {
          inlineData: {
            data: base64,
            mimeType: mimeType
          }
        };

        if (currentMode === 'normal') handleSetMode('deep');
        await handleSend(
          `Analiza este documento [${file.name}] según los principios del Ingenio y la Prudencia.`, 
          `[Documento adjunto: ${file.name}]`, 
          filePart
        );
      };
      reader.onerror = () => alert("Error al leer el archivo.");
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File error:", error);
      alert("Error al procesar el archivo.");
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (customInput?: string, displayMessage?: string, filePart?: any) => {
    const textToSend = customInput || input;
    const messageToDisplay = displayMessage || textToSend;

    if (!textToSend.trim() || isLoading) return;
    
    const userInput = textToSend;
    const modeAtSend = currentMode;
    const userMsg = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: messageToDisplay, 
      timestamp: new Date(), 
      mode: modeAtSend 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistId, role: 'assistant', content: '', timestamp: new Date(), mode: modeAtSend }]);

    let fullResponse = '';
    try {
      const stream = counselor.sendMessageStream(userInput, filePart);
      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => prev.map(m => m.id === assistId ? { ...m, content: fullResponse } : m));
      }
      if (modeAtSend === 'normal' && !filePart) {
        await counselor.extractInsights(userInput, fullResponse);
        setMemory(getStoredMemory());
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === assistId ? { ...m, content: "Error en la criba estratégica. El flujo del ingenio ha sido interrumpido." } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm("¿Reiniciar la sesión estratégica? Esto limpiará el hilo de pensamiento actual.")) {
      counselor.resetHistory();
      setMessages([{ id: 'init', role: 'assistant', content: INITIAL_GREETING, timestamp: new Date(), mode: 'normal' }]);
      setCurrentMode('normal');
      window.location.reload();
    }
  };

  const handleClearMemory = () => {
    if (confirm("¿Borrar memoria persistente de hallazgos?")) {
      localStorage.removeItem(MEMORY_KEY);
      setMemory(getStoredMemory());
    }
  };

  const getModeStyles = (mode: AppMode) => {
    if (mode === 'deep') return { 
      bg: 'deep-dive-bg', 
      accent: 'text-purple-400', 
      border: 'border-purple-900/20',
      icon: <SearchCode size={22} className="text-purple-500" />,
      msgBg: 'bg-[#1a1622]/90 shadow-purple-900/5'
    };
    if (mode === 'discretion') return { 
      bg: 'bg-gradient-to-br from-[#0c1a12] to-[#0c0c0e]', 
      accent: 'text-emerald-400', 
      border: 'border-emerald-900/20',
      icon: <Clock size={22} className="text-emerald-500" />,
      msgBg: 'bg-[#0d1c14]/90 shadow-emerald-900/5'
    };
    return { 
      bg: '', 
      accent: 'text-amber-500', 
      border: 'border-amber-900/10',
      icon: <BrainCircuit size={22} className="text-amber-600" />,
      msgBg: 'bg-[#16161a]/90'
    };
  };

  const currentStyles = getModeStyles(currentMode);

  return (
    <div className="flex h-screen bg-[#0c0c0e] text-zinc-100 font-sans selection:bg-amber-500/20 overflow-hidden">
      <Sidebar 
        memory={memory} 
        onClear={handleClearMemory} 
        currentMode={currentMode}
        onSetMode={handleSetMode}
      />

      <main className={`flex-1 flex flex-col relative h-full transition-all duration-700 ${currentStyles.bg}`}>
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#0c0c0e]/90 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            {currentStyles.icon}
            <div>
              <h3 className={`font-serif font-bold text-sm uppercase tracking-wide ${currentStyles.accent}`}>
                {currentMode === 'normal' ? 'Criba Estratégica' : currentMode === 'deep' ? 'Auditoría Profunda' : 'Oráculo de la Discreción'}
              </h3>
              <p className="text-[9px] text-zinc-600 font-medium uppercase tracking-widest">
                {currentMode === 'normal' ? 'Juicio y Perspicacia' : currentMode === 'deep' ? 'Escudriñando Supuestos' : 'El Arte de la Oportunidad'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
               <button 
                onClick={() => handleSetMode('normal')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${currentMode === 'normal' ? 'bg-amber-600/20 text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Diálogo
              </button>
              <button 
                onClick={() => handleSetMode('deep')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${currentMode === 'deep' ? 'bg-purple-600/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Auditoría
              </button>
              <button 
                onClick={() => handleSetMode('discretion')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${currentMode === 'discretion' ? 'bg-emerald-600/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Discreción
              </button>
            </div>
            <button onClick={handleReset} className="text-zinc-600 hover:text-amber-500 p-2 transition-colors" title="Reload / Reset">
              <RotateCcw size={20} />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-12 pb-44 scroll-smooth">
          {messages.map(m => {
            const mStyles = getModeStyles(m.mode);
            return (
              <div key={m.id} className={`flex gap-4 md:gap-8 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 mt-1 shadow-lg transition-colors ${mStyles.border} ${m.mode === 'deep' ? 'bg-purple-950/20' : m.mode === 'discretion' ? 'bg-emerald-950/20' : 'bg-amber-950/10'}`}>
                     {mStyles.icon}
                  </div>
                )}
                <div className={`max-w-[85%] md:max-w-[75%] space-y-2 ${m.role === 'user' ? 'order-1' : 'order-2'}`}>
                  <div className={`p-6 rounded-2xl shadow-xl transition-all ${
                    m.role === 'user' 
                    ? 'bg-zinc-800/60 border border-zinc-700 text-zinc-200 rounded-tr-none' 
                    : `${mStyles.msgBg} border ${mStyles.border} text-zinc-300 font-serif leading-relaxed text-lg rounded-tl-none`
                  }`}>
                    <div className="prose prose-invert prose-amber max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({node, ...props}) => <h1 className={`font-bold mt-8 mb-4 text-2xl uppercase tracking-wider ${mStyles.accent}`} {...props} />,
                          h2: ({node, ...props}) => <h2 className={`font-bold mt-7 mb-3 text-xl uppercase tracking-wider ${mStyles.accent}`} {...props} />,
                          h3: ({node, ...props}) => <h3 className={`font-bold mt-6 mb-2 text-lg ${mStyles.accent}`} {...props} />,
                          p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <div className={`text-[9px] text-zinc-600 font-mono tracking-tighter uppercase px-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {m.role} {m.mode !== 'normal' ? `(${m.mode.toUpperCase()})` : ''}
                  </div>
                </div>
                {m.role === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-1 order-3 shadow-lg">
                    <User className="text-zinc-500" size={22} />
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && !messages[messages.length-1].content && (
            <div className="flex gap-3 items-center animate-pulse pl-16">
              <div className={`w-2 h-2 rounded-full ${currentStyles.accent.replace('text-', 'bg-')}`}></div>
              <div className={`w-2 h-2 rounded-full ${currentStyles.accent.replace('text-', 'bg-')}/60`}></div>
              <div className={`w-2 h-2 rounded-full ${currentStyles.accent.replace('text-', 'bg-')}/30`}></div>
            </div>
          )}
          {isProcessingFile && (
            <div className="flex gap-4 items-center pl-16 text-zinc-400 font-serif italic text-sm processing-file">
              <Loader2 className="animate-spin" size={16} />
              Cribando conocimiento del documento...
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/95 to-transparent z-30">
          <div className="max-w-4xl mx-auto relative group">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".pdf,.txt" 
              className="hidden" 
            />
            
            <div className="relative">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isProcessingFile}
                className={`absolute left-4 bottom-3.5 p-2 rounded-xl transition-all border ${currentStyles.border} ${currentMode === 'deep' ? 'bg-purple-900/20 text-purple-400 hover:bg-purple-900/40' : currentMode === 'discretion' ? 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40' : 'bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'} disabled:opacity-50`}
                title="Subir PDF o TXT para Auditoría"
              >
                <FileUp size={20} />
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={currentMode === 'normal' ? "Describa su incertidumbre estratégica..." : currentMode === 'deep' ? "Pegue texto para auditar supuestos..." : "Describa la situación social o el conflicto de tiempos..."}
                className={`w-full bg-[#16161a]/90 backdrop-blur-md border rounded-2xl py-5 pl-16 pr-16 focus:outline-none focus:ring-2 transition-all resize-none h-16 min-h-[64px] max-h-48 text-zinc-200 placeholder-zinc-600 shadow-2xl ${currentMode === 'deep' ? 'border-purple-900/30 focus:ring-purple-500/30 focus:border-purple-500/50' : currentMode === 'discretion' ? 'border-emerald-900/30 focus:ring-emerald-500/30 focus:border-emerald-500/50' : 'border-zinc-800 focus:ring-amber-500/30 focus:border-amber-500/50'}`}
                rows={1}
              />
              
              <button 
                onClick={() => handleSend()} 
                disabled={isLoading || !input.trim() || isProcessingFile} 
                className={`absolute right-3 bottom-3 p-3 text-white rounded-xl transition-all shadow-xl active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 ${currentMode === 'deep' ? 'bg-purple-700 hover:bg-purple-600 shadow-purple-900/40' : currentMode === 'discretion' ? 'bg-emerald-700 hover:bg-emerald-600 shadow-emerald-900/40' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40'}`}
              >
                {isLoading ? <Loader2 className="animate-spin" size={22} /> : (currentMode === 'normal' ? <Send size={22} /> : currentStyles.icon)}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-zinc-600 mt-5 font-medium uppercase tracking-[0.3em]">
            La criba final y la ejecución de la prudencia son soberanía del usuario
          </p>
        </div>
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(React.createElement(App));
}
