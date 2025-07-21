import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, MapPin, DollarSign } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';

interface TicketTier {
  name: string;
  price: string;
  maxSupply: string;
  tokenType: 'XFI' | 'XUSD' | 'MPX';
}

interface CreateEventModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ onClose, onSuccess }) => {
  const { account, signer } = useWeb3();
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<'details' | 'tiers' | 'confirm'>('details');

  // Event details
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    feeTokenType: 'XFI' as 'XFI' | 'XUSD' | 'MPX'
  });

  // Ticket tiers
  const [tiers, setTiers] = useState<TicketTier[]>([
    { name: 'General Admission', price: '0.1', maxSupply: '100', tokenType: 'XFI' }
  ]);

  const handleEventDataChange = (field: string, value: string) => {
    setEventData(prev => ({ ...prev, [field]: value }));
  };

  const addTier = () => {
    setTiers(prev => [...prev, { 
      name: '', 
      price: '', 
      maxSupply: '', 
      tokenType: 'XFI' 
    }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      setTiers(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateTier = (index: number, field: keyof TicketTier, value: string) => {
    setTiers(prev => prev.map((tier, i) => 
      i === index ? { ...tier, [field]: value } : tier
    ));
  };

  const validateForm = () => {
    if (!eventData.title || !eventData.description || !eventData.location || 
        !eventData.startDate || !eventData.endDate) {
      toast.error('Please fill in all event details');
      return false;
    }

    if (new Date(eventData.startDate) <= new Date()) {
      toast.error('Start date must be in the future');
      return false;
    }

    if (new Date(eventData.endDate) <= new Date(eventData.startDate)) {
      toast.error('End date must be after start date');
      return false;
    }

    for (const tier of tiers) {
      if (!tier.name || !tier.price || !tier.maxSupply) {
        toast.error('Please fill in all tier details');
        return false;
      }
      
      if (parseFloat(tier.price) <= 0) {
        toast.error('Tier prices must be greater than 0');
        return false;
      }
      
      if (parseInt(tier.maxSupply) <= 0) {
        toast.error('Tier max supply must be greater than 0');
        return false;
      }
    }

    return true;
  };

  const handleCreateEvent = async () => {
    if (!validateForm() || !account || !signer) return;

    setIsCreating(true);

    try {




      // Step 1: Create the smart contract instance
      const contractAddress = process.env.VITE_EVENT_MANAGER_CONTRACT || '0x1234567890123456789012345678901234567890'; // Replace with actual deployed contract
      
      const contractABI = [
        "function createEvent(string title, string description, string location, uint256 startDate, uint256 endDate, string metadataURI, uint8 feeTokenType) payable returns (uint256)"
      ];
      
      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      
      // Step 2: Prepare transaction data
      const startTimestamp = Math.floor(new Date(eventData.startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(eventData.endDate).getTime() / 1000);
      const feeTokenTypeIndex = ['XFI', 'XUSD', 'MPX'].indexOf(eventData.feeTokenType);
      
      // Create metadata URI
      const metadata = {
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        image: 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg',
        startDate: startTimestamp,
        endDate: endTimestamp,
        organizer: account
      };
      const metadataURI = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
      
      // Step 3: Calculate listing fee
      const listingFee = ethers.parseEther('1'); // 1 token
      
      toast.info('Please confirm the transaction in your wallet...');
      
      // Step 4: Execute the smart contract transaction
      const tx = await contract.createEvent(
        eventData.title,
        eventData.description,
        eventData.location,
        startTimestamp,
        endTimestamp,
        metadataURI,
        feeTokenTypeIndex,
        { 
          value: feeTokenTypeIndex === 0 ? listingFee : 0, // Only send XFI if XFI is selected
          gasLimit: 500000 // Set reasonable gas limit
        }
      );
      
      toast.info('Transaction submitted! Waiting for confirmation...');
      
      // Step 5: Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Step 6: Extract event ID from transaction logs
      const eventCreatedLog = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed.name === 'EventCreated';
        } catch {
          return false;
        }
      });
      
      let eventId = null;
      if (eventCreatedLog) {
        const parsed = contract.interface.parseLog(eventCreatedLog);
        eventId = parsed.args.eventId.toString();
      }
      
      toast.success(`Event created successfully! ${eventId ? `Event ID: ${eventId}` : ''}`);
      
      // Step 7: Add ticket tiers if event creation was successful
      if (eventId && tiers.length > 0) {
        toast.info('Adding ticket tiers...');
        
        const tierABI = [
          "function addTicketTier(uint256 eventId, string tierName, uint256 price, uint256 maxSupply, uint8 tokenType) external"
        ];
        
        const tierContract = new ethers.Contract(contractAddress, tierABI, signer);
        
        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i];
          const tierTx = await tierContract.addTicketTier(
            eventId,
            tier.name,
            ethers.parseEther(tier.price),
            parseInt(tier.maxSupply),
            ['XFI', 'XUSD', 'MPX'].indexOf(tier.tokenType)
          );
          
          await tierTx.wait();
          toast.success(`Tier "${tier.name}" added successfully!`);
        }
      }
      
      // Success - close modal and refresh
      setTimeout(() => {
        onSuccess();
      }, 1000);
      
    } catch (error) {
      console.error('Error creating event:', error);
      
      // Handle specific error types
      if (error.code === 'ACTION_REJECTED') {
        toast.error('Transaction was rejected by user');
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        toast.error('Insufficient funds for transaction');
      } else if (error.message?.includes('user rejected')) {
        toast.error('Transaction was rejected by user');
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to create event');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const getStepContent = () => {
    switch (step) {
      case 'details':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                value={eventData.title}
                onChange={(e) => handleEventDataChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter event title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={eventData.description}
                onChange={(e) => handleEventDataChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe your event"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location *
              </label>
              <input
                type="text"
                value={eventData.location}
                onChange={(e) => handleEventDataChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event location"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={eventData.startDate}
                  onChange={(e) => handleEventDataChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={eventData.endDate}
                  onChange={(e) => handleEventDataChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Listing Fee Token
              </label>
              <p className="text-xs text-gray-500 mb-2">1 XFI listing fee required</p>
              <select
                value={eventData.feeTokenType}
                onChange={(e) => handleEventDataChange('feeTokenType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="XFI">XFI - 1 XFI</option>
                <option value="XUSD">XUSD - 1 XUSD</option>
                <option value="MPX">MPX - 1 MPX</option>
              </select>
            </div>
          </div>
        );

      case 'tiers':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Ticket Tiers</h3>
              <button
                onClick={addTier}
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Tier</span>
              </button>
            </div>

            <div className="space-y-4">
              {tiers.map((tier, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900">Tier {index + 1}</span>
                    {tiers.length > 1 && (
                      <button
                        onClick={() => removeTier(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tier Name
                      </label>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => updateTier(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="e.g., VIP, General"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Max Supply
                      </label>
                      <input
                        type="number"
                        value={tier.maxSupply}
                        onChange={(e) => updateTier(index, 'maxSupply', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Price
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={tier.price}
                        onChange={(e) => updateTier(index, 'price', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Token
                      </label>
                      <select
                        value={tier.tokenType}
                        onChange={(e) => updateTier(index, 'tokenType', e.target.value as 'XFI' | 'XUSD' | 'MPX')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="XFI">XFI</option>
                        <option value="XUSD">XUSD</option>
                        <option value="MPX">MPX</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Event Creation</h3>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Title:</span>
                <p className="text-gray-900">{eventData.title}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Location:</span>
                <p className="text-gray-900">{eventData.location}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Date:</span>
                <p className="text-gray-900">
                  {new Date(eventData.startDate).toLocaleDateString()} - {new Date(eventData.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Listing Fee:</span>
                <p className="text-gray-900">1 {eventData.feeTokenType}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Ticket Tiers:</span>
                <div className="mt-1 space-y-1">
                  {tiers.map((tier, index) => (
                    <p key={index} className="text-sm text-gray-900">
                      {tier.name}: {tier.price} {tier.tokenType} ({tier.maxSupply} tickets)
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> Creating this event will require a blockchain transaction with a 1 {eventData.feeTokenType} listing fee. 
                Make sure you have sufficient balance in your wallet.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Create New Event</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {['details', 'tiers', 'confirm'].map((stepName, index) => (
                <div key={stepName} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === stepName ? 'bg-blue-600 text-white' :
                    ['details', 'tiers', 'confirm'].indexOf(step) > index ? 'bg-green-600 text-white' :
                    'bg-gray-300 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  {index < 2 && (
                    <div className={`w-16 h-1 mx-2 ${
                      ['details', 'tiers', 'confirm'].indexOf(step) > index ? 'bg-green-600' : 'bg-gray-300'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="mb-8">
            {getStepContent()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              onClick={() => {
                if (step === 'details') onClose();
                else if (step === 'tiers') setStep('details');
                else if (step === 'confirm') setStep('tiers');
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {step === 'details' ? 'Cancel' : 'Previous'}
            </button>

            <button
              onClick={() => {
                if (step === 'details') setStep('tiers');
                else if (step === 'tiers') setStep('confirm');
                else handleCreateEvent();
              }}
              disabled={isCreating}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
            >
              {step === 'confirm' ? (isCreating ? 'Creating...' : 'Create Event') : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
