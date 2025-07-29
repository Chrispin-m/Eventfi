import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Download, QrCode, Calendar, MapPin, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';

interface UserTicket {
  id: number;
  eventId: number;
  eventTitle: string;
  eventLocation: string;
  eventStartDate: number;
  eventEndDate: number;
  tierName: string;
  pricePerPerson: string;
  attendeeCount: number;
  totalAmountPaid: string;
  tokenType: string;
  purchaseTime: number;
  used?: boolean;        // Make optional
  valid?: boolean;       // Make optional
  qrCode?: string;       // Make optional
  status: 'upcoming' | 'live' | 'ended';
  purchaser: string;
  blockchainVerified?: boolean;
  validationReason?: string;  // Add this
}

export const MyTicketsPage: React.FC = () => {
  const { account, isConnected } = useWeb3();
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isConnected && account) {
      fetchUserTickets();
    }
  }, [isConnected, account]);

  const fetchUserTickets = async () => {
    if (!account) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/user/${encodeURIComponent(account)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setTickets([]);
          return;
        }
        throw new Error('Failed to fetch tickets');
      }
      
      const data = await response.json();
      // Add safe defaults for missing properties
      const safeTickets = (data.tickets || []).map((ticket: any) => ({
        ...ticket,
        used: ticket.used || false,
        valid: ticket.valid || false,
        qrCode: ticket.qrCode || '',
        validationReason: ticket.validationReason || ''
      }));
      setTickets(safeTickets);
      
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      toast.error('Failed to load your tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshTickets = async () => {
    setRefreshing(true);
    await fetchUserTickets();
    setRefreshing(false);
    toast.success('Tickets refreshed');
  };

  const downloadTicket = async (ticket: UserTicket) => {
    try {
      // Generate QR code if not available
      let qrCodeUrl = ticket.qrCode;
      
      if (!qrCodeUrl) {
        const response = await fetch(`/api/tickets/${ticket.id}`);
        const data = await response.json();
        qrCodeUrl = data.qrCode;
      }

      // Create a canvas to generate the ticket image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 800;
      canvas.height = 1100;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 800, 1000);
      gradient.addColorStop(0, '#3B82F6');
      gradient.addColorStop(1, '#8B5CF6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 1100);

      // White ticket area
      ctx.fillStyle = 'white';
      ctx.fillRect(50, 100, 700, 900);

      // Header
      ctx.fillStyle = '#1F2937';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('CrossFi Event Ticket', 400, 180);

      // Event details
      ctx.font = '24px Arial';
      ctx.fillText(ticket.eventTitle, 400, 230);
      
      ctx.font = '18px Arial';
      ctx.fillStyle = '#6B7280';
      ctx.fillText(ticket.tierName, 400, 260);
      ctx.fillText(ticket.eventLocation, 400, 290);
      ctx.fillText(new Date(ticket.eventStartDate * 1000).toLocaleDateString(), 400, 320);

      // Ticket details
      ctx.font = '16px Arial';
      ctx.fillText(`Ticket #${ticket.id}`, 400, 360);
      ctx.fillText(`Valid for ${ticket.attendeeCount} attendee${ticket.attendeeCount > 1 ? 's' : ''}`, 400, 380);
      ctx.fillText(`Total Paid: ${ticket.totalAmountPaid} ${ticket.tokenType}`, 400, 400);

      // QR Code
      if (qrCodeUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 275, 430, 250, 250);
          
          // Instructions
          ctx.font = '14px Arial';
          ctx.fillStyle = '#374151';
          ctx.fillText('Present this QR code at event entrance', 400, 710);
          ctx.fillText(`Multi-person ticket for ${ticket.attendeeCount} attendee${ticket.attendeeCount > 1 ? 's' : ''}`, 400, 730);
          
          // Footer
          ctx.font = '12px Arial';
          ctx.fillStyle = '#9CA3AF';
          ctx.fillText('Powered by CrossFi Chain - Blockchain Verified', 400, 880);
          ctx.fillText(`Downloaded: ${new Date().toLocaleDateString()}`, 400, 900);

          // Download the image
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = `crossfi-ticket-${ticket.id}-${ticket.attendeeCount}pax.png`;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
              toast.success('Ticket downloaded successfully!');
            }
          }, 'image/png');
        };
        qrImg.src = qrCodeUrl;
      }
    } catch (error) {
      console.error('Error downloading ticket:', error);
      toast.error('Failed to download ticket');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'text-green-600 bg-green-100 border-green-200';
      case 'upcoming': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'ended': return 'text-gray-600 bg-gray-100 border-gray-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getTokenColor = (tokenType: string) => {
    switch (tokenType) {
      case 'XFI': return 'text-blue-600 bg-blue-100';
      case 'XUSD': return 'text-green-600 bg-green-100';
      case 'MPX': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Ticket className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">My Tickets</h1>
          <p className="text-gray-600 mb-8">
            Connect your wallet to view your purchased tickets.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              You'll need to connect your wallet to access your tickets.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tickets</h1>
            <p className="text-gray-600">View and manage your purchased event tickets</p>
          </div>
          
          <button
            onClick={refreshTickets}
            disabled={refreshing}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
              </div>
              <Ticket className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => t.status === 'upcoming').length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Used</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => t.used).length}
                </p>
              </div>
              <QrCode className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Past Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => t.status === 'ended').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-4 bg-gray-300 rounded mb-4 w-3/4"></div>
                <div className="h-3 bg-gray-300 rounded mb-2"></div>
                <div className="h-3 bg-gray-300 rounded mb-4 w-1/2"></div>
                <div className="h-32 bg-gray-300 rounded mb-4"></div>
                <div className="h-8 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        ) : tickets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Ticket Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Ticket #{ticket.id}</span>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status === 'upcoming' ? 'Upcoming' : 
                       ticket.status === 'live' ? 'Live' : 'Ended'}
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg truncate">{ticket.eventTitle}</h3>
                  <p className="text-blue-100 text-sm">{ticket.tierName}</p>
                </div>

                {/* Ticket Content */}
                <div className="p-4">
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="truncate">{ticket.eventLocation}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{new Date(ticket.eventStartDate * 1000).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Price:</span>
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">{ticket.totalAmountPaid}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTokenColor(ticket.tokenType)}`}>
                          {ticket.tokenType}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Attendees:</span>
                      <span className="font-medium">{ticket.attendeeCount} person{ticket.attendeeCount > 1 ? 's' : ''}</span>
                    </div>
                    {ticket.attendeeCount > 1 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Per person:</span>
                        <span className="text-gray-500">{ticket.pricePerPerson} {ticket.tokenType}</span>
                      </div>
                    )}
                  </div>

                  {/* QR Code Preview */}
                  {ticket.qrCode && (
                    <div className="mb-4 text-center">
                      <img
                        src={ticket.qrCode}
                        alt="Ticket QR Code"
                        className="w-24 h-24 mx-auto border border-gray-200 rounded"
                      />
                      <p className="text-xs text-gray-500 mt-1">Entry QR Code</p>
                    </div>
                  )}

                  {/* Status Indicators */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {ticket.used && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                          Used
                        </span>
                      )}
                      {ticket.valid && !ticket.used && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Valid
                        </span>
                      )}
                      {!ticket.valid && ticket.validationReason && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          {ticket.validationReason}
                        </span>
                      )}
                      {ticket.blockchainVerified && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Blockchain ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => downloadTicket(ticket)}
                      className="flex-1 flex items-center justify-center space-x-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                    
                    <Link
                      to={`/ticket/${ticket.id}`}
                      className="flex-1 flex items-center justify-center space-x-1 border border-gray-300 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Ticket className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No tickets yet</h3>
            <p className="text-gray-600 mb-6">
              You haven't purchased any tickets yet. Browse events to get started.
            </p>
            <Link
              to="/"
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Browse Events</span>
            </Link>
          </div>
        )}

        {/* Account Info */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Wallet Address</p>
              <p className="font-mono text-sm bg-gray-50 p-2 rounded border">{account}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Network</p>
              <p className="text-sm">CrossFi Testnet</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Verification</p>
              <p className="text-sm text-green-600">✓ Blockchain Verified Tickets</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
