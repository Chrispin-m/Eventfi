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

// gamified loader
const TicketLoader = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [messageIndex, setMessageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const particleId = useRef(0);
  
  const loadingMessages = [
    "Connecting to blockchain...",
    "Preparing your tickets...",
    "Verifying access...",
    "Loading event magic...",
    "Finalizing transaction...",
    "Creating your experience..."
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

  // Create interactive particles
  const createParticles = (x: number, y: number) => {
    const newParticles: Particle[] = [];
    const colors = ['#6366f1', '#ec4899', '#3b82f6', '#8b5cf6', '#06b6d4'];
    
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      const size = 8 + Math.random() * 12;
      
      newParticles.push({
        id: particleId.current++,
        x,
        y,
        size,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40 + Math.random() * 40
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Handle interactions
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

  // Particle animation
  useEffect(() => {
    let animationFrameId: number;
    
    const updateParticles = () => {
      setParticles(prev => {
        return prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 1,
            size: p.size * 0.98,
            vy: p.vy + 0.08  // Gentle gravity
          }))
          .filter(p => p.life > 0 && p.size > 0.5);
      });
      
      animationFrameId = requestAnimationFrame(updateParticles);
    };
    
    animationFrameId = requestAnimationFrame(updateParticles);
    
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center touch-none"
      onMouseMove={handleInteraction}
      onTouchMove={handleInteraction}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCI+PGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+')]"></div>
      
      {/* Elegant particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full opacity-80 transition-all duration-100"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle at center, ${p.color}, transparent)`,
            transform: `translate(-50%, -50%)`,
            opacity: p.life / 100,
            filter: `blur(${Math.max(2, p.size/8)}px)`
          }}
        />
      ))}
      
      {/* Graceful ticket holograms - static positions with gentle pulsing */}
      {[0, 1, 2, 3].map((_, i) => (
        <div 
          key={i}
          className="absolute w-20 h-28 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-xl backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-lg"
          style={{
            top: `${15 + (i % 2) * 50}%`,
            left: `${20 + (i % 3) * 30}%`,
            transform: `rotate(${i * 15}deg)`,
            animation: `pulse 4s ease-in-out infinite ${i * 0.5}s`,
            opacity: 0.3,
            zIndex: 10
          }}
        >
          <div className="absolute inset-1 border border-white/10 rounded-lg"></div>
          <div className="text-white/30 font-bold text-xs rotate-90">EVENT</div>
        </div>
      ))}
      
      {/* Main focus area */}
      <div className="relative z-30 text-center p-8 rounded-2xl bg-black/30 backdrop-blur-md border border-indigo-500/30 max-w-md">
        <div className="mb-6">
          <div className="relative w-32 h-32 mx-auto">
            {/* Elegant concentric circles */}
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping-slow"></div>
            <div className="absolute inset-4 rounded-full border-4 border-indigo-500/30 animate-ping-slower"></div>
            
            {/* Central animated element */}
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg">
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute w-6 h-6 bg-white rounded-full animate-pulse"></div>
                <div className="absolute w-full h-full animate-spin-slow">
                  <div className="w-4 h-4 bg-cyan-400 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-indigo-300 text-xl font-medium mb-2 tracking-wider">
          {loadingMessages[messageIndex]}
        </div>
        
        <div className="text-white/70 text-sm mb-6">
          {messageIndex > 2 ? "Finishing touches..." : "Securing your blockchain experience..."}
        </div>
        
        {/* Interactive prompt */}
        <div className="text-xs text-white/50 italic">
          <div className="mb-1">Tip: Move cursor to create magical effects</div>
          <div className="flex justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i} 
                className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Ambient lighting */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-indigo-500/10 to-transparent"></div>
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-purple-500/10 to-transparent"></div>
      
      {/* Subtle scanning effect */}
      <div className="absolute top-10 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-scan"></div>
      
      {/* Injected CSS */}
      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0.3; }
          100% { transform: translateY(80vh); opacity: 0.1; }
        }
        @keyframes pulse {
          0%, 100% { transform: rotate(var(--rotation)) scale(1); opacity: 0.3; }
          50% { transform: rotate(calc(var(--rotation) + 5deg)) scale(1.05); opacity: 0.4; }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.2; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes ping-slower {
          0% { transform: scale(1); opacity: 0.1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .animate-scan {
          animation: scan 4s ease-in-out infinite;
        }
        .animate-ping-slow {
          animation: ping-slow 4s cubic-bezier(0,0,0.2,1) infinite;
        }
        .animate-ping-slower {
          animation: ping-slower 5s cubic-bezier(0,0,0.2,1) infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
};

// Loader provider
const LoaderProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Connecting to blockchain...');
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      // Skip non-essential requests
      if (args[0]?.toString().includes('favicon.ico')) {
        return originalFetch(...args);
      }
      
      setIsLoading(true);
      setRequestCount(prev => prev + 1);
      
      // Set context-specific messages
      const url = args[0]?.toString() || '';
      if (url.includes('/api/events')) setLoadingMessage('Discovering events...');
      if (url.includes('/api/tickets')) setLoadingMessage('Processing your tickets...');
      if (url.includes('/api/verify')) setLoadingMessage('Verifying ticket...');
      if (url.includes('/api/create-event')) setLoadingMessage('Creating your event...');
      if (url.includes('/api/wallet')) setLoadingMessage('Securing wallet connection...');
      
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
              theme="colored"
              toastClassName="border border-indigo-200 shadow-lg"
            />
          </div>
        </Router>
      </LoaderProvider>
    </Web3Provider>
  );
}

export default App;
