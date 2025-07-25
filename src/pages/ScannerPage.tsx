import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, CheckCircle, XCircle, Scan, StopCircle, Key, Users, AlertTriangle } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';
import QrScanner from 'qr-scanner';
import Webcam from 'react-webcam';

interface VerificationResult {
  ticketId: number;
  eventId: number;
  eventTitle: string;
  eventLocation: string;
  tierName: string;
  attendeeCount: number;
  totalAmountPaid: string;
  pricePerPerson: string;
  tokenType: string;
  purchaseTimestamp: number;
  purchaser: string;
  eventStatusAtPurchase: string;
  currentEventStatus: string;
  valid: boolean;
  reason: string;
  qrData: string;
  timestamp: string;
  staffVerified?: boolean;
  blockchainVerified?: boolean;
}

const FullScreenScannerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  selectedDevice: string;
  switchCamera: () => void;
  availableDevices: MediaDeviceInfo[];
}> = ({ isOpen, onClose, onScan, selectedDevice, switchCamera, availableDevices }) => {
  const webcamRef = useRef<Webcam>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    const startQRScanning = () => {
      if (scanInterval.current) clearInterval(scanInterval.current);
      
      scanInterval.current = setInterval(async () => {
        if (!webcamRef.current) return;
        
        try {
          const screenshot = webcamRef.current.getScreenshot();
          if (!screenshot) return;
          
          const result = await QrScanner.scanImage(screenshot, {
            returnDetailedScanResult: true,
          });
          
          if (result) {
            onScan(result.data);
            onClose();
          }
        } catch (error) {
          if (!error?.message?.includes('No QR code found')) {
            console.debug('Scan error:', error);
          }
        }
      }, 300);
    };

    setIsScanning(true);
    startQRScanning();

    return () => {
      if (scanInterval.current) {
        clearInterval(scanInterval.current);
        scanInterval.current = null;
      }
      setIsScanning(false);
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          deviceId: selectedDevice,
          facingMode: selectedDevice ? undefined : 'environment'
        }}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Scanning overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[80vw] max-w-[400px] h-[60vh] max-h-[500px] border-4 border-green-500/50 rounded-xl overflow-hidden">
          {/* Laser scanner effect */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-laser" />
          
          {/* Corner indicators */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500" />
        </div>
      </div>
      
      {/* Scanning status */}
      <div className="absolute top-4 left-0 right-0 flex justify-center">
        <div className="bg-black/70 text-white px-4 py-2 rounded-full flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse" />
          <span className="font-medium">
            {isScanning ? 'Scanning...' : 'Initializing scanner...'}
          </span>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
        <button
          onClick={onClose}
          className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 transition-colors"
        >
          <StopCircle className="w-6 h-6" />
        </button>
        
        {availableDevices.length > 1 && (
          <button
            onClick={switchCamera}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors"
          >
            <Camera className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
};

export const ScannerPage: React.FC = () => {
  const { account, isConnected } = useWeb3();
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('prompt');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [staffMode, setStaffMode] = useState(false);
  const [staffCode, setStaffCode] = useState('');
  const [eventId, setEventId] = useState('');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        
        // Prioritize back camera if available
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear')
        );
        
        setSelectedDevice(backCamera?.deviceId || videoDevices[0]?.deviceId || '');
      } catch (error) {
        console.error('Error listing cameras:', error);
      }
    };
    
    getCameras();
  }, []);

  const startCameraScanning = async () => {
    setCameraError(null);
    setCameraPermission('checking');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      stream.getTracks().forEach(track => track.stop());
      
      setCameraPermission('granted');
      setShowCameraModal(true);
    } catch (error) {
      console.error('Camera initialization failed:', error);
      
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
    setShowCameraModal(false);
    toast.info('Scanner stopped');
  };

  const switchCamera = () => {
    if (availableDevices.length <= 1) {
      toast.info('Only one camera available');
      return;
    }
    
    const currentIndex = availableDevices.findIndex(device => device.deviceId === selectedDevice);
    const nextIndex = (currentIndex + 1) % availableDevices.length;
    setSelectedDevice(availableDevices[nextIndex].deviceId);
    toast.info(`Switched to ${availableDevices[nextIndex].label || 'camera'}`);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {staffMode ? "Staff Scanner" : "Ticket Scanner"}
          </h1>
          <p className="text-gray-600">
            {staffMode ? "Verify tickets using your staff credentials" : "Verify and validate event tickets using QR codes"}
          </p>
          
          {staffMode && (
            <button
              onClick={() => setStaffMode(false)}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
            >
              ← Back to organizer mode
            </button>
          )}
        </div>

        {/* Staff Credentials Form */}
        {staffMode && (
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
        )}

        {/* Live Camera Scanner Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Camera className={`w-5 h-5 ${staffMode ? 'text-green-600' : 'text-blue-600'}`} />
              <span>Live Camera Scan</span>
            </h2>
            
            {availableDevices.length > 1 && (
              <button
                onClick={switchCamera}
                disabled={showCameraModal}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Switch Camera
              </button>
            )}
          </div>
          
          <div className="text-center">
            {!showCameraModal ? (
              <div className="bg-gray-100 rounded-lg p-8">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <button
                  onClick={startCameraScanning}
                  disabled={cameraPermission === 'denied' || cameraError === 'No camera available'}
                  className={`${staffMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
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
            ) : null}
          </div>
        </div>

        {/* File Upload and Manual Input */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* File Upload */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Upload className={`w-5 h-5 ${staffMode ? 'text-green-600' : 'text-blue-600'}`} />
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
                className={`w-full ${staffMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isScanning ? 'Verifying...' : 'Verify Ticket'}
              </button>
            </div>
          </div>
        </div>

        {/* Verification Result */}
        {verificationResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Ticket Verification</h2>
                  <button
                    onClick={() => setVerificationResult(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Verification Status */}
                <div className={`rounded-lg p-4 mb-6 ${
                  verificationResult.valid 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    {verificationResult.valid ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                    <span className={`font-bold text-lg ${
                      verificationResult.valid ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {verificationResult.valid ? 'VALID TICKET' : 'INVALID TICKET'}
                    </span>
                    <div className="flex space-x-1">
                      {verificationResult.staffVerified && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Staff ✓
                        </span>
                      )}
                      {verificationResult.blockchainVerified && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Blockchain ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm font-medium ${
                    verificationResult.valid ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {verificationResult.reason}
                  </p>
                </div>

                {/* Ticket Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">Event Information</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Event:</span>
                        <p className="font-medium">{verificationResult.eventTitle}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Location:</span>
                        <p className="font-medium">{verificationResult.eventLocation}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Tier:</span>
                        <p className="font-medium">{verificationResult.tierName}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Event Status:</span>
                        <p className={`font-medium capitalize ${
                          verificationResult.currentEventStatus === 'live' ? 'text-green-600' :
                          verificationResult.currentEventStatus === 'upcoming' ? 'text-blue-600' :
                          'text-gray-600'
                        }`}>
                          {verificationResult.currentEventStatus}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">Ticket Details</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Ticket ID:</span>
                        <p className="font-mono font-medium">#{verificationResult.ticketId}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Attendees:</span>
                        <p className="font-medium text-lg text-blue-600">
                          {verificationResult.attendeeCount} person{verificationResult.attendeeCount > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Paid:</span>
                        <p className="font-medium">{verificationResult.totalAmountPaid} {verificationResult.tokenType}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Per Person:</span>
                        <p className="font-medium">{verificationResult.pricePerPerson} {verificationResult.tokenType}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Purchase Date:</span>
                        <p className="font-medium">{new Date(verificationResult.purchaseTimestamp * 1000).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Purchaser Information */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Purchaser Information</h3>
                  <div className="text-sm">
                    <span className="text-gray-600">Wallet Address:</span>
                    <p className="font-mono text-xs break-all">{verificationResult.purchaser}</p>
                  </div>
                </div>

                {/* Entry Decision */}
                {verificationResult.valid && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm font-medium mb-3">
                      Entry Decision for {verificationResult.attendeeCount} attendee{verificationResult.attendeeCount > 1 ? 's' : ''}:
                    </p>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          toast.success(`✅ Entry approved for ${verificationResult.attendeeCount} attendee${verificationResult.attendeeCount > 1 ? 's' : ''}`);
                          setVerificationResult(null);
                        }}
                        className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        Allow Entry ({verificationResult.attendeeCount} pax)
                      </button>
                      <button
                        onClick={() => {
                          toast.warning('❌ Entry denied by staff');
                          setVerificationResult(null);
                        }}
                        className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
                      >
                        Deny Entry
                      </button>
                    </div>
                  </div>
                )}

                {/* Verification Timestamp */}
                <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
                  Verified at: {new Date(verificationResult.timestamp).toLocaleString()}
                  {staffMode && ` • Event ID: ${eventId}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scanner Status */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scanner Status</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Scanner:</span>
              <span className={showCameraModal ? "text-green-600 font-medium" : "text-gray-600"}>
                {showCameraModal ? 'Active' : 'Ready'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Network:</span>
              <span className="text-blue-600 font-medium">CrossFi Testnet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">
                {staffMode ? 'Staff Mode' : 'Organizer'}:
              </span>
              <span className="font-mono text-xs">
                {staffMode 
                  ? staffCode 
                  : `${account?.slice(0, 6)}...${account?.slice(-4)}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Available Cameras:</span>
              <span className="text-sm">{availableDevices.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Scanner Modal */}
      <FullScreenScannerModal
        isOpen={showCameraModal}
        onClose={stopCameraScanning}
        onScan={verifyTicket}
        selectedDevice={selectedDevice}
        switchCamera={switchCamera}
        availableDevices={availableDevices}
      />

      {/* Laser Scanner Animation Styles */}
      <style jsx>{`
        @keyframes laser {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }
        .animate-laser {
          animation: laser 2s infinite linear;
          box-shadow: 0 0 15px rgba(255, 0, 0, 0.8), 0 0 30px rgba(255, 0, 0, 0.6);
        }
      `}</style>
    </div>
  );
};