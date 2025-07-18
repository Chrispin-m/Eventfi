import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Share2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface Ticket {
  id: number;
  valid: boolean;
  status: string;
  qrCode: string;
  verification: {
    valid: boolean;
    reason: string;
  };
}

export const TicketPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTicket(id);
    }
  }, [id]);

  const fetchTicket = async (ticketId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/${ticketId}`);
      const data = await response.json();
      
      if (response.ok) {
        setTicket(data);
      } else {
        toast.error(data.error || 'Ticket not found');
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
      toast.error('Failed to load ticket details');
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h1>
          <p className="text-gray-600 mb-6">The ticket you're looking for doesn't exist.</p>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Events</span>
          </Link>
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
              to="/"
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Events</span>
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
                <h1 className="text-2xl font-bold mb-1">CrossFi Ticket</h1>
                <p className="text-blue-100">Ticket #{id}</p>
              </div>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                ticket.verification.valid 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {ticket.verification.valid ? (
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

          {/* Ticket Status */}
          <div className="px-8 pb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Ticket Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Validity:</span>
                  <span className={ticket.verification.valid ? 'text-green-600' : 'text-red-600'}>
                    {ticket.verification.reason}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ticket ID:</span>
                  <span className="font-mono">{id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="px-8 pb-8">
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