import React from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Shield, Zap, Globe } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '20px 20px'
        }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Decentralized Event
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                Ticketing
              </span>
            </h1>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              Built on CrossFi Chain. Secure, transparent, and fraud-proof ticketing 
              with XFI, XUSD, and MPX token support.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                to="/organizer"
                className="inline-flex items-center justify-center space-x-2 bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Ticket className="w-5 h-5" />
                <span>Create Event</span>
              </Link>
              <Link
                to="/#events"
                className="inline-flex items-center justify-center space-x-2 border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-all duration-200"
              >
                <Globe className="w-5 h-5" />
                <span>Browse Events</span>
              </Link>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-green-400" />
                <span className="text-sm">Fraud Proof</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="text-sm">Instant Settlement</span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <span className="text-sm">Global Access</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                  <span className="text-sm">Event Created</span>
                  <span className="text-green-400 font-semibold">✓ Confirmed</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                  <span className="text-sm">Ticket Purchased</span>
                  <span className="text-green-400 font-semibold">✓ NFT Minted</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                  <span className="text-sm">Entry Verified</span>
                  <span className="text-blue-400 font-semibold">📱 QR Scanned</span>
                </div>
              </div>
            </div>
            
            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-full opacity-20 animate-pulse"></div>
            <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-green-400 rounded-full opacity-20 animate-pulse delay-1000"></div>
          </div>
        </div>
      </div>
    </div>
  );
};