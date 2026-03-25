/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { Play, Pause, SkipForward, SkipBack, Trophy, Music, Gamepad2, RefreshCw, Send, MessageSquare, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';

// --- Constants ---
const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const GAME_SPEED = 150;

const TRACKS = [
  {
    title: "Neon Pulse",
    artist: "SynthAI",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    color: "cyan"
  },
  {
    title: "Cyber Drift",
    artist: "Neural Beats",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    color: "pink"
  },
  {
    title: "Digital Horizon",
    artist: "ByteCore",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    color: "purple"
  }
];

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  color: string;
}

export default function App() {
  // --- Game State ---
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(true);

  // --- Music State ---
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // --- Game Logic ---
  const generateFood = useCallback(() => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      const onSnake = snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!onSnake) break;
    }
    setFood(newFood);
  }, [snake]);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    generateFood();
  };

  const moveSnake = useCallback(() => {
    if (isGameOver || isPaused) return;

    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE
      };

      if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setIsGameOver(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 10);
        generateFood();
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, isGameOver, isPaused, generateFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
        }
      }
      if (document.activeElement?.tagName === 'INPUT') return;
      switch (e.key) {
        case 'ArrowUp': if (direction.y !== 1) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y !== -1) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x !== 1) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x !== -1) setDirection({ x: 1, y: 0 }); break;
        case ' ': setIsPaused(p => !p); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  useEffect(() => {
    const interval = setInterval(moveSnake, GAME_SPEED);
    return () => clearInterval(interval);
  }, [moveSnake]);

  useEffect(() => {
    if (score > highScore) setHighScore(score);
  }, [score, highScore]);

  // --- Music Logic ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length);
    setIsPlaying(true);
  };

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = TRACKS[currentTrackIndex].url;
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      }
    }
  }, [currentTrackIndex]);

  const currentTrack = TRACKS[currentTrackIndex];

  // --- Chat Logic ---
  useEffect(() => {
    socketRef.current = io();
    socketRef.current.on('chat_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg].slice(-50));
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isNameSet) return;
    socketRef.current?.emit('chat_message', {
      user: userName,
      text: inputMessage,
      color: currentTrack.color
    });
    setInputMessage('');
  };

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      setIsNameSet(true);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#050505] flex overflow-hidden selection:bg-[#00FFFF] selection:text-black">
      {/* Overlay Effects */}
      <div className="fixed inset-0 scanlines z-50 pointer-events-none opacity-20" />
      <div className="fixed inset-0 static-noise z-40 pointer-events-none" />

      {/* Recipe 11: Split Layout */}
      <main className="flex-1 flex flex-col border-r border-[#333] relative">
        {/* Header Section */}
        <header className="h-24 border-b border-[#333] flex items-center justify-between px-8 bg-[#0a0a0a]">
          <div className="flex flex-col">
            <span className="micro-label text-[#00FFFF]">System.Status</span>
            <h1 className="font-display text-4xl font-bold tracking-tighter text-white uppercase glitch" data-text="NEON_SNAKE_V2.0">
              NEON_SNAKE_V2.0
            </h1>
          </div>

          <div className="flex gap-12">
            <div className="flex flex-col items-end">
              <span className="micro-label text-[#FF00FF]">Data.Score</span>
              <span className="font-pixel text-3xl text-[#FF00FF] neon-text-magenta">{score.toString().padStart(4, '0')}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="micro-label text-[#00FFFF]">Data.Best</span>
              <span className="font-pixel text-3xl text-[#00FFFF] neon-text-cyan">{highScore.toString().padStart(4, '0')}</span>
            </div>
          </div>
        </header>

        {/* Recipe 1: Visible Grid Game Area */}
        <div className="flex-1 relative bg-[#080808] p-8 flex items-center justify-center">
          <div className="relative aspect-square w-full max-w-[600px] hardware-card overflow-hidden">
            {/* Grid Lines */}
            <div className="absolute inset-0 grid grid-cols-20 grid-rows-20 pointer-events-none opacity-10">
              {Array.from({ length: 400 }).map((_, i) => (
                <div key={i} className="border-[0.5px] border-[#00FFFF]" />
              ))}
            </div>

            {/* Snake */}
            {snake.map((segment, i) => (
              <motion.div
                key={`${segment.x}-${segment.y}-${i}`}
                initial={false}
                animate={{ x: segment.x * (100 / GRID_SIZE) + '%', y: segment.y * (100 / GRID_SIZE) + '%' }}
                transition={{ type: "spring", stiffness: 400, damping: 40 }}
                className={`absolute w-[5%] h-[5%] ${i === 0 ? 'bg-[#00FFFF] shadow-[0_0_15px_#00FFFF] z-10' : 'bg-[#00FFFF]/40 border border-[#00FFFF]/20'}`}
                style={{ left: 0, top: 0 }}
              />
            ))}

            {/* Food */}
            <motion.div
              animate={{ 
                scale: [1, 1.4, 1],
                opacity: [0.6, 1, 0.6]
              }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="absolute w-[5%] h-[5%] bg-[#FF00FF] shadow-[0_0_20px_#FF00FF]"
              style={{ left: food.x * (100 / GRID_SIZE) + '%', top: food.y * (100 / GRID_SIZE) + '%' }}
            />

            {/* Overlays */}
            <AnimatePresence>
              {isGameOver && (
                <motion.div
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#FF00FF]/10 backdrop-blur-xl flex flex-col items-center justify-center z-20 border-4 border-[#FF00FF]"
                >
                  <span className="font-pixel text-6xl text-[#FF00FF] mb-8 glitch" data-text="CRITICAL_FAILURE">CRITICAL_FAILURE</span>
                  <button
                    onClick={resetGame}
                    className="px-12 py-4 bg-[#FF00FF] text-black font-bold text-xl uppercase tracking-widest hover:bg-white transition-all transform hover:skew-x-12 active:scale-95"
                  >
                    REBOOT_SYSTEM
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isPaused && !isGameOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-20"
                >
                  <button
                    onClick={() => setIsPaused(false)}
                    className="w-24 h-24 flex items-center justify-center border-2 border-[#00FFFF] text-[#00FFFF] hover:bg-[#00FFFF] hover:text-black transition-all group"
                  >
                    <Play className="w-12 h-12 fill-current group-hover:scale-110 transition-transform" />
                  </button>
                  <span className="mt-6 micro-label text-[#00FFFF] animate-pulse">Waiting.For.Input...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Controls */}
        <footer className="h-16 border-t border-[#333] bg-[#0a0a0a] flex items-center justify-between px-8">
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#00FFFF] animate-ping" />
              <span className="micro-label">System.Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#FF00FF]" />
              <span className="micro-label">Neural.Link.Stable</span>
            </div>
          </div>
          <span className="micro-label opacity-40">© 2026_NEURAL_SYNTH_SYSTEMS</span>
        </footer>
      </main>

      {/* Sidebar Section */}
      <aside className="w-[400px] flex flex-col bg-[#080808]">
        {/* Recipe 3: Hardware Music Player */}
        <section className="h-1/2 border-b border-[#333] flex flex-col">
          <div className="p-6 border-b border-[#333] flex items-center justify-between">
            <span className="micro-label text-[#FF00FF]">Audio.Processor</span>
            <Music className="w-4 h-4 text-[#FF00FF]" />
          </div>
          
          <div className="flex-1 p-8 flex flex-col gap-8">
            {/* Recipe 5: Marquee Track Info */}
            <div className="h-12 border-y border-[#333] flex items-center overflow-hidden bg-black">
              <div className="marquee-track whitespace-nowrap">
                <span className="font-display text-2xl font-bold text-white uppercase px-4">
                  NOW_PLAYING: {currentTrack.title} // ARTIST: {currentTrack.artist} // FREQUENCY: 44.1KHZ // 
                </span>
                <span className="font-display text-2xl font-bold text-white uppercase px-4">
                  NOW_PLAYING: {currentTrack.title} // ARTIST: {currentTrack.artist} // FREQUENCY: 44.1KHZ // 
                </span>
              </div>
            </div>

            <div className="flex-1 relative hardware-card flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 grid grid-cols-10 grid-rows-10">
                  {Array.from({ length: 100 }).map((_, i) => (
                    <div key={i} className="border-[0.5px] border-[#FF00FF]/20" />
                  ))}
                </div>
              </div>
              
              <motion.div
                animate={isPlaying ? { rotate: 360 } : {}}
                transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                className="w-48 h-48 border border-dashed border-[#FF00FF]/40 rounded-full flex items-center justify-center"
              >
                <div className="w-40 h-40 border border-[#FF00FF]/60 rounded-full flex items-center justify-center">
                  <div className="w-12 h-12 bg-[#FF00FF] rounded-full shadow-[0_0_30px_#FF00FF]" />
                </div>
              </motion.div>

              {/* Visualizer */}
              <div className="absolute bottom-4 left-4 right-4 h-16 flex items-end justify-between px-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={isPlaying ? { height: [4, Math.random() * 60 + 10, 4] } : { height: 4 }}
                    transition={{ repeat: Infinity, duration: 0.3 + Math.random() * 0.3 }}
                    className="w-1 bg-[#FF00FF]/60"
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button onClick={prevTrack} className="p-4 border border-[#333] hover:bg-[#FF00FF] hover:text-black transition-all">
                <SkipBack className="w-6 h-6" />
              </button>
              <button onClick={togglePlay} className="w-20 h-20 bg-[#FF00FF] text-black flex items-center justify-center hover:bg-white transition-all">
                {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
              </button>
              <button onClick={nextTrack} className="p-4 border border-[#333] hover:bg-[#FF00FF] hover:text-black transition-all">
                <SkipForward className="w-6 h-6" />
              </button>
            </div>
          </div>
        </section>

        {/* Recipe 3: Hardware Chat Widget */}
        <section className="h-1/2 flex flex-col">
          <div className="p-6 border-b border-[#333] flex items-center justify-between">
            <span className="micro-label text-[#00FFFF]">Neural.Comms</span>
            <MessageSquare className="w-4 h-4 text-[#00FFFF]" />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
            {!isNameSet ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 gap-6">
                <span className="micro-label text-center">Authentication.Required</span>
                <form onSubmit={handleNameSubmit} className="w-full flex flex-col gap-4">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="IDENT_CODE..."
                    className="w-full bg-black border border-[#333] p-4 font-mono text-[#00FFFF] focus:outline-none focus:border-[#00FFFF] placeholder:opacity-20"
                    maxLength={15}
                  />
                  <button type="submit" className="w-full py-4 bg-[#00FFFF] text-black font-bold uppercase tracking-widest hover:bg-white transition-all">
                    INIT_LINK
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-hide">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col gap-1 group">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] font-bold text-[#00FFFF] uppercase tracking-widest">
                          {msg.user}
                        </span>
                        <span className="font-mono text-[8px] opacity-20">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="p-3 border-l border-[#333] group-hover:border-[#00FFFF] transition-colors bg-white/5">
                        <p className="text-xs font-mono leading-relaxed text-zinc-400">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendMessage} className="p-6 border-t border-[#333] bg-black flex gap-4">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Transmit_data..."
                    className="flex-1 bg-[#0a0a0a] border border-[#333] px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-[#00FFFF]"
                  />
                  <button type="submit" className="p-4 bg-[#00FFFF] text-black hover:bg-white transition-all">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </aside>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} onEnded={nextTrack} className="hidden" />
    </div>
  );
}


