import React, { useState, useEffect } from 'react';
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
  setLoading: (state: boolean) => {}
});

// Gamified loader component
const TicketLoader = () => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
      <div className="relative w-80 h-80">
        {/* Scanning laser effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ff00ff] to-transparent animate-scan rounded-full"></div>
        
        {/* Floating tickets */}
        {[...Array(8)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-16 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg"
            style={{
              top: `${Math.random() * 70}%`,
              left: `${Math.random() * 80}%`,
              transform: `rotate(${Math.random() * 30 - 15}deg) scale(${0.5 + Math.random() * 0.7})`,
              animation: `float 3s ease-in-out infinite ${i * 0.2}s`,
              opacity: 0.7 + Math.random() * 0.3
            }}
          >
            <div className="absolute inset-1 border-2 border-dashed border-white/30 rounded"></div>
          </div>
        ))}
        
        {/* Center spinner */}
        <div className="absolute inset-0 m-auto w-32 h-32 flex items-center justify-center">
          <div className="w-full h-full rounded-full border-t-4 border-b-4 border-cyan-400 animate-spin-slow"></div>
          <div className="absolute text-white text-center">
            <div className="text-xl font-bold mb-2">Validating Ticket</div>
            <div className="flex justify-center">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-2 h-2 mx-1 bg-cyan-400 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Injected CSS for animations */}
      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(80vh); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--rotation)); }
          50% { transform: translateY(-20px) rotate(var(--rotation)); }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite alternate;
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

// Loader provider component
const LoaderProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      setIsLoading(true);
      setRequestCount(prev => prev + 1);
      
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
    <LoaderContext.Provider value={{ isLoading, setLoading: setIsLoading }}>
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
