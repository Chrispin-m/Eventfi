import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Web3Provider } from './context/Web3Context';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { EventPage } from './pages/EventPage';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { TicketPage } from './pages/TicketPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { ScannerPage } from './pages/ScannerPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// loader context
const LoaderContext = React.createContext({
  isLoading: false,
  setLoading: (state: boolean) => {},
  loadingMessage: 'Loading Web3 Magic...',
  setLoadingMessage: (msg: string) => {}
});

// Particle type
type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
};

// Gamified loader component with interactive particles
const TicketLoader = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [messageIndex, setMessageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const particleId = useRef(0);
  
  const loadingMessages = [
    "Connecting to Web3 Wallet...",
    "Minting Event Tickets...",
    "Verifying NFT Tickets...",
    "Scanning Blockchain...",
    "Creating Event...",
    "Loading Event Data...",
    "Finalizing Purchase...",
    "Confirming Transaction..."
  ];

  // Cycle through loading messages
  useEffect(() => {
    if (messageIndex < loadingMessages.length - 1) {
      const timer = setTimeout(() => {
        setMessageIndex(prev => (prev + 1) % loadingMessages.length);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [messageIndex]);

  // interactive particles on mouse/touch
  const createParticles = (x: number, y: number) => {
    const newParticles: Particle[] = [];
    const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff7700', '#a200ff'];
    
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const size = 5 + Math.random() * 15;
      
      newParticles.push({
        id: particleId.current++,
        x,
        y,
        size,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 50 + Math.random() * 50
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Handle mouse/touch events
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = 'touches' in e 
      ? e.touches[0].clientX - rect.left 
      : e.clientX - rect.left;
    const y = 'touches' in e 
      ? e.touches[0].clientY - rect.top 
      : e.clientY - rect.top;
    
    createParticles(x, y);
  };

  // loop for particles
  useEffect(() => {
    let animationFrameId: number;
    
    const updateParticles = () => {
      setParticles(prev => {
        const updated = prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 1,
            size: p.size * 0.97,
            vy: p.vy + 0.1  // Gravity effect
          }))
          .filter(p => p.life > 0 && p.size > 0.5);
        
        return updated;
      });
      
      animationFrameId = requestAnimationFrame(updateParticles);
    };
    
    animationFrameId = requestAnimationFrame(updateParticles);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center touch-none"
      onMouseMove={handleInteraction}
      onTouchMove={handleInteraction}
    >
      {/* Interactive particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full opacity-80"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size/2}px ${p.size/3}px ${p.color}`,
            transform: `translate(-50%, -50%)`,
            opacity: p.life / 100,
            transition: 'all 0.1s ease-out'
          }}
        />
      ))}
      
      {/* Floating tickets with physics */}
      {[...Array(12)].map((_, i) => (
        <div 
          key={i}
          className="absolute w-16 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-xl border-2 border-white/20 flex items-center justify-center"
          style={{
            top: `${10 + Math.random() * 80}%`,
            left: `${10 + Math.random() * 80}%`,
            transform: `rotate(${Math.random() * 20 - 10}deg)`,
            animation: `float${i % 3} 4s ease-in-out infinite ${i * 0.3}s`,
            opacity: 0.8,
            zIndex: 10
          }}
        >
          <div className="absolute inset-1 border border-white/30 rounded-lg"></div>
          <div className="text-white font-bold text-xs rotate-90">TICKET</div>
        </div>
      ))}
      
      {/* Center stage with dynamic message */}
      <div className="relative z-20 text-center p-8 rounded-2xl bg-black/50 backdrop-blur-lg border border-cyan-500/50">
        <div className="mb-6">
          <div className="relative w-32 h-32 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-400 animate-ping-slow opacity-30"></div>
            <div className="absolute inset-4 rounded-full border-4 border-cyan-500 animate-spin-slow"></div>
            <div className="absolute inset-8 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
        
        <div className="text-cyan-300 text-xl font-bold mb-2">
          {loadingMessages[messageIndex]}
        </div>
        
        <div className="text-white/80 text-sm max-w-md">
          {messageIndex > 2 ? "Almost there! Your blockchain magic is processing..." : "Hang tight! The decentralized fairies are at work..."}
        </div>
        
        <div className="mt-6 text-xs text-white/50">
          <div className="mb-1">Tip: Touch/move to create colorful particles!</div>
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
      
      {/* Animated stage elements */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-cyan-500/20 to-transparent"></div>
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-purple-500/20 to-transparent"></div>
      
      {/* Scanning lasers */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ff00ff] to-transparent animate-scan"></div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ffff] to-transparent animate-scan-reverse"></div>
      
      {/* Injected CSS for animations */}
      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0.8; }
          100% { transform: translateY(100vh); opacity: 0.2; }
        }
        @keyframes scan-reverse {
          0% { transform: translateY(0) scaleX(-1); opacity: 0.8; }
          100% { transform: translateY(-100vh) scaleX(-1); opacity: 0.2; }
        }
        @keyframes float0 {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-30px) rotate(5deg); }
        }
        @keyframes float1 {
          0%, 100% { transform: translateY(0) rotate(3deg); }
          50% { transform: translateY(-40px) rotate(-3deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-35px) rotate(8deg); }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 1; }
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .animate-scan {
          animation: scan 2.5s ease-in-out infinite;
        }
        .animate-scan-reverse {
          animation: scan-reverse 3s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .animate-ping-slow {
          animation: ping-slow 3s cubic-bezier(0,0,0.2,1) infinite;
        }
      `}</style>
    </div>
  );
};

// Loader provider component
const LoaderProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading Web3 Magic...');
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      // Don't show loader for favicon requests
      if (args[0]?.toString().includes('favicon.ico')) {
        return originalFetch(...args);
      }
      
      setIsLoading(true);
      setRequestCount(prev => prev + 1);
      
      // context-specific messages
      const url = args[0]?.toString() || '';
      if (url.includes('/api/events')) setLoadingMessage('Loading Events...');
      if (url.includes('/api/tickets')) setLoadingMessage('Processing Tickets...');
      if (url.includes('/api/verify')) setLoadingMessage('Verifying Ticket...');
      if (url.includes('/api/create-event')) setLoadingMessage('Creating Event...');
      
      try {
        return await originalFetch(...args);
      } finally {
        setRequestCount(prev => {
          const newCount = prev - 1;
          if (newCount === 0) setIsLoading(false);
          return newCount;
        });
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <LoaderContext.Provider value={{ 
      isLoading, 
      setLoading: setIsLoading,
      loadingMessage,
      setLoadingMessage
    }}>
      {children}
      {isLoading && <TicketLoader />}
    </LoaderContext.Provider>
  );
};

function App() {
  return (
    <Web3Provider>
      <LoaderProvider>
        <Router>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/event/:id" element={<EventPage />} />
                <Route path="/organizer" element={<OrganizerDashboard />} />
                <Route path="/my-tickets" element={<MyTicketsPage />} />
                <Route path="/ticket/:id" element={<TicketPage />} />
                <Route path="/scanner" element={<ScannerPage />} />
              </Routes>
            </main>
            <Footer />
            <ToastContainer
              position="bottom-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </div>
        </Router>
      </LoaderProvider>
    </Web3Provider>
  );
}

export default App;
