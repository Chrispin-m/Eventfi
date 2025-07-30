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
  loadingMessage: 'Initializing Blockchain...',
  setLoadingMessage: (msg: string) => {}
});

// Particle type with realistic smoke properties
type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
};

// Futuristic loader with realistic smoke
const TicketLoader = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [messageIndex, setMessageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const particleId = useRef(0);
  const lastUpdate = useRef(0);
  
  const loadingMessages = [
    "Connecting to blockchain network...",
    "Verifying digital assets...",
    "Securing transaction...",
    "Loading event experience...",
    "Finalizing blockchain operations...",
    "Preparing your ticket gateway..."
  ];

  // Cycle through loading messages
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 3000);
    return () => clearTimeout(timer);
  }, [messageIndex]);

  // Create realistic smoke particles
  const createSmoke = (x: number, y: number) => {
    const newParticles: Particle[] = [];
    const colors = ['rgba(220, 220, 255, 0.8)', 'rgba(200, 230, 255, 0.7)', 'rgba(180, 240, 255, 0.6)'];
    
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.5;
      
      newParticles.push({
        id: particleId.current++,
        x,
        y,
        size: 5 + Math.random() * 10,
        opacity: 0.6 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: -0.5 - Math.random() * 1.5, // Upward movement for smoke
        life: 100
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
    
    createSmoke(x, y);
  };

  // Particle animation with optimized performance
  useEffect(() => {
    let animationFrameId: number;
    
    const updateParticles = (timestamp: number) => {
      // Throttle updates to 60fps
      if (!lastUpdate.current) lastUpdate.current = timestamp;
      const delta = timestamp - lastUpdate.current;
      
      if (delta > 16) {
        setParticles(prev => {
          const updated = prev
            .map(p => {
              // Physics for realistic smoke
              const newSize = p.size + 0.15;
              const newOpacity = p.opacity * 0.96;
              const newVx = p.vx * 0.95;
              const newVy = p.vy - 0.01; // Gravity effect
              
              return {
                ...p,
                x: p.x + p.vx,
                y: p.y + p.vy,
                size: newSize,
                opacity: newOpacity,
                vx: newVx,
                vy: newVy,
                life: p.life - 1
              };
            })
            .filter(p => p.life > 0 && p.opacity > 0.05 && p.size < 100);
          
          return updated;
        });
        
        lastUpdate.current = timestamp;
      }
      
      animationFrameId = requestAnimationFrame(updateParticles);
    };
    
    animationFrameId = requestAnimationFrame(updateParticles);
    
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center touch-none overflow-hidden"
      onMouseMove={handleInteraction}
      onTouchMove={handleInteraction}
    >
      {/* Realistic smoke particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.x,
            top: p.y,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: `radial-gradient(circle, ${p.color}, transparent)`,
            transform: `translate(-50%, -50%)`,
            opacity: p.opacity,
            filter: `blur(${Math.min(10, p.size/5)}px)`,
            transition: 'all 0.1s linear'
          }}
        />
      ))}
      
      {/* Futuristic scanning effect */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan z-20"></div>
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-scan-reverse z-20"></div>
      
      {/* Grid background */}
      <div className="absolute inset-0 opacity-10 bg-grid-pattern bg-[length:40px_40px]"></div>
      
      {/* Central content */}
      <div className="relative z-30 text-center p-8 rounded-2xl bg-black/40 backdrop-blur-lg border border-cyan-500/30 max-w-md">
        <div className="mb-6">
          <div className="relative w-32 h-32 mx-auto">
            {/* Holographic rings */}
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-spin-slow"></div>
            <div className="absolute inset-4 rounded-full border-2 border-purple-500/30 animate-spin-slow-reverse"></div>
            
            {/* Central orb */}
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-600/30 flex items-center justify-center">
              <div className="w-8 h-8 bg-cyan-400 rounded-full animate-pulse shadow-glow"></div>
            </div>
          </div>
        </div>
        
        <div className="text-cyan-300 text-xl font-medium mb-2 tracking-wider">
          {loadingMessages[messageIndex]}
        </div>
        
        <div className="text-gray-300 text-sm mb-6">
          {messageIndex > 2 ? "Completing final checks..." : "Establishing secure connection..."}
        </div>
        
        {/* Interactive prompt */}
        <div className="text-xs text-gray-500 italic">
          <div className="mb-1">Tip: Move cursor to create holographic smoke</div>
          <div className="flex justify-center gap-1">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.3}s` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Subtle corner elements */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50"></div>
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50"></div>
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-purple-500/50"></div>
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-purple-500/50"></div>
      
      {/* Injected CSS */}
      <style jsx>{`
        .bg-grid-pattern {
          background-image: linear-gradient(rgba(100, 200, 255, 0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(100, 200, 255, 0.1) 1px, transparent 1px);
        }
        .shadow-glow {
          box-shadow: 0 0 15px 5px rgba(0, 200, 255, 0.5);
        }
        @keyframes scan {
          0% { transform: translateY(-20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes scan-reverse {
          0% { transform: translateY(20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spin-slow-reverse {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        .animate-scan {
          animation: scan 2.5s linear infinite;
        }
        .animate-scan-reverse {
          animation: scan-reverse 3s linear infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 15s linear infinite;
        }
        .animate-spin-slow-reverse {
          animation: spin-slow-reverse 18s linear infinite;
        }
      `}</style>
    </div>
  );
};

// Loader provider with optimized performance
const LoaderProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing Blockchain...');
  const requestCountRef = useRef(0);

  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      // Skip non-essential requests
      const url = args[0]?.toString() || '';
      if (url.includes('favicon.ico') || url.includes('.css') || url.includes('.js')) {
        return originalFetch(...args);
      }
      
      requestCountRef.current++;
      setIsLoading(true);
      
      // Set context-specific messages
      if (url.includes('/api/events')) setLoadingMessage('Loading events...');
      if (url.includes('/api/tickets')) setLoadingMessage('Processing tickets...');
      if (url.includes('/api/verify')) setLoadingMessage('Verifying ticket...');
      if (url.includes('/api/create-event')) setLoadingMessage('Creating event...');
      if (url.includes('/api/wallet')) setLoadingMessage('Connecting wallet...');
      
      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        requestCountRef.current--;
        if (requestCountRef.current <= 0) {
          requestCountRef.current = 0;
          setIsLoading(false);
        }
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
          <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col">
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
              theme="dark"
              toastClassName="bg-gray-800 border border-cyan-700"
            />
          </div>
        </Router>
      </LoaderProvider>
    </Web3Provider>
  );
}

export default App;
