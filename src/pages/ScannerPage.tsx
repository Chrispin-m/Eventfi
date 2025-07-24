import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, CheckCircle, XCircle, StopCircle, Users, Key } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';
import QrScanner from 'qr-scanner';
import Webcam from 'react-webcam';

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

  // Scanner & camera states
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('prompt');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [staffMode, setStaffMode] = useState(false);
  const [staffCode, setStaffCode] = useState('');
  const [eventId, setEventId] = useState('');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);

  // Load available video devices on mount and select back camera by default
  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');

        setAvailableDevices(videoInputs);

        // Try to select the environment (back) camera first if available
        const backCamera = videoInputs.find(d =>
          d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(backCamera?.deviceId || (videoInputs[0]?.deviceId ?? ''));

      } catch (e) {
        console.error('Failed to get video devices:', e);
      }
    }
    loadDevices();
  }, []);

  // Cleanup scanning on unmount
  useEffect(() => {
    return () => stopScanning();
  }, []);

  // Start scanning with camera permission check and open modal
  const startScanning = async () => {
    setCameraError(null);
    setCameraPermission('checking');
    try {
      // Request camera with environment facing mode to force back camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined, facingMode: 'environment' },
      });
      stream.getTracks().forEach(track => track.stop()); // just check permission

      setCameraPermission('granted');
      setIsScanning(true);
      setIsModalOpen(true);
      toast.success('Camera access granted. Starting scanner...');

      startQrScanLoop();
    } catch (error: any) {
      setIsScanning(false);
      setIsModalOpen(false);
      if (error.name === 'NotAllowedError') {
        setCameraPermission('denied');
        toast.error('Camera permission denied. Please enable camera access.');
      } else if (error.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
        toast.error('No camera found on this device.');
      } else {
        setCameraError(error.message || 'Unknown camera error.');
        toast.error(`Camera error: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Scanning loop captures frames from webcam and scans QR code
  const startQrScanLoop = () => {
    if (scanInterval.current) clearInterval(scanInterval.current);

    scanInterval.current = setInterval(async () => {
      if (!webcamRef.current || !isScanning) return;

      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) return;

      try {
        const result = await QrScanner.scanImage(screenshot, { returnDetailedScanResult: true });

        if (result?.data) {
          verifyTicket(result.data);
          stopScanning();
        }
      } catch (e: any) {
        // Ignore expected 'No QR code found' errors
        if (!e?.message?.includes('No QR code found')) {
          console.debug('QR scan error:', e.message || e);
        }
      }
    }, 300);
  };

  const stopScanning = () => {
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    setIsScanning(false);
    setIsModalOpen(false);
    toast.info('Scanner stopped');
  };

  // Switch to next available camera device
  const switchCamera = () => {
    if (availableDevices.length < 2) {
      toast.info('Only one camera available');
      return;
    }
    const currentIndex = availableDevices.findIndex(d => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % availableDevices.length;
    setSelectedDeviceId(availableDevices[nextIndex].deviceId);
    toast.info(`Switched to ${availableDevices[nextIndex].label || 'camera'}`);
  };

  // Verify ticket by sending to backend API (staffMode switches endpoint)
  const verifyTicket = async (qrData: string) => {
    if (!isConnected && !staffMode) {
      toast.error('Please connect your wallet to verify tickets');
      return;
    }
    if (staffMode && (!staffCode || !eventId)) {
      toast.error('Please enter staff code and event ID');
      return;
    }

    setVerificationResult(null);
    setIsScanning(true);

    try {
      const endpoint = staffMode ? '/api/tickets/staff-verify' : '/api/tickets/verify';
      const body = staffMode
        ? { qrData, staffCode, eventId }
        : { qrData, organizerAddress: account };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed');

      setVerificationResult(data);
      toast[data.valid ? 'success' : 'error'](data.valid ? '✅ Ticket Valid' : `❌ Invalid ticket: ${data.reason}`);
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Handle manual ticket verification
  const handleManualVerification = () => {
    if (!manualInput.trim()) {
      toast.error('Please enter ticket data');
      return;
    }
    verifyTicket(manualInput.trim());
  };

  // Mark ticket as used placeholder
  const markTicketAsUsed = (ticketId: number) => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }
    toast.info('Marking ticket as used (simulated blockchain tx)...');
    setTimeout(() => {
      toast.success('Ticket marked as used!');
      setVerificationResult(null);
    }, 2000);
  };

  // --- UI for Fullscreen Modal Scanner with scanning ray effect ---

  return (
    <>
      {/* If scanning, show fullscreen modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          <div className="relative w-full max-w-3xl mx-auto rounded-lg overflow-hidden">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                facingMode: 'environment',
              }}
              className="w-full h-auto object-cover rounded-lg"
            />

            {/* Scanning area with ray effect */}
            <div
              className="absolute top-1/2 left-1/2 w-3/4 max-w-lg h-24 -translate-x-1/2 -translate-y-1/2
                border-4 border-green-400 rounded-xl overflow-hidden"
              style={{ boxShadow: '0 0 20px 5px rgba(72, 187, 120, 0.7)' }}
            >
              <div
                className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-green-400 to-transparent
                  animate-scan-light"
                style={{ filter: 'drop-shadow(0 0 8px #4ade80)' }}
              />
            </div>

            <button
              onClick={stopScanning}
              className="absolute top-5 right-5 bg-red-600 hover:bg-red-700 text-white rounded-full p-3 shadow-lg transition-colors"
              aria-label="Close scanner"
            >
              <StopCircle size={24} />
            </button>

            <button
              onClick={switchCamera}
              className="absolute bottom-5 right-5 bg-gray-800 hover:bg-gray-900 text-white rounded-full p-3 shadow-lg transition-colors"
              aria-label="Switch camera"
              title="Switch Camera"
            >
              <Camera size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Main page content */}
      <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Ticket Scanner</h1>
        <p className="mb-6 text-gray-700 text-center max-w-xl">
          Verify and validate event tickets by scanning QR codes. Connect your wallet for organizer mode or use staff mode.
        </p>

        {!isConnected && !staffMode && (
          <div className="w-full max-w-md bg-white rounded-lg p-6 shadow-md mb-8 text-center">
            <button
              onClick={() => setStaffMode(true)}
              className="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors w-full"
            >
              Use Staff Mode
            </button>
            <p className="mt-4 text-sm text-gray-500">Or connect your wallet to verify tickets as organizer.</p>
          </div>
        )}

        {(isConnected || staffMode) && (
          <>
            {/* Staff Credentials if in staff mode */}
            {staffMode && (
              <div className="w-full max-w-xl bg-white rounded-lg p-6 shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                  <Key className="text-green-600" /> <span>Staff Credentials</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Event ID"
                    value={eventId}
                    onChange={e => setEventId(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    placeholder={`Staff Code (e.g. STAFF-${eventId || 'EVENT_ID'})`}
                    value={staffCode}
                    onChange={e => setStaffCode(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <button
                  onClick={() => setStaffMode(false)}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  ← Back to Organizer Mode
                </button>
              </div>
            )}

            {/* Start Scan Button */}
            <button
              onClick={startScanning}
              disabled={isScanning}
              className={`mb-8 px-8 py-3 rounded-lg text-white text-lg font-semibold
                ${isScanning ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isScanning ? 'Scanning...' : 'Start Scanner (Back Camera)'}
            </button>

            {/* Manual Verification */}
            <div className="w-full max-w-xl bg-white rounded-lg p-6 shadow-md">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <Upload className="text-blue-600" />
                <span>Manual Verification</span>
              </h2>
              <textarea
                rows={3}
                placeholder="Enter ticket QR data or ticket ID"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleManualVerification}
                disabled={isScanning || !manualInput.trim()}
                className={`w-full py-3 rounded-lg text-white font-semibold
                  ${isScanning || !manualInput.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isScanning ? 'Verifying...' : 'Verify Ticket'}
              </button>
            </div>

            {/* Verification Result */}
            {verificationResult && (
              <div
                className={`mt-8 w-full max-w-xl rounded-lg p-6 shadow-md
                  ${verificationResult.valid ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}
              >
                <div className="flex items-center mb-4 space-x-3">
                  {verificationResult.valid ? (
                    <CheckCircle className="text-green-600" size={28} />
                  ) : (
                    <XCircle className="text-red-600" size={28} />
                  )}
                  <h3 className={`text-lg font-semibold ${verificationResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                    {verificationResult.valid ? '✅ Valid Ticket' : '❌ Invalid Ticket'}
                  </h3>
                  {verificationResult.staffVerified && (
                    <span className="ml-auto bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                      Staff Verified
                    </span>
                  )}
                </div>
                <p className={`${verificationResult.valid ? 'text-green-700' : 'text-red-700'} mb-4`}>
                  {verificationResult.reason}
                </p>
                <div className="text-sm space-y-1 mb-4">
                  <div><strong>Ticket ID:</strong> {verificationResult.ticketId}</div>
                  <div><strong>Verified At:</strong> {new Date(verificationResult.timestamp).toLocaleString()}</div>
                  {staffMode && <div><strong>Event ID:</strong> {eventId}</div>}
                </div>
                {verificationResult.valid && (
                  <button
                    onClick={() => markTicketAsUsed(verificationResult.ticketId)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold"
                  >
                    Mark as Used (Entry)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Scanning animation keyframes - add to global styles or inline style */}
      <style>{`
        @keyframes scan-light {
          0% { left: -50%; opacity: 0; }
          50% { left: 100%; opacity: 0.7; }
          100% { left: 100%; opacity: 0; }
        }
        .animate-scan-light {
          animation: scan-light 2.5s linear infinite;
        }
      `}</style>
    </>
  );
};
