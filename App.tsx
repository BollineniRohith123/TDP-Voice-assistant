import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Language } from './types';
import { TDP_SCHEMES, SYSTEM_INSTRUCTION } from './constants';
import { base64ToUint8Array, decodeAudioData, pcmToGeminiBlob } from './utils/audioUtils';
import Visualizer from './components/Visualizer';
import SchemeCard from './components/SchemeCard';
import TdpLogo from './components/TdpLogo';

const App: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.TELUGU);
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio Queue & State
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const isInterruptedRef = useRef(false);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<Promise<any> | null>(null);

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.then((session) => {
        try {
          session.close();
        } catch (e) {
          console.warn("Session close error", e);
        }
      }).catch(() => {});
      sessionRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Stop all playing audio
    audioQueueRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    audioQueueRef.current = [];

    setIsConnected(false);
    setIsAiSpeaking(false);
    setIsUserSpeaking(false);
    nextStartTimeRef.current = 0;
    isInterruptedRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      stopSession();
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (inputAudioContextRef.current) inputAudioContextRef.current.close().catch(() => {});
    };
  }, [stopSession]);

  const playAudioChunk = async (base64Audio: string) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;

    try {
      const audioBuffer = await decodeAudioData(
        base64ToUint8Array(base64Audio),
        ctx,
        24000,
        1
      );

      const currentTime = ctx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.05;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
        if (audioQueueRef.current.length === 0) {
            setIsAiSpeaking(false);
        }
      };

      source.start(nextStartTimeRef.current);
      audioQueueRef.current.push(source);
      
      nextStartTimeRef.current += audioBuffer.duration;
      setIsAiSpeaking(true);

    } catch (e) {
      console.error("Audio decoding error", e);
    }
  };

  const handleBargeIn = () => {
    if (audioQueueRef.current.length > 0 && !isInterruptedRef.current) {
      isInterruptedRef.current = true;
      audioQueueRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      audioQueueRef.current = [];
      
      if (audioContextRef.current) {
        nextStartTimeRef.current = audioContextRef.current.currentTime;
      }
      setIsAiSpeaking(false);
    }
  };

  const startSession = async () => {
    setError(null);
    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key not found. Please check your environment configuration.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (!inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed') {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }

      const outputCtx = audioContextRef.current;
      const inputCtx = inputAudioContextRef.current;

      await outputCtx.resume();
      await inputCtx.resume();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;
      nextStartTimeRef.current = outputCtx.currentTime;

      const langContext = selectedLanguage === Language.TELUGU 
        ? "The user prefers to speak in Telugu. Respond primarily in Telugu, but you can mix in English terms if common (Tanglish)." 
        : "The user prefers to speak in English. Respond in clear Indian English.";

      const finalConfig = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${langContext}`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, 
          },
        },
      };

      const sessionPromise = ai.live.connect({
        ...finalConfig,
        callbacks: {
          onopen: () => {
            console.log('TDP Seva Session Opened');
            setIsConnected(true);
            isInterruptedRef.current = false;

            if (!inputCtx || !stream) return;

            const source = inputCtx.createMediaStreamSource(stream);
            sourceRef.current = source;

            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              
              if (rms > 0.02 && isAiSpeaking) {
                 handleBargeIn();
              }

              setIsUserSpeaking(rms > 0.005);

              const pcmBlob = pcmToGeminiBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(e => {
                // Session likely closed
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
               isInterruptedRef.current = false;
               await playAudioChunk(base64Audio);
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              handleBargeIn();
            }
          },
          onclose: () => {
            console.log('Session Closed');
            stopSession();
          },
          onerror: (err) => {
            console.error('Session Error', err);
            setError("Connection disrupted. Please reconnect.");
            stopSession();
          }
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start TDP Voice session");
      stopSession();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-tdp-yellow selection:text-tdp-red">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-tdp-yellow/30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-tdp-yellow blur-md opacity-40 rounded-full"></div>
                <TdpLogo className="relative w-10 h-10 animate-spin-slow" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                  <span className="text-tdp-red">TDP</span> Voice Connect
                </h1>
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                  Official Party Platform
                </span>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
              <button 
                onClick={() => !isConnected && setSelectedLanguage(Language.TELUGU)}
                disabled={isConnected}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  selectedLanguage === Language.TELUGU 
                  ? 'bg-tdp-yellow text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
                } ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                తెలుగు
              </button>
              <button 
                onClick={() => !isConnected && setSelectedLanguage(Language.ENGLISH)}
                disabled={isConnected}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  selectedLanguage === Language.ENGLISH 
                  ? 'bg-tdp-yellow text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
                } ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Hero Section: Voice Interface */}
        <section className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-800">
          {/* Background Elements */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-tdp-red/20 via-slate-900 to-slate-900"></div>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23FCEE21\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
          
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[500px] p-8 text-center">
            
            <div className="mb-8 space-y-2">
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Jai Telugu Desam!
              </h2>
              <p className="text-slate-400 text-lg max-w-lg mx-auto">
                Connect directly with the party's vision. Ask about welfare schemes, development updates, or future plans.
              </p>
            </div>

            <Visualizer isActive={isConnected} isSpeaking={isAiSpeaking} />

            <div className="mt-10 flex flex-col items-center gap-4">
              {!isConnected ? (
                <button
                  onClick={startSession}
                  className="group relative flex items-center gap-3 px-8 py-4 bg-tdp-yellow hover:bg-yellow-300 text-slate-900 rounded-full font-bold text-lg shadow-[0_0_20px_rgba(252,238,33,0.4)] hover:shadow-[0_0_30px_rgba(252,238,33,0.6)] transition-all transform hover:-translate-y-1"
                >
                  <span className="w-8 h-8 flex items-center justify-center bg-slate-900 rounded-full text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </span>
                  Start Conversation
                </button>
              ) : (
                <button
                  onClick={stopSession}
                  className="flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-md rounded-full font-semibold transition-all hover:scale-105"
                >
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  End Session
                </button>
              )}
              
              <p className="text-slate-500 text-sm h-6">
                {isConnected 
                  ? (isUserSpeaking ? "Listening..." : (isAiSpeaking ? "TDP Seva is speaking..." : "Listening..."))
                  : "Tap to start talking"
                }
              </p>
            </div>

            {error && (
              <div className="absolute bottom-6 px-4 py-2 bg-red-500/90 text-white text-sm rounded-lg backdrop-blur-sm animate-fade-in-up">
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Schemes Section */}
        <section>
          <div className="flex items-end justify-between mb-8 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-tdp-red font-bold text-sm tracking-widest uppercase mb-1">Empowering People</h3>
              <h2 className="text-3xl font-bold text-slate-900">Flagship Schemes</h2>
            </div>
            <div className="hidden md:block">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Vision 2047
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {TDP_SCHEMES.map(scheme => (
              <SchemeCard key={scheme.id} scheme={scheme} />
            ))}
          </div>
        </section>

        {/* Info Box */}
        <section className="bg-gradient-to-r from-tdp-yellow to-yellow-400 rounded-2xl p-8 shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/10 transform skew-x-12 translate-x-12"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-slate-900">
              <h3 className="text-2xl font-bold mb-2">Have specific questions?</h3>
              <p className="font-medium text-slate-800/80">
                You can ask about local constituency issues, party manifesto details, or membership information.
              </p>
            </div>
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-6 py-3 bg-slate-900 text-white rounded-lg font-bold shadow-md hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Ask Now
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 border-t-8 border-tdp-yellow mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-white p-1 rounded-full">
                <TdpLogo className="w-12 h-12" />
              </div>
              <div>
                <h4 className="text-lg font-bold">Telugu Desam Party</h4>
                <p className="text-slate-400 text-sm">Serving the people since 1982</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-tdp-yellow font-bold text-lg mb-1">Samajame Devalayam - Prajale Devullu</p>
              <p className="text-slate-500 text-sm">Society is the Temple - People are Gods</p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Telugu Desam Party. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;