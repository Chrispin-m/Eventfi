import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  CheckCircle,
  XCircle,
  X,
  Scan,
  StopCircle,
  Key,
  Users,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomLevelRef = useRef(1);
  const videoTrackRef = useRef<MediaStreamTrack>();

  // Update zoomLevelRef on change
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
    if (videoTrackRef.current) {
      const capabilities = videoTrackRef.current.getCapabilities();
      if (capabilities.zoom) {
        const clamped = Math.min(capabilities.zoom.max!, Math.max(capabilities.zoom.min!, zoomLevel));
        videoTrackRef.current.applyConstraints({ advanced: [{ zoom: clamped }] }).catch(console.warn);
      }
    }
  }, [zoomLevel]);

  // Initialize scanning when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsScanning(true);

    // grab video track for zoom
    const setupTrack = () => {
      const video = webcamRef.current?.video;
      const stream = video?.srcObject as MediaStream;
      if (stream) {
        const [track] = stream.getVideoTracks();
        videoTrackRef.current = track;
        // set resolution & focus if supported
        track.applyConstraints({
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: 'continuous',
        }).catch(() => {});
      }
    };

    const startQRScanning = () => {
      if (scanInterval.current) clearInterval(scanInterval.current);
      scanInterval.current = setInterval(async () => {
        const screenshot = webcamRef.current?.getScreenshot();
        if (!screenshot) return;
        try {
          const result = await QrScanner.scanImage(screenshot, { returnDetailedScanResult: true });
          if (result) {
            onScan(result.data);
            onClose();
          }
        } catch (e: any) {
          if (!e.message.includes('No QR code found')) {
            console.debug('Scan error:', e);
          }
        }
      }, 300);
    };

    setupTrack();
    startQRScanning();

    return () => {
      if (scanInterval.current) clearInterval(scanInterval.current);
      setIsScanning(false);
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center', transition: 'transform 0.1s ease' }}
      >
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={1}
          videoConstraints={{
            deviceId: selectedDevice,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment',
            zoom: zoomLevel,
          }}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Scanning overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[80vw] max-w-[400px] h-[60vh] max-h-[500px] border-4 border-green-500/50 rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-laser" />
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500" />
        </div>
      </div>

      {/* Status */}
      <div className="absolute top-4 left-0 right-0 flex justify-center">
        <div className="bg-black/70 text-white px-4 py-2 rounded-full flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse" />
          <span className="font-medium">{isScanning ? 'Scanning...' : 'Initializing scanner...'}</span>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-20 right-4 bg-black/70 rounded-full p-2 flex flex-col items-center">
        <button
          onClick={() => setZoomLevel((z) => Math.min(5, z + 0.5))}
          disabled={zoomLevel >= 5}
          className="p-2 text-white hover:bg-white/20 rounded-full disabled:opacity-50"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <div className="h-32 w-2 bg-gray-600 rounded-full my-2 relative">
          <input
            type="range"
            min="1"
            max="5"
            step="0.1"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-32 -rotate-90 opacity-0 cursor-pointer"
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-full"
            style={{ height: `${((zoomLevel - 1) / 4) * 100}%` }}
          />
        </div>
        <button
          onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
          disabled={zoomLevel <= 1}
          className="p-2 text-white hover:bg-white/20 rounded-full disabled:opacity-50"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <div className="text-white text-xs mt-2 bg-black/50 px-2 py-1 rounded-full">{Math.round(zoomLevel * 100)}%</div>
      </div>

      {/* Actions */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
        <button onClick={onClose} className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 transition-colors">
          <StopCircle className="w-6 h-6" />
        </button>
        {availableDevices.length > 1 && (
          <button onClick={switchCamera} className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors">
            <Camera className="w-6 h-6" />
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes laser {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }
        .animate-laser {
          animation: laser 2s infinite linear;
          box-shadow: 0 0 15px rgba(255,0,0,0.8), 0 0 30px rgba(255,0,0,0.6);
        }
      `}</style>
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
  const [selectedDevice, setSelectedDevice] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // enumerate cameras
  useEffect(() => {
    (async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
        const back = videoInputs.find((d) =>
          /back|rear/i.test(d.label)
        );
        setSelectedDevice(back?.deviceId || videoInputs[0]?.deviceId || '');
      } catch (e) {
        console.error('Camera list failed', e);
      }
    })();
  }, []);

  const startCameraScanning = async () => {
    setCameraError(null);
    setCameraPermission('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedDevice, width: 1280, height: 720, facingMode: 'environment' },
      });
      stream.getTracks().forEach((t) => t.stop());
      setCameraPermission('granted');
      setShowCameraModal(true);
    } catch (e: any) {
      console.error('Camera init failed', e);
      if (e.name === 'NotAllowedError') {
        setCameraPermission('denied');
        toast.error('Camera permission denied');
      } else if (e.name === 'NotFoundError') {
        setCameraError('No camera available');
        toast.error('No camera found');
      } else {
        setCameraError(e.message);
        toast.error(`Camera error: ${e.message}`);
      }
    }
  };

  const stopCameraScanning = () => {
    setShowCameraModal(false);
    toast.info('Scanner stopped');
  };

  const switchCamera = () => {
    if (availableDevices.length < 2) {
      toast.info('Only one camera available');
      return;
    }
    const idx = availableDevices.findIndex((d) => d.deviceId === selectedDevice);
    const next = (idx + 1) % availableDevices.length;
    setSelectedDevice(availableDevices[next].deviceId);
    toast.info(`Switched to ${availableDevices[next].label || 'camera'}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.info('Reading QR code...');
      const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      verifyTicket(res.data);
      toast.success('QR code read');
    } catch (err) {
      console.error(err);
      toast.error('Failed to read QR');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualVerification = () => {
    if (!manualInput.trim()) {
      toast.error('Enter ticket data');
      return;
    }
    verifyTicket(manualInput.trim());
  };

  const verifyTicket = async (qrData: string) => {
    if (!isConnected && !staffMode) {
      toast.error('Connect wallet first');
      return;
    }
    if (staffMode && (!staffCode || !eventId)) {
      toast.error('Enter staff code & event ID');
      return;
    }
    setIsScanning(true);
    setVerificationResult(null);
    try {
      const endpoint = staffMode ? '/api/tickets/staff-verify' : '/api/tickets/verify';
      const body = staffMode
        ? { qrData, staffCode, eventId }
        : { qrData, organizerAddress: account };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Verification failed');
      setVerificationResult(json);
      json.valid ? toast.success('✅ Valid ticket!') : toast.error(`❌ Invalid: ${json.reason}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Verify error');
    } finally {
      setIsScanning(false);
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
        <div className="text-center max-w-md px-4">
          <Scan className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ticket Scanner</h1>
          <p className="text-gray-600 mb-8">
            Connect wallet or use staff mode.
          </p>
          <button
            onClick={() => setStaffMode(true)}
            className="w-full bg-green-600 text-white py-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-green-700"
          >
            <Users className="w-4 h-4" />
            <span>Use Staff Mode</span>
          </button>
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
            {staffMode ? 'Staff Scanner' : 'Ticket Scanner'}
          </h1>
          <p className="text-gray-600">
            {staffMode
              ? 'Verify with staff credentials'
              : 'Verify using QR codes'}
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

        {/* Staff Form */}
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder={`STAFF-${eventId || 'EVENT_ID'}`}
                />
              </div>
            </div>
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-green-800 text-sm">
                <strong>Format:</strong> STAFF-{eventId || 'EVENT_ID'}
              </p>
            </div>
          </div>
        )}

        {/* Live Camera Section */}
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
                className="text-sm bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200 disabled:opacity-50"
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
                  className={`text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 ${
                    staffMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {cameraPermission === 'denied'
                    ? 'Camera Blocked'
                    : cameraError === 'No camera available'
                    ? 'No Camera'
                    : 'Start Scanner'}
                </button>
                <p className="text-sm text-gray-500 mt-2">Point at QR code to scan</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* File & Manual */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* File */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Upload className={`w-5 h-5 ${staffMode ? 'text-green-600' : 'text-blue-600'}`} />
              <span>Upload QR Image</span>
            </h2>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 hover:bg-green-50 cursor-pointer"
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Click to upload</p>
              <p className="text-sm text-gray-500">PNG, JPG, GIF</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </div>

          {/* Manual */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Verification</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ticket Data or ID</label>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Enter QR data or ID"
                />
              </div>
              <button
                onClick={handleManualVerification}
                disabled={isScanning || !manualInput.trim()}
                className={`w-full py-2 px-4 rounded-lg text-white transition-colors disabled:opacity-50 ${
                  staffMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isScanning ? 'Verifying...' : 'Verify Ticket'}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        {verificationResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Ticket Verification</h2>
                  <button onClick={() => setVerificationResult(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Status */}
                <div
                  className={`rounded-lg p-4 mb-6 ${
                    verificationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  } border`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    {verificationResult.valid ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                    <span
                      className={`font-bold text-lg ${
                        verificationResult.valid ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {verificationResult.valid ? 'VALID TICKET' : 'INVALID TICKET'}
                    </span>
                    <div className="flex space-x-1">
                      {verificationResult.staffVerified && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Staff ✓</span>
                      )}
                      {verificationResult.blockchainVerified && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Blockchain ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      verificationResult.valid ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {verificationResult.reason}
                  </p>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold border-b pb-2 text-gray-900">Event Information</h3>
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
                        <span className="text-gray-600">Status:</span>
                        <p
                          className={`font-medium capitalize ${
                            verificationResult.currentEventStatus === 'live'
                              ? 'text-green-600'
                              : verificationResult.currentEventStatus === 'upcoming'
                              ? 'text-blue-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {verificationResult.currentEventStatus}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-semibold border-b pb-2 text-gray-900">Ticket Details</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Ticket ID:</span>
                        <p className="font-mono">#{verificationResult.ticketId}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Attendees:</span>
                        <p className="font-medium text-lg text-blue-600">
                          {verificationResult.attendeeCount} person
                          {verificationResult.attendeeCount > 1 && 's'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Paid:</span>
                        <p className="font-medium">
                          {verificationResult.totalAmountPaid} {verificationResult.tokenType}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Per Person:</span>
                        <p className="font-medium">
                          {verificationResult.pricePerPerson} {verificationResult.tokenType}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Purchase Date:</span>
                        <p className="font-medium">
                          {new Date(verificationResult.purchaseTimestamp * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Purchaser */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Purchaser Information</h3>
                  <p className="font-mono text-xs break-all">{verificationResult.purchaser}</p>
                </div>

                {/* Decision */}
                {verificationResult.valid && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm font-medium mb-3">
                      Entry for {verificationResult.attendeeCount} attendee
                      {verificationResult.attendeeCount > 1 && 's'}:
                    </p>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          toast.success(`✅ Entry approved for ${verificationResult.attendeeCount} attendee${
                            verificationResult.attendeeCount > 1 ? 's' : ''
                          }`);
                          setVerificationResult(null);
                        }}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium"
                      >
                        Allow Entry
                      </button>
                      <button
                        onClick={() => {
                          toast.warning('❌ Entry denied');
                          setVerificationResult(null);
                        }}
                        className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium"
                      >
                        Deny Entry
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t text-xs text-gray-500 text-center">
                  Verified at: {new Date(verificationResult.timestamp).toLocaleString()}
                  {staffMode && ` • Event ID: ${eventId}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scanner Status</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Scanner:</span>
              <span className={showCameraModal ? 'text-green-600' : ''}>
                {showCameraModal ? 'Active' : 'Ready'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Network:</span>
              <span className="text-blue-600 font-medium">CrossFi Testnet</span>
            </div>
            <div className="flex justify-between">
              <span>{staffMode ? 'Staff Mode' : 'Organizer'}:</span>
              <span className="font-mono text-xs">
                {staffMode ? staffCode : `${account?.slice(0, 6)}…${account?.slice(-4)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Available Cameras:</span>
              <span>{availableDevices.length}</span>
            </div>
          </div>
        </div>
      </div>

      <FullScreenScannerModal
        isOpen={showCameraModal}
        onClose={stopCameraScanning}
        onScan={verifyTicket}
        selectedDevice={selectedDevice}
        switchCamera={switchCamera}
        availableDevices={availableDevices}
      />
    </div>
  );
};
