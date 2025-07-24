import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, CheckCircle, XCircle, Scan, StopCircle, Key, Users, AlertTriangle } from 'lucide-react';
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
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('prompt');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [staffMode, setStaffMode] = useState(false);
  const [staffCode, setStaffCode] = useState('');
  const [eventId, setEventId] = useState('');
  const [availableCameras, setAvailableCameras] = useState<QrScanner.Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('environment');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCameraScanning();
    };
  }, []);

  const listAvailableCameras = async () => {
    try {
      const cameras = await QrScanner.listCameras(true);
      setAvailableCameras(cameras);
    } catch (error) {
      console.error('Error listing cameras:', error);
    }
  };

  const handleCameraStart = async () => {
    if (cameraPermission === 'denied') {
      toast.error('Camera access denied. Please enable camera permissions in browser settings.');
      return;
    }

    setCameraError(null);
    setIsCameraActive(true);
    setCameraPermission('checking');

    try {
      // Check if video element is available
      if (!videoRef.current) {
        throw new Error("Video element not available");
      }

      // Request camera access directly
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: selectedCamera === 'environment' ? 'environment' : 'user'
        } 
      });
      
      // Stop the stream immediately - we just needed it for permission
      stream.getTracks().forEach(track => track.stop());
      
      setCameraPermission('granted');
      await listAvailableCameras();
      
      // Create QR scanner
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => verifyTicket(result.data),
        {
          preferredCamera: selectedCamera,
          maxScansPerSecond: 5,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          calculateScanRegion: (video) => {
            const size = Math.min(video.videoWidth, video.videoHeight) * 0.7;
            return {
              x: (video.videoWidth - size) / 2,
              y: (video.videoHeight - size) / 2,
              width: size,
              height: size,
            };
          },
          onDecodeError: (error) => {
            if (!error?.message?.includes('No QR code found')) {
              console.debug('Scan error:', error);
            }
          }
        }
      );

      await qrScannerRef.current.start();
      toast.success('Scanner active - point at QR code');
      
    } catch (error) {
      console.error('Camera initialization failed:', error);
      setIsCameraActive(false);
      
      if (error.name === 'NotAllowedError') {
        setCameraPermission('denied');
        toast.error('Camera permission denied. Please enable camera access.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera available on this device.');
        setCameraError('No camera available');
      } else {
        const errorMsg = error.message || 'Please try again';
        toast.error(`Camera error: ${errorMsg}`);
        setCameraError(errorMsg);
      }
    }
  };

  const stopCameraScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsCameraActive(false);
    toast.info('Scanner stopped');
  };

  const switchCamera = async () => {
    if (availableCameras.length <= 1) {
      toast.info('Only one camera available');
      return;
    }
    
    stopCameraScanning();
    setSelectedCamera(prev => prev === 'environment' ? 'user' : 'environment');
    
    // Restart with new camera
    setTimeout(handleCameraStart, 300);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      toast.info('Reading QR code from image...');
      
      const result = await QrScanner.scanImage(file, { 
        returnDetailedScanResult: true 
      });
      
      verifyTicket(result.data);
      toast.success('QR code scanned successfully');
      
    } catch (error) {
      console.error('Error reading QR code:', error);
      toast.error('Could not read QR code. Ensure image contains a clear QR code.');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
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
          toast.success('✅ Valid ticket verified!');
        } else {
          toast.error(`❌ Invalid ticket: ${result.reason}`);
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

  const getCameraStatusIcon = () => {
    switch (cameraPermission) {
      case 'granted':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'denied':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'checking':
        return <Scan className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getCameraStatusText = () => {
    switch (cameraPermission) {
      case 'granted':
        return 'Camera Access Granted';
      case 'denied':
        return 'Camera Access Denied';
      case 'checking':
        return 'Checking Camera...';
      default:
        return 'Camera Permission Required';
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
              {/* Live Camera Scanner */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    <Camera className="w-5 h-5 text-green-600" />
                    <span>Live Camera Scan</span>
                  </h2>
                  
                  {availableCameras.length > 1 && (
                    <button
                      onClick={switchCamera}
                      disabled={isCameraActive}
                      className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Switch Camera
                    </button>
                  )}
                </div>
                
                <div className="text-center">
                  {!isCameraActive ? (
                    <div className="bg-gray-100 rounded-lg p-8">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <button
                        onClick={handleCameraStart}
                        disabled={cameraPermission === 'denied' || cameraError === 'No camera available'}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cameraPermission === 'denied' 
                          ? 'Camera Blocked' 
                          : cameraError === 'No camera available'
                            ? 'No Camera Found'
                            : 'Start Scanner'}
                      </button>
                      <p className="text-sm text-gray-500 mt-2">
                        Point your camera at a QR code to scan
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative mx-auto max-w-md">
                        <video
                          ref={videoRef}
                          className="w-full rounded-lg border-2 border-green-500 bg-black aspect-video"
                          playsInline
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="border-4 border-green-500 border-dashed rounded-xl animate-pulse w-[70%] h-[70%]" />
                        </div>
                      </div>
                      <div className="mt-4 space-x-3">
                        <button
                          onClick={stopCameraScanning}
                          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <StopCircle className="w-4 h-4 inline mr-2" />
                          Stop Scanner
                        </button>
                        {availableCameras.length > 1 && (
                          <button
                            onClick={switchCamera}
                            className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            Switch Camera
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-green-600 mt-2 font-medium">
                        📱 Point camera at QR code to scan automatically
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload and Manual Input */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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
                            toast.success('✅ Entry approved - ticket holder may enter');
                            setVerificationResult(null);
                          }}
                          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Allow Entry
                        </button>
                        <button
                          onClick={() => {
                            toast.warning('❌ Entry denied by staff');
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

        {/* Live Camera Scanner */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <span>Live Camera Scan</span>
            </h2>
            
            {availableCameras.length > 1 && (
              <button
                onClick={switchCamera}
                disabled={isCameraActive}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Switch Camera ({selectedCamera === 'environment' ? 'Back' : 'Front'})
              </button>
            )}
          </div>
          
          <div className="text-center">
            {!isCameraActive ? (
              <div className="bg-gray-100 rounded-lg p-8">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <button
                  onClick={handleCameraStart}
                  disabled={cameraPermission === 'denied' || cameraError === 'No camera available'}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cameraPermission === 'denied' 
                    ? 'Camera Blocked' 
                    : cameraError === 'No camera available'
                      ? 'No Camera Found'
                      : 'Start Scanner'}
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  Point your camera at a QR code to scan
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="relative mx-auto max-w-md">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg border-2 border-blue-500 bg-black aspect-video"
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-4 border-blue-500 border-dashed rounded-xl animate-pulse w-[70%] h-[70%]" />
                  </div>
                </div>
                <div className="mt-4 space-x-3">
                  <button
                    onClick={stopCameraScanning}
                    className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <StopCircle className="w-4 h-4 inline mr-2" />
                    Stop Scanner
                  </button>
                  {availableCameras.length > 1 && (
                    <button
                      onClick={switchCamera}
                      className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Switch Camera
                    </button>
                  )}
                </div>
                <p className="text-sm text-blue-600 mt-2 font-medium">
                  📱 Point camera at QR code to scan automatically
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Scanner Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
        </div>

        {/* Scanner Status */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scanner Status</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Scanner:</span>
              <span className={isCameraActive ? "text-green-600 font-medium" : "text-gray-600"}>
                {isCameraActive ? 'Active' : 'Ready'}
              </span>
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
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Available Cameras:</span>
              <span className="text-sm">{availableCameras.length}</span>
            </div>
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
                  {verificationResult.valid ? '✅ Valid Ticket' : '❌ Invalid Ticket'}
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
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Use</h2>
          
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                1
              </div>
              <p><strong>Live Camera:</strong> Click "Start Scanner" and point at QR codes for instant scanning</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                2
              </div>
              <p><strong>Upload Image:</strong> Upload a QR code image or enter ticket data manually</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                3
              </div>
              <p><strong>Verification:</strong> The system will verify the ticket against the blockchain</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                4
              </div>
              <p><strong>Entry:</strong> For valid tickets, click "Mark as Used" to allow entry</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
