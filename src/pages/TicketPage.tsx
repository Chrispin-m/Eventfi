import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Share2, CheckCircle, AlertCircle, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import { useWeb3 } from '../context/Web3Context';

interface Ticket {
  id: number;
  eventTitle: string;
  eventLocation: string;
  eventStartDate: number;
  qrCode?: string;
  valid?: boolean;
  validationReason?: string;
  blockchainVerified?: boolean;
  purchaserVerified?: boolean;
  signatureValid?: boolean;
  status: 'upcoming' | 'live' | 'ended';
  purchaser?: string;
}

export const TicketPage: React.FC = () => {
  const { account, signer, connectWallet } = useWeb3();
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signatureRequested, setSignatureRequested] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTicket(id);
    }
  }, [id, account]);

  const fetchTicket = async (ticketId: string, retry = false) => {
    try {
      setLoading(true);
      setAuthError(null);
      
      // Prepare authentication
      const authParams: Record<string, string> = {};
      
      if (account && signer && !retry) {
        setSignatureRequested(true);
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Accessing ticket ${ticketId} at ${timestamp}`;
        
        try {
          const signature = await signer.signMessage(message);
          authParams.address = account;
          authParams.signature = signature;
          authParams.message = message;
          setSignatureRequested(false);
        } catch (error) {
          setSignatureRequested(false);
          if (error.code === 4001) {
            toast.error('Signature rejected by user');
          } else {
            toast.error('Failed to sign message');
          }
          setLoading(false);
          return;
        }
      }

      // URL with auth params
      const params = new URLSearchParams(authParams);
      const response = await fetch(`/api/tickets/${ticketId}?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          setAuthError(errorData.error || 'Invalid request parameters');
        } else if (response.status === 401) {
          setAuthError('Please connect your wallet and access this ticket through "My Tickets"');
        } else if (response.status === 403) {
          if (errorData.detail === 'Signer address does not match provided address') {
            setAuthError('Wallet signature verification failed');
          } else if (errorData.detail === 'Message references different ticket') {
            setAuthError('Ticket ID mismatch in signature');
          } else if (errorData.detail === 'Connected wallet does not own this ticket') {
            setAuthError('This wallet does not own the ticket');
          } else {
            setAuthError('Access to this ticket is restricted');
          }
        } else if (response.status === 404) {
          setAuthError('Ticket not found');
        } else {
          setAuthError('Failed to load ticket details');
        }
        
        setTicket(null);
        return;
      }

      const data = await response.json();
      const safeTicket: Ticket = {
        ...data,
        valid: data.valid ?? false,
        validationReason: data.validationReason || '',
        qrCode: data.qrCode || '',
        blockchainVerified: data.blockchainVerified || false,
        purchaserVerified: data.purchaserVerified || false,
        signatureValid: data.signatureValid || false,
        status: data.status || 'upcoming'
      };
      setTicket(safeTicket);
      
    } catch (error) {
      console.error('Error fetching ticket:', error);
      setAuthError('Network error while loading ticket');
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAndRetry = async () => {
    try {
      await connectWallet();
      fetchTicket(id!, true);
    } catch (error) {
      toast.error('Failed to connect wallet');
    }
  };

  const downloadQRCode = () => {
    if (ticket?.qrCode) {
      const link = document.createElement('a');
      link.download = `ticket-${id}-qr.png`;
      link.href = ticket.qrCode;
      link.click();
    }
  };

  const shareTicket = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CrossFi Ticket #${id}`,
          text: 'My event ticket on CrossFi Chain',
          url: url,
        });
      } catch (error) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Ticket link copied to clipboard!');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          {signatureRequested ? (
            <>
              <div className="animate-pulse bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                <Wallet className="w-8 h-8 text-blue-600 mx-auto" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Waiting for Signature</h1>
              <p className="text-gray-600 max-w-md mx-auto">
                Please check your wallet to sign the authentication message
              </p>
            </>
          ) : (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          )}
        </div>
      </div>
    );
  }

  // Ticket not found or auth error state
  if (!ticket || authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-lg px-4">
          <div className="mx-auto mb-6">
            <div className="bg-red-100 rounded-full p-4 w-16 h-16 inline-flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {authError || 'Ticket Not Found'}
          </h1>
          
          <p className="text-gray-600 mb-6">
            {authError?.includes('connect') 
              ? 'You need to connect the wallet that purchased this ticket to view it.'
              : 'The ticket you requested could not be loaded.'}
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={handleConnectAndRetry}
              className="inline-flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
            
            <Link
              to="/my-tickets"
              className="inline-flex items-center justify-center space-x-2 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go to My Tickets</span>
            </Link>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 rounded-lg text-left text-sm">
            <h3 className="font-medium text-blue-800 mb-2">Access Instructions:</h3>
            <ul className="space-y-1 text-blue-700">
              <li>• Connect the wallet used to purchase the ticket</li>
              <li>• Access tickets through "My Tickets" in your profile</li>
              <li>• Sign the authentication message when prompted</li>
              <li>• Ensure your wallet is connected to CrossFi Chain</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/my-tickets"
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>My Tickets</span>
            </Link>
            
            <button
              onClick={shareTicket}
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Ticket Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">{ticket.eventTitle}</h1>
                <p className="text-blue-100">Ticket #{id}</p>
              </div>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                ticket.valid 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {ticket.valid ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Valid</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span>Invalid</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="p-8 text-center">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Entry QR Code</h2>
              <p className="text-sm text-gray-600">Present this code at the event entrance</p>
            </div>

            {ticket.qrCode ? (
              <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
                <img
                  src={ticket.qrCode}
                  alt="Ticket QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>
            ) : (
              <div className="w-48 h-48 mx-auto bg-gray-100 border-2 border-gray-200 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">QR Code not available</p>
              </div>
            )}

            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={downloadQRCode}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download QR</span>
              </button>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="px-8 pb-8 space-y-6">
            {/* Event Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Event Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{ticket.eventLocation}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">
                    {new Date(ticket.eventStartDate * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium capitalize">{ticket.status}</span>
                </div>
              </div>
            </div>

            {/* Ticket Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Ticket Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Validity:</span>
                  <span className={ticket.valid ? 'text-green-600' : 'text-red-600'}>
                    {ticket.validationReason || (ticket.valid ? 'Valid ticket' : 'Invalid ticket')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ticket ID:</span>
                  <span className="font-mono">{id}</span>
                </div>
                {ticket.blockchainVerified && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Verification:</span>
                    <span className="text-green-600">Blockchain Verified ✓</span>
                  </div>
                )}
                {ticket.purchaserVerified && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ownership:</span>
                    <span className="text-green-600">Wallet Verified ✓</span>
                  </div>
                )}
                {ticket.signatureValid && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Signature:</span>
                    <span className="text-green-600">Valid ✓</span>
                  </div>
                )}
              </div>
            </div>

            {/* Wallet Info */}
            {account && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Connected Wallet</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono truncate max-w-[60%]">
                    {account}
                  </span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    Connected
                  </span>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Instructions</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Present this QR code at the event entrance</li>
                <li>• Keep your ticket secure and don't share screenshots</li>
                <li>• Arrive early to avoid queues</li>
                <li>• Contact support if you have any issues</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
          <p className="text-gray-600 text-sm mb-4">
            If you're having trouble with your ticket or need support, please contact the event organizer 
            or our support team.
          </p>
          <div className="flex space-x-4">
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Contact Support
            </button>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Report Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
