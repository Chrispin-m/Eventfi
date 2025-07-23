import React, { useState } from 'react';
import { ethers } from 'ethers';
import { X, Plus, Trash2 } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';

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
    feeTokenType: 'XFI' as 'XFI' | 'XUSD' | 'MPX',
  });

  // Ticket tiers
  const [tiers, setTiers] = useState<TicketTier[]>([
    { name: 'General Admission', price: '0.1', maxSupply: '100', tokenType: 'XFI' },
  ]);

  const handleEventDataChange = (field: keyof typeof eventData, value: string) =>
    setEventData(prev => ({ ...prev, [field]: value }));

  const addTier = () =>
    setTiers(prev => [...prev, { name: '', price: '', maxSupply: '', tokenType: 'XFI' }]);

  const removeTier = (i: number) => {
    if (tiers.length > 1) setTiers(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateTier = (i: number, field: keyof TicketTier, value: string) =>
    setTiers(prev =>
      prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t))
    );

  const validateForm = () => {
    const now = Date.now();
    if (
      !eventData.title ||
      !eventData.description ||
      !eventData.location ||
      !eventData.startDate ||
      !eventData.endDate
    ) {
      toast.error('Please fill in all event details');
      return false;
    }
    const startTs = new Date(eventData.startDate).getTime();
    const endTs = new Date(eventData.endDate).getTime();
    if (startTs <= now) {
      toast.error('Start date must be in the future');
      return false;
    }
    if (endTs <= startTs) {
      toast.error('End date must be after start date');
      return false;
    }
    for (const t of tiers) {
      if (!t.name || !t.price || !t.maxSupply) {
        toast.error('Please fill in all tier details');
        return false;
      }
      if (Number(t.price) <= 0) {
        toast.error('Tier prices must be greater than 0');
        return false;
      }
      if (Number(t.maxSupply) <= 0) {
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
      console.log('Preparing event data...');
      
      // Step 1: Prepare event data via backend API
      const prepareResponse = await fetch('/api/organizer/events/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          startDate: Math.floor(new Date(eventData.startDate).getTime() / 1000),
          endDate: Math.floor(new Date(eventData.endDate).getTime() / 1000),
          feeTokenType: eventData.feeTokenType,
          tiers: tiers,
          organizerAddress: account
        }),
      });

      console.log('Prepare response status:', prepareResponse.status);
      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || 'Failed to prepare event');
      }

      const preparedData = await prepareResponse.json();
      console.log('Event data prepared:', preparedData);
      const contractAddress = preparedData.contractInfo?.contractAddress || import.meta.env.VITE_EVENT_MANAGER_CONTRACT;

      if (!contractAddress) {
        throw new Error('Contract address not configured. Please set VITE_EVENT_MANAGER_CONTRACT in your environment.');
      }

      const contractABI = [
        'function createEvent(string title, string description, string location, uint256 startDate, uint256 endDate, string metadataURI, uint8 feeTokenType) payable returns (uint256)',
        'function addTicketTier(uint256 eventId, string tierName, uint256 price, uint256 maxSupply, uint8 tokenType) external',
        'event EventCreated(uint256 indexed eventId, address indexed organizer, string title, uint256 startDate, uint256 endDate)'
      ];
      
      const contract = new ethers.Contract(contractAddress, contractABI, signer);

      const startTs = Math.floor(new Date(eventData.startDate).getTime() / 1000);
      const endTs = Math.floor(new Date(eventData.endDate).getTime() / 1000);
      const feeTokenIdx = ['XFI', 'XUSD', 'MPX'].indexOf(eventData.feeTokenType);

      // Use prepared metadata URI
      const metadataURI = preparedData.eventData.metadataURI;

      const listingFee = ethers.utils.parseEther('1.0');

      console.log('Creating event on blockchain...', {
        title: eventData.title,
        startDate: startTs,
        endDate: endTs,
        feeTokenType: feeTokenIdx,
        listingFee: ethers.utils.formatEther(listingFee)
      });

      toast.info('Confirm the transaction in your wallet...');
      
      // Step 2: Create the event on blockchain
      const tx = await contract.createEvent(
        eventData.title,
        eventData.description,
        eventData.location,
        startTs,
        endTs,
        metadataURI,
        feeTokenIdx,
        {
          value: feeTokenIdx === 0 ? listingFee : 0,
          gasLimit: 2000000,
        }
      );
      
      console.log('Transaction sent:', tx.hash);
      toast.info('Waiting for confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Step 3: Extract event ID from transaction receipt
      let eventId = null;
      
      // Try to find EventCreated event in logs
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog.name === 'EventCreated') {
            eventId = parsedLog.args.eventId.toString();
            console.log('Event ID extracted:', eventId);
            break;
          }
        } catch (error) {
          // Not our event, continue
          continue;
        }
      }

      if (!eventId) {
        console.warn('Could not extract event ID from receipt, using transaction hash as reference');
        eventId = receipt.transactionHash;
      }

      toast.success(`Event created successfully! Event ID: ${eventId}`);

      // Step 4: Add ticket tiers
      if (tiers.length > 0) {
        console.log(`Adding ${tiers.length} ticket tiers...`);
        toast.info('Adding ticket tiers...');
        
        for (const [index, t] of tiers.entries()) {
          console.log(`Adding tier ${index + 1}: ${t.name}`);
          const tierTx = await contract.addTicketTier(
            eventId,
            t.name,
            ethers.utils.parseEther(t.price),
            Number(t.maxSupply),
            ['XFI', 'XUSD', 'MPX'].indexOf(t.tokenType),
            { gasLimit: 800000 }
          );
          await tierTx.wait();
          console.log(`Tier "${t.name}" added successfully`);
          toast.success(`Tier "${t.name}" added successfully`);
        }
      }

      // Step 5: Notify backend about successful creation
      try {
        console.log('Notifying backend of successful creation...');
        await fetch('/api/organizer/events/created', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: eventId,
            transactionHash: receipt.transactionHash,
            organizerAddress: account
          }),
        });
        console.log('Backend notified successfully');
      } catch (notifyError) {
        console.warn('Failed to notify backend of event creation:', notifyError);
      }

      console.log('Event creation process completed successfully');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      const msg =
        err.code === 4001
          ? 'Transaction rejected'
          : err.code === 'INSUFFICIENT_FUNDS'
          ? 'Insufficient funds'
          : err.message?.includes('user rejected')
          ? 'Transaction rejected by user'
          : err.message?.includes('execution reverted')
          ? 'Transaction failed - check contract parameters'
          : err.message || 'Failed to create event';
      toast.error(msg);
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
