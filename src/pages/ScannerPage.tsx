import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle, XCircle, Scan, StopCircle, Key, Users } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';
import QrScanner from 'qr-scanner';

interface VerificationResult {
  ticketId: number;
  valid: boolean;
  reason: string;
  qrData: string;
  timestamp: string;
  staffVerified?: boolean;
}

export const ScannerPage: React.FC = () => {
  const { account, isConnected } = useWeb3();
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [staffMode, setStaffMode] = useState(false);
  const [staffCode, setStaffCode] = useState('');
  const [eventId, setEventId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  const startCameraScanning = async () => {
    if (!videoRef.current) return;

    try {
      setIsCameraActive(true);
      
      // Check if QR scanner is supported
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        toast.error('No camera found on this device');
        setIsCameraActive(false);
        return;
      }

      // Create QR scanner instance
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          console.log('QR Code detected:', result.data);
          verifyTicket(result.data);
          stopCameraScanning();
        },
        {
          onDecodeError: (error) => {
            // Silently handle decode errors - they're normal when no QR code is visible
            console.log('Decode error (normal):', error);
          },
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment', // Use back camera on mobile
        }
      );

      await qrScannerRef.current.start();
      toast.success('Camera started - point at QR code to scan');
    } catch (error) {
      console.error('Error starting camera:', error);
      toast.error('Failed to start camera. Please check permissions.');
      setIsCameraActive(false);
    }
  };

  const stopCameraScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Cleanup on component unmount
  React.useEffect(() => {
    return () => {
      stopCameraScanning();
    };
  }, []);
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Use QR scanner to read from uploaded file
    QrScanner.scanImage(file, { returnDetailedScanResult: true })
      .then(result => {
        console.log('QR Code from file:', result.data);
        verifyTicket(result.data);
        toast.success('QR code read from image successfully');
      })
      .catch(error => {
        console.error('Error reading QR code from file:', error);
        toast.error('Could not read QR code from image. Please try again.');
      });
  };

  const handleManualVerification = () => {
    if (!manualInput.trim()) {
      toast.error('Please enter ticket data');
      return;
    }
    
    verifyTicket(manualInput);
  };

  const verifyTicket = async (qrData: string) => {
    if (!isConnected && !staffMode) {
      toast.error('Please connect your wallet to verify tickets');
      return;
    }

    if (staffMode && (!staffCode || !eventId)) {
      toast.error('Please enter staff code and event ID');
      return;
    }
    setIsScanning(true);
    setVerificationResult(null);

    try {
      const endpoint = staffMode ? '/api/tickets/staff-verify' : '/api/tickets/verify';
      const body = staffMode ? {
        qrData,
        staffCode,
        eventId
      } : {
        qrData,
        organizerAddress: account
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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

  if (!isConnected && !staffMode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Scan className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ticket Scanner</h1>
          <p className="text-gray-600 mb-8">
            Connect your wallet to verify and validate event tickets, or use staff mode.
          </p>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                Event organizers can connect their wallet to access full scanner features.
              </p>
            </div>
            <button
              onClick={() => setStaffMode(true)}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Use Staff Mode</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (staffMode && !isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Users className="w-8 h-8 text-green-600" />
              <h1 className="text-3xl font-bold text-gray-900">Staff Scanner</h1>
            </div>
            <p className="text-gray-600">Verify tickets using your staff credentials</p>
            <button
              onClick={() => setStaffMode(false)}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
            >
              ← Back to organizer mode
            </button>
          </div>

          {/* Staff Credentials */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Key className="w-5 h-5 text-green-600" />
              <span>Staff Credentials</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event ID
                </label>
                <input
                  type="text"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter event ID"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff Code
                </label>
                <input
                  type="text"
                  value={staffCode}
                  onChange={(e) => setStaffCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="STAFF-{eventId}"
                />
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                <strong>Staff Code Format:</strong> STAFF-{eventId || 'EVENT_ID'}
              </p>
            </div>
          </div>

          {/* Continue with scanner if credentials provided */}
          {staffCode && eventId && (
            <>
              {/* Scanner Interface - same as organizer mode */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* File Upload */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Upload className="w-5 h-5 text-green-600" />
                    <span>Upload QR Code Image</span>
                  </h2>
                  
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 hover:bg-green-50 transition-colors cursor-pointer"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter ticket QR data or ticket ID"
                      />
                    </div>
                    
                    <button
                      onClick={handleManualVerification}
                      disabled={isScanning || !manualInput.trim()}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isScanning ? 'Verifying...' : 'Verify Ticket'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Camera */}
              <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-green-600" />
                  <span>Live Camera Scan</span>
                </h2>
                
                <div className="text-center">
                  {!isCameraActive ? (
                    <div className="bg-gray-100 rounded-lg p-8">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <button
                        onClick={startCameraScanning}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Start Camera
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <video
                        ref={videoRef}
                        className="w-full max-w-md mx-auto rounded-lg"
                        playsInline
                        muted
                      />
                      <button
                        onClick={stopCameraScanning}
                        className="mt-4 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Stop Camera
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Result */}
              {verificationResult && (
                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
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
                      {verificationResult.staffVerified && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Staff Verified
                        </span>
                      )}
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
                    <div className="flex justify-between">
                      <span className="text-gray-600">Event ID:</span>
                      <span>{eventId}</span>
                    </div>
                  </div>

                  {verificationResult.valid && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-800 text-sm font-medium mb-2">Entry Decision:</p>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            toast.success('Entry approved - ticket holder may enter');
                            setVerificationResult(null);
                          }}
                          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Allow Entry
                        </button>
                        <button
                          onClick={() => {
                            toast.warning('Entry denied by staff');
                            setVerificationResult(null);
                          }}
                          className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Deny Entry
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
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
              
              <div className="text-center">
                {!isCameraActive ? (
                  <div className="bg-gray-100 rounded-lg p-8">
                    <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <button
                      onClick={startCameraScanning}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Camera
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      className="w-full max-w-md mx-auto rounded-lg"
                      playsInline
                      muted
                    />
                    <button
                      onClick={stopCameraScanning}
                      className="mt-4 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Stop Camera
                    </button>
                  </div>
                )}
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