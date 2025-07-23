import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Users, DollarSign, Settings } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { CreateEventModal } from '../components/CreateEventModal';
import { EventCard } from '../components/EventCard';
import { toast } from 'react-toastify';

interface Event {
  id: number;
  title: string;
  description: string;
  location: string;
  startDate: number;
  endDate: number;
  organizer: string;
  status: 'upcoming' | 'live' | 'ended';
  active: boolean;
}

export const OrganizerDashboard: React.FC = () => {
  const { account, isConnected } = useWeb3();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (isConnected && account) {
      fetchOrganizerEvents();
    }
  }, [isConnected, account]);

  const fetchOrganizerEvents = async () => {
    if (!account) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/organizer/events?address=${encodeURIComponent(account)}`);
      
      if (!response.ok) {
        console.error('Failed to fetch organizer events:', response.status);
        setEvents([]);
        return;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Non-JSON response from organizer events API');
        setEvents([]);
        return;
      }
      
      const data = await response.json();
      
      if (data.events && Array.isArray(data.events)) {
        setEvents(data.events);
        console.log(`Loaded ${data.events.length} events for organizer ${account}`);
      } else {
        console.warn('Invalid organizer events data structure:', data);
        setEvents([]);
      }
    } catch (error) {
      console.error('Error fetching organizer events:', error);
      setEvents([]);
      // Don't show error toast immediately, user might not have created events yet
    } finally {
      setLoading(false);
    }
  };

  const handleEventCreated = () => {
    setShowCreateModal(false);
    toast.success('Event created successfully!');
    // Refresh events after a short delay to allow blockchain confirmation
    setTimeout(() => {
      fetchOrganizerEvents();
    }, 2000);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Organizer Dashboard</h1>
          <p className="text-gray-600 mb-8">
            Connect your wallet to create and manage events on the CrossFi network.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              You'll need to connect your wallet to access organizer features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Organizer Dashboard</h1>
          <p className="text-gray-600">Create and manage your events on CrossFi Chain</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{events.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Live Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {events.filter(e => e.status === 'live').length}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900">
                  {events.filter(e => e.status === 'upcoming').length}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Past Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {events.filter(e => e.status === 'ended').length}
                </p>
              </div>
              <Settings className="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>

        {/* Create Event Button */}
        <div className="mb-8">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Event</span>
          </button>
        </div>

        {/* Events List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your Events</h2>
          </div>

          {loading ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-48 bg-gray-300 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                    <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : events.length > 0 ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No events yet</h3>
              <p className="text-gray-600 mb-6">Create your first event to get started.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Event</span>
              </button>
            </div>
          )}
        </div>

        {/* Organizer Info */}
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
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleEventCreated}
        />
      )}
    </div>
  );
};