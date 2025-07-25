import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, User, Ticket, ArrowLeft, Share2 } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { TicketTierCard } from '../components/TicketTierCard';
import { PurchaseModal } from '../components/PurchaseModal';
import { toast } from 'react-toastify';

interface TicketTier {
  id: number;
  name: string;
  price: string;
  maxSupply: number;
  currentSupply: number;
  tokenType: string;
  active: boolean;
  available: number;
}

interface Event {
  id: number;
  title: string;
  description: string;
  location: string;
  startDate: number;
  endDate: number;
  organizer: string;
  metadataURI: string;
  active: boolean;
  status: string;
  tiers: TicketTier[];
}

export const EventPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isConnected } = useWeb3();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEvent(id);
    }
  }, [id]);

  const fetchEvent = async (eventId: string) => {
    try {
      setLoading(true);
      
      console.log('Fetching event with ID:', eventId);
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error('API Error:', response.status, response.statusText);
        if (response.status === 404) {
          throw new Error('Event not found');
        }
        throw new Error(`Failed to fetch event: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 200));
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      console.log('Event data received:', data);
      setEvent(data);
      
    } catch (error) {
      console.error('Error fetching event:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load event details';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseClick = (tier: TicketTier) => {
    if (!isConnected) {
      toast.error('Please connect your wallet to purchase tickets');
      return;
    }
    
    if (tier.available <= 0) {
      toast.error('This tier is sold out');
      return;
    }

    console.log('Purchasing tier:', tier);
    setSelectedTier(tier);
    setShowPurchaseModal(true);
  };

  const handlePurchaseComplete = () => {
    setShowPurchaseModal(false);
    setSelectedTier(null);
    // Refresh event data to update availability
    if (id) {
      fetchEvent(id);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'text-green-600 bg-green-100 border-green-200';
      case 'upcoming': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'ended': return 'text-gray-600 bg-gray-100 border-gray-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const shareEvent = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title,
          text: event?.description,
          url: url,
        });
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(url);
      toast.success('Event link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-4 w-1/3"></div>
            <div className="h-64 bg-gray-300 rounded-lg mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-300 rounded w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Ticket className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
          <p className="text-gray-600 mb-6">The event you're looking for doesn't exist or has been removed.</p>
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Events</span>
            </Link>
            
            <button
              onClick={shareEvent}
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Event Header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="relative h-64 bg-gradient-to-br from-blue-500 to-purple-600">
            <img
              src="https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg"
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-40"></div>
            
            {/* Status Badge */}
            <div className={`absolute top-6 left-6 px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(event.status)}`}>
              {event.status === 'live' ? 'Live Now' : 
               event.status === 'upcoming' ? 'Upcoming' : 'Ended'}
            </div>

            <div className="absolute bottom-6 left-6 right-6">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{event.title}</h1>
              <p className="text-blue-100 text-lg">{event.description}</p>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium">{formatDate(event.startDate)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">End Date</p>
                  <p className="font-medium">{formatDate(event.endDate)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">{event.location}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Organized by</p>
                  <p className="font-medium font-mono text-sm">
                    {event.organizer.slice(0, 6)}...{event.organizer.slice(-4)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Tiers */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Ticket className="w-6 h-6 text-blue-600" />
            <span>Available Tickets</span>
          </h2>

          {event.tiers && event.tiers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {event.tiers.map((tier) => (
                <TicketTierCard
                  key={tier.id}
                  tier={tier}
                  onPurchase={() => handlePurchaseClick(tier)}
                  disabled={!isConnected || tier.available <= 0 || event.status !== 'upcoming'}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No tickets available for this event yet.</p>
            </div>
          )}

          {!isConnected && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-center">
                <strong>Connect your wallet</strong> to purchase tickets
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && selectedTier && event && (
        <PurchaseModal
          event={event}
          tier={selectedTier}
          onClose={() => setShowPurchaseModal(false)}
          onComplete={handlePurchaseComplete}
        />
      )}
    </div>
  );
};
