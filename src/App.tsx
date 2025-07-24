import React from 'react';
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

function App() {
  return (
    <Web3Provider>
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
    </Web3Provider>
  );
}

export default App;