import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Sparkles, Terminal } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '../hooks/useAuth';
import Markdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function WalChat() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `System Online. I am WAL (Web-Assisted Life), your clinical AI companion. How can I assist your mission today, ${profile?.name?.split(' ')[0] || 'User'}?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const playAudioFeedback = (type: 'out' | 'in') => {
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'out') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      }
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Audio context might be restricted by browser policy before user interaction
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    playAudioFeedback('out');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const systemInstruction = `You are "WAL", a super-intelligent clinical assistant for OS-CLINICAL, a technical medical platform. 
      Your personality is professional, slightly robotic/technical, yet helpful and precise.
      Users include patients, doctors, and admins.
      Today is ${new Date().toLocaleDateString()}. 
      User profile: Name: ${profile?.name}, Role: ${profile?.role}.
      
      CORE DIRECTIVES:
      1. RESPONSE STRUCTURE: Always use Markdown headers (# ## ###), bullet points, and bold text for key terms. Keep it clean and readable.
      2. SYMPTOM ANALYSIS: If a user describes symptoms, use your clinical logic to suggest the top 3 most likely differentials (with strong disclaimers that you are an AI, not a doctor).
      3. SPECIALIST DIRECTION: For any identified concern, explicitly recommend which specialist the user should see (e.g., Cardiologist, Dermatologist, ENT, Endocrine, etc.).
      4. DOCTOR/ADMIN CONTEXT: If the user is a Doctor or Admin, adapt to be more technical, referencing clinical codes or system parameters.
      5. SAFETY FIRST: For critical symptoms (chest pain, stroke signs, heavy bleeding), immediately advise calling emergency services in bold red-like text (using bold).
      
      FORMAT:
      # ANALYSIS: [Title]
      - **Likely Concern**: ...
      - **Specialist Recommendation**: ...
      - **Suggested Steps**: ...
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...history, { role: 'user', parts: [{ text: input }] }],
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const responseText = response.text || "I was unable to synthesize a response. Check logs.";

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      playAudioFeedback('in');
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('WAL Error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Error in neural link. Please check network connectivity or API configuration.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 z-[150] w-16 h-16 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-blue-500 transition-colors shadow-blue-900/40 border border-blue-400 group"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} className="group-hover:rotate-12 transition-transform" />}
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900"
            />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-28 right-8 z-[150] w-[400px] h-[600px] bg-[#0F172A] border border-[#1F2937] rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-[#1e293b]/50 border-b border-[#1F2937] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-lg">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-white">WAL_INTELLIGENCE</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Neural Link: Active</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed markdown-body ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-[#161B22] text-slate-300 border border-[#30363D] rounded-tl-none font-medium'
                  }`}>
                    {m.role === 'assistant' ? (
                      <Markdown>{m.content}</Markdown>
                    ) : (
                      m.content
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-2 font-mono uppercase">
                    {m.role === 'assistant' ? 'OS_WAL' : 'CLIENT_UNIT'} // {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 text-blue-400 font-mono text-[10px] uppercase tracking-widest p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl w-fit">
                  <Sparkles size={10} className="animate-spin" />
                  Synthesizing Response...
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 bg-[#1e293b]/50 border-t border-[#1F2937]">
              <div className="flex gap-3 bg-[#0D1117] p-2 rounded-2xl border border-[#30363D] focus-within:border-blue-500 transition-all">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Query system or describe symptoms..."
                  className="flex-1 bg-transparent px-4 py-2 text-slate-200 outline-none text-sm placeholder:text-slate-600"
                />
                <button 
                  onClick={handleSend}
                  disabled={isTyping}
                  className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <Terminal size={10} />
                  COMMAND_INTERFACE_V2.1
                </div>
                <div className="text-[10px] text-slate-600 font-medium">Power optimization: On</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
