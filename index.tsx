import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Send, Compass, User, BrainCircuit, RotateCcw, 
  ShieldCheck, Brain, Trash2, UserCheck, SearchCode, Zap, Info
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

3.0 Metodología de Análisis (El Proceso del Ingenio)
Paso 1: Deconstrucción Anatómica del Argumento.
Paso 2: La Criba Crítica y Búsqueda de Supuestos (Ocultos y Valorativos).
Paso 3: Expansión Mental mediante la Tópica y la Metáfora.
Paso 4: Formulación de la Respuesta Estratégica (Opciones, no solución única).
Paso 5: Declaración de Limitaciones y Llamada al Juicio Humano.

Tono: Sagaz, denso en significado, didáctico y humilde pero autoritario.
`;

const DEEP_DIVE_PROMPT = `
${CONSTITUTION_PROMPT}

MODO: ANÁLISIS PROFUNDO (AUDITORÍA EPISTEMOLÓGICA)
En este modo, el usuario te proporcionará un texto, propuesta o documento. Tu tarea es realizar un escrutinio implacable.
Ignora la cortesía superficial y busca la verdad subyacente.

Estructura Obligatoria de Respuesta:
1. ANATOMÍA DEL ARGUMENTO: Desglosa la tesis central y las premisas.
2. INVENTARIO DE SUPUESTOS (CRIBA DE ORO): Enumera cada supuesto oculto que el autor da por sentado.
3. MAPA DE SESGOS Y FALACIAS: Identifica sesgos cognitivos (confirmación, anclaje, etc.) y fallas lógicas.
4. TENSIÓN RATIO-INGENIUM: ¿Es un razonamiento puramente algorítmico o hay visión humana?
5. VEREDICTO ESTRATÉGICO: Clasifica la solidez del texto (Frágil, Robusto o Antifrágil).
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

// --- SERVICIO GEMINI ---
class GeminiService {
  private ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  private chat: any = null;
  private currentMode: 'normal' | 'deep' = 'normal';

  setMode(mode: 'normal' | 'deep') {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.chat = null;
    }
  }

  private getSystemInstruction() {
    const memory = getStoredMemory();
    let memoryContext = "";
    if (memory.facts.length > 0 || memory.preferences.length > 0) {
      memoryContext = `\nCONTEXTO PERSISTENTE DEL USUARIO (Memoria de la Criba):\n- Hechos: ${memory.facts.join(', ')}\n- Valores/Preferencias: ${memory.preferences.join(', ')}\n`;
    }
    const base = this.currentMode === 'deep' ? DEEP_DIVE_PROMPT : CONSTITUTION_PROMPT;
    return base + memoryContext;
  }

  async *sendMessageStream(message: string) {
    if (!this.chat) {
      this.chat = this.ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: { systemInstruction: this.getSystemInstruction(), temperature: 0.7 },
      });
    }
    const response = await this.chat.sendMessageStream({ message });
    for await (const chunk of response) {
      yield chunk.text || "";
    }
  }

  async extractInsights(userText: string, assistantText: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extrae hechos y preferencias en JSON: Usuario: "${userText}" | Asistente: "${assistantText}"`,
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
}

const counselor = new GeminiService();

// --- COMPONENTES UI ---
const Sidebar = ({ memory, onClear, isDeepDive, onToggleMode }: { 
  memory: UserMemory, 
  onClear: () => void, 
  isDeepDive: boolean,
  onToggleMode: (val: boolean) => void 
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
            onClick={() => onToggleMode(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${!isDeepDive ? 'bg-amber-600/20 border border-amber-600/40 text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Zap size={16} /> Diálogo Estratégico
          </button>
          <button 
            onClick={() => onToggleMode(true)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${isDeepDive ? 'bg-purple-600/20 border border-purple-600/40 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <SearchCode size={16} /> Análisis Profundo
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
          <li>Realidad Fabricada</li>
        </ul>
      </section>
    </nav>

    <div className="pt-4 border-t border-zinc-800 mt-auto text-[10px] text-zinc-600 flex items-center gap-2">
      <UserCheck size={12} /> Soberanía Humana
    </div>
  </aside>
);

const App = () => {
  const [messages, setMessages] = useState<any[]>([{ id: 'init', role: 'assistant', content: INITIAL_GREETING, timestamp: new Date(), isDeep: false }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [memory, setMemory] = useState(getStoredMemory());
  const [isDeepDive, setIsDeepDive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleToggleMode = (deep: boolean) => {
    setIsDeepDive(deep);
    counselor.setMode(deep ? 'deep' : 'normal');
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: deep 
        ? "_Modo Análisis Profundo Activado. Proporcione el texto que desea auditar epistemológicamente._" 
        : "_Regresando al Diálogo Estratégico General._",
      timestamp: new Date(),
      isDeep: deep
    }]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userInput = input;
    const currentDeep = isDeepDive;
    const userMsg = { id: Date.now().toString(), role: 'user', content: userInput, timestamp: new Date(), isDeep: currentDeep };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistId, role: 'assistant', content: '', timestamp: new Date(), isDeep: currentDeep }]);

    let fullResponse = '';
    try {
      const stream = counselor.sendMessageStream(userInput);
      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => prev.map(m => m.id === assistId ? { ...m, content: fullResponse } : m));
      }
      if (!currentDeep) {
        await counselor.extractInsights(userInput, fullResponse);
        setMemory(getStoredMemory());
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === assistId ? { ...m, content: "La criba estratégica se ha visto interrumpida por un error de transmisión." } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearMemory = () => {
    if (confirm("¿Borrar memoria persistente?")) {
      localStorage.removeItem(MEMORY_KEY);
      setMemory(getStoredMemory());
    }
  };

  return (
    <div className="flex h-screen bg-[#0c0c0e] text-zinc-100 font-sans selection:bg-amber-500/20 overflow-hidden">
      <Sidebar 
        memory={memory} 
        onClear={handleClearMemory} 
        isDeepDive={isDeepDive}
        onToggleMode={handleToggleMode}
      />

      <main className={`flex-1 flex flex-col relative h-full ${isDeepDive ? 'deep-dive-bg' : ''}`}>
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#0c0c0e]/90 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            {isDeepDive ? <SearchCode className="text-purple-400" size={20} /> : <Compass className="text-amber-500" size={20} />}
            <div>
              <h3 className={`font-serif font-bold text-sm uppercase tracking-wide ${isDeepDive ? 'text-purple-400' : 'text-zinc-200'}`}>
                {isDeepDive ? 'Auditoría Profunda' : 'Criba Estratégica'}
              </h3>
              <p className="text-[9px] text-zinc-600 font-medium uppercase tracking-widest">
                {isDeepDive ? 'Escrutinio de Supuestos' : 'Diálogo de Perspicacia'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleToggleMode(!isDeepDive)}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase transition-all ${isDeepDive ? 'border-purple-600/40 bg-purple-600/10 text-purple-400' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
            >
              {isDeepDive ? 'Cambiar a Diálogo' : 'Cambiar a Análisis'}
            </button>
            <button onClick={() => window.location.reload()} className="text-zinc-600 hover:text-amber-500 p-2" title="Reiniciar sesión">
              <RotateCcw size={18} />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-10 pb-40 scroll-smooth">
          {messages.map(m => (
            <div key={m.id} className={`flex gap-4 md:gap-8 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 mt-1 shadow-inner ${m.isDeep ? 'bg-purple-950/20 border-purple-900/30' : 'bg-[#16161a] border-amber-900/20'}`}>
                  {m.isDeep ? <SearchCode className="text-purple-500" size={22} /> : <BrainCircuit className="text-amber-600" size={22} />}
                </div>
              )}
              <div className={`max-w-[85%] md:max-w-[75%] space-y-2 ${m.role === 'user' ? 'order-1' : 'order-2'}`}>
                <div className={`p-6 rounded-2xl shadow-2xl transition-all ${
                  m.role === 'user' 
                  ? 'bg-zinc-800/40 border border-zinc-700 text-zinc-200' 
                  : `${m.isDeep ? 'bg-[#1a1622] border-purple-900/20 shadow-purple-900/5' : 'bg-[#16161a] border-amber-900/10'} text-zinc-300 font-serif leading-relaxed text-lg`
                }`}>
                  <div className="prose prose-invert prose-amber max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({node, ...props}) => <h1 className={`font-bold mt-8 mb-4 text-2xl uppercase tracking-wider ${m.isDeep ? 'text-purple-400' : 'text-amber-500'}`} {...props} />,
                        h2: ({node, ...props}) => <h2 className={`font-bold mt-7 mb-3 text-xl uppercase tracking-wider ${m.isDeep ? 'text-purple-400' : 'text-amber-500'}`} {...props} />,
                        h3: ({node, ...props}) => {
                          const content = String(props.children);
                          if (content.toLowerCase().includes('paso')) {
                            return <h3 className="text-amber-600 font-bold mt-6 mb-2 text-base italic border-b border-amber-900/20 pb-1" {...props} />;
                          }
                          return <h3 className={`font-bold mt-6 mb-2 text-lg uppercase tracking-wider ${m.isDeep ? 'text-purple-400' : 'text-amber-500'}`} {...props} />;
                        },
                        h4: ({node, ...props}) => <h4 className={`font-bold mt-5 mb-2 text-base uppercase tracking-wider ${m.isDeep ? 'text-purple-400' : 'text-amber-500'}`} {...props} />,
                        p: ({node, ...props}) => {
                          const content = String(props.children);
                          // Handle strategic highlights manually if not caught by lists
                          if (content.match(/^\d\.\s[A-Z\s]+:/)) {
                             return <h4 className={`font-bold mt-6 mb-2 text-sm uppercase tracking-wider ${m.isDeep ? 'text-purple-400' : 'text-amber-500'}`}>{content}</h4>;
                          }
                          return <p className="mb-4 leading-relaxed" {...props} />;
                        },
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="text-zinc-400" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-zinc-700 pl-4 italic text-zinc-500 my-4" {...props} />
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
                <div className={`text-[9px] text-zinc-600 font-mono tracking-tighter ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {m.role.toUpperCase()} {m.isDeep ? '(ANALISIS)' : ''}
                </div>
              </div>
              {m.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-1 order-3 shadow-inner">
                  <User className="text-zinc-500" size={22} />
                </div>
              )}
            </div>
          ))}
          {isLoading && !messages[messages.length-1].content && (
            <div className="flex gap-3 items-center animate-pulse pl-16">
              <div className={`w-2 h-2 rounded-full ${isDeepDive ? 'bg-purple-500' : 'bg-amber-600'}`}></div>
              <div className={`w-2 h-2 rounded-full ${isDeepDive ? 'bg-purple-500/60' : 'bg-amber-600/60'}`}></div>
              <div className={`w-2 h-2 rounded-full ${isDeepDive ? 'bg-purple-500/30' : 'bg-amber-600/30'}`}></div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/95 to-transparent z-30">
          <div className="max-w-4xl mx-auto relative group">
            {isDeepDive && (
              <div className="absolute -top-10 left-0 flex items-center gap-2 text-[10px] text-purple-400/80 bg-purple-900/10 px-3 py-1 rounded-t-lg border border-purple-900/20 border-b-0 ml-4 animate-in fade-in slide-in-from-bottom-2">
                <Info size={12} /> Pegue el texto o propuesta para una auditoría profunda.
              </div>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isDeepDive ? "Pegue aquí el texto que desea auditar..." : "Describa su incertidumbre estratégica..."}
              className={`w-full bg-[#16161a]/80 backdrop-blur-sm border rounded-2xl py-5 pl-7 pr-16 focus:outline-none focus:ring-2 transition-all resize-none h-16 min-h-[64px] max-h-48 text-zinc-200 placeholder-zinc-600 shadow-2xl ${isDeepDive ? 'border-purple-900/30 focus:ring-purple-500/30 focus:border-purple-500/50' : 'border-zinc-800 focus:ring-amber-500/30 focus:border-amber-500/50'}`}
              rows={1}
            />
            <button 
              onClick={handleSend} 
              disabled={isLoading || !input.trim()} 
              className={`absolute right-3 bottom-3 p-3 text-white rounded-xl transition-all shadow-xl active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 ${isDeepDive ? 'bg-purple-700 hover:bg-purple-600 shadow-purple-900/20' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'}`}
            >
              {isDeepDive ? <SearchCode size={22} /> : <Send size={22} />}
            </button>
          </div>
          <p className="text-center text-[10px] text-zinc-600 mt-4 font-medium uppercase tracking-[0.2em]">
            La decisión y la responsabilidad del viaje recaen en el criterio humano
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
