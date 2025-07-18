import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle, XCircle, Scan } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';

interface VerificationResult {
  ticketId: number;
  valid: boolean;
  reason: string;
  qrData: string;
  timestamp: string;
}

export const ScannerPage: React.FC = () => {
  const { account, isConnected } = useWeb3();
  const [isScanning, setIsScanning] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // In a real implementation, you'd use a QR code reading library
    // For this MVP, we'll simulate QR code reading
    toast.info('QR code scanning simulation - this would read the uploaded image');
    
    // Simulate QR data
    const mockQrData = JSON.stringify({
      ticketId: Math.floor(Math.random() * 1000) + 1,
      eventId: 1,
      platform: 'CrossFi-Tickets'
    });
    
    verifyTicket(mockQrData);
  };

  const handleManualVerification = () => {
    if (!manualInput.trim()) {
      toast.error('Please enter ticket data');
      return;
    }
    
    verifyTicket(manualInput);
  };

  const verifyTicket = async (qrData: string) => {
    if (!isConnected) {
      toast.error('Please connect your wallet to verify tickets');
      return;
    }

    setIsScanning(true);
    setVerificationResult(null);

    try {
      const response = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData,
          organizerAddress: account
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setVerificationResult(result);
        
        if (result.valid) {
          toast.success('Valid ticket verified!');
        } else {
          toast.error(`Invalid ticket: ${result.reason}`);
        }
      } else {
        throw new Error(result.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Error verifying ticket:', error);
      toast.error(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setIsScanning(false);
    }
  };

  const markTicketAsUsed = async (ticketId: number) => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      // In a real implementation, this would call the smart contract
      toast.info('Marking ticket as used - this would execute a blockchain transaction');
      
      // Simulate successful marking
      setTimeout(() => {
        toast.success('Ticket marked as used successfully!');
        setVerificationResult(null);
      }, 2000);
    } catch (error) {
      console.error('Error marking ticket as used:', error);
      toast.error('Failed to mark ticket as used');
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Scan className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ticket Scanner</h1>
          <p className="text-gray-600 mb-8">
            Connect your wallet to verify and validate event tickets.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              Only event organizers can access the ticket scanner.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ticket Scanner</h1>
          <p className="text-gray-600">Verify and validate event tickets using QR codes</p>
        </div>

        {/* Scanner Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Scanning Methods */}
          <div className="space-y-6">
            {/* File Upload */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <span>Upload QR Code Image</span>
              </h2>
              
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Click to upload QR code image</p>
                <p className="text-sm text-gray-500">Supports PNG, JPG, GIF</p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Manual Input */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Verification</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ticket Data or ID
                  </label>
                  <textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter ticket QR data or ticket ID"
                  />
                </div>
                
                <button
                  onClick={handleManualVerification}
                  disabled={isScanning || !manualInput.trim()}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScanning ? 'Verifying...' : 'Verify Ticket'}
                </button>
              </div>
            </div>

            {/* Live Camera */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <span>Live Camera Scan</span>
              </h2>
              
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Camera scanning coming soon</p>
                <p className="text-sm text-gray-500">
                  This feature will allow real-time QR code scanning using your device's camera.
                </p>
              </div>
            </div>
          </div>

          {/* Verification Results */}
          <div className="space-y-6">
            {/* Scanner Status */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Scanner Status</h2>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Scanner:</span>
                  <span className="text-green-600 font-medium">Ready</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Network:</span>
                  <span className="text-blue-600 font-medium">CrossFi Testnet</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Organizer:</span>
                  <span className="font-mono text-xs">
                    {account?.slice(0, 6)}...{account?.slice(-4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Verification Result */}
            {verificationResult && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification Result</h2>
                
                <div className={`rounded-lg p-4 mb-4 ${
                  verificationResult.valid 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    {verificationResult.valid ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${
                      verificationResult.valid ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {verificationResult.valid ? 'Valid Ticket' : 'Invalid Ticket'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    verificationResult.valid ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {verificationResult.reason}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ticket ID:</span>
                    <span className="font-mono">{verificationResult.ticketId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Verified At:</span>
                    <span>{new Date(verificationResult.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {verificationResult.valid && (
                  <button
                    onClick={() => markTicketAsUsed(verificationResult.ticketId)}
                    className="w-full mt-4 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Mark as Used (Entry)
                  </button>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Use</h2>
              
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <p>Upload a QR code image or enter ticket data manually</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <p>The system will verify the ticket against the blockchain</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <p>For valid tickets, click "Mark as Used" to allow entry</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};