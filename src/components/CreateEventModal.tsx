import React, { useState } from 'react';
import { X, Calendar, MapPin, DollarSign, Plus, Trash2, Loader } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';

interface TicketTier {
  name: string;
  pricePerPerson: string;
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
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [transactionHash, setTransactionHash] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    feeTokenType: 'XFI' as 'XFI' | 'XUSD' | 'MPX'
  });

  const [tiers, setTiers] = useState<TicketTier[]>([
    {
      name: 'General Admission',
      pricePerPerson: '0.1',
      maxSupply: '100',
      tokenType: 'XFI'
    }
  ]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTierChange = (index: number, field: keyof TicketTier, value: string) => {
    setTiers(prev => prev.map((tier, i) => 
      i === index ? { ...tier, [field]: value } : tier
    ));
  };

  const addTier = () => {
    if (tiers.length >= 5) {
      toast.error('Maximum 5 tiers allowed');
      return;
    }
    
    setTiers(prev => [...prev, {
      name: `Tier ${prev.length + 1}`,
      pricePerPerson: '0.1',
      maxSupply: '50',
      tokenType: 'XFI'
    }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) {
      toast.error('At least one tier is required');
      return;
    }
    setTiers(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error('Event title is required');
      return false;
    }
    if (!formData.description.trim()) {
      toast.error('Event description is required');
      return false;
    }
    if (!formData.location.trim()) {
      toast.error('Event location is required');
      return false;
    }
    if (!formData.startDate) {
      toast.error('Start date is required');
      return false;
    }
    if (!formData.endDate) {
      toast.error('End date is required');
      return false;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    const now = new Date();

    if (startDate <= now) {
      toast.error('Start date must be in the future');
      return false;
    }
    if (endDate <= startDate) {
      toast.error('End date must be after start date');
      return false;
    }

    // Validate tiers
    for (const [index, tier] of tiers.entries()) {
      if (!tier.name.trim()) {
        toast.error(`Tier ${index + 1} name is required`);
        return false;
      }
      if (!tier.pricePerPerson || tier.pricePerPerson.trim() === '' || parseFloat(tier.pricePerPerson) <= 0) {
        toast.error(`Tier ${index + 1} price must be greater than 0`);
        return false;
      }
      if (!tier.maxSupply || tier.maxSupply.trim() === '' || parseInt(tier.maxSupply) <= 0) {
        toast.error(`Tier ${index + 1} max supply must be greater than 0`);
        return false;
      }
    }

    return true;
  };

  const handleCreateEvent = async () => {
    if (!account || !signer) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!validateForm()) return;

    setIsCreating(true);
    setStep('processing');

    try {
      // Step 1: Prepare event data
      const startTimestamp = Math.floor(new Date(formData.startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(formData.endDate).getTime() / 1000);

      // Step 2: Sign message for backend verification
      const message = `Create event: ${formData.title} - ${account} - ${Date.now()}`;
      toast.info('Please sign the message in your wallet...');
      const signature = await signer.signMessage(message);

      // Step 3: Send to backend for preparation
      const response = await fetch('/api/organizer/events/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          location: formData.location,
          startDate: startTimestamp,
          endDate: endTimestamp,
          feeTokenType: formData.feeTokenType,
          tiers: tiers.map(tier => ({
            name: tier.name.trim(),
            pricePerPerson: tier.pricePerPerson.trim(),
            maxSupply: tier.maxSupply.trim(),
            tokenType: tier.tokenType
          })),
          organizerAddress: account,
          signature: signature,
          message: message
        }),
      });

      const eventData = await response.json();
      
      if (!response.ok) {
        throw new Error(eventData.error || 'Failed to prepare event');
      }

      // Step 4: Execute blockchain transaction
      const contractAddress = eventData.contractInfo?.contractAddress || "0xe3C53563FF4AE7c70B41f31B116c16F1f1583923";
      if (!contractAddress) {
        throw new Error('Contract address not configured');
      }

      const contractABI = [
        'function createEvent(string memory title, string memory description, string memory location, uint256 startDate, uint256 endDate, string memory metadataURI, uint8 feeTokenType) payable returns (uint256)',
        'function addTicketTier(uint256 eventId, string memory tierName, uint256 pricePerPerson, uint256 maxSupply, uint8 tokenType) external'
      ];

      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      
      // Create event metadata
      const metadata = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        startDate: startTimestamp,
        endDate: endTimestamp,
        organizer: account,
        image: 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg',
        tiers: tiers
      };
      
      const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;
      
      // Execute create event transaction
      const listingFee = ethers.utils.parseEther('1'); // 1 XFI listing fee
      const tokenTypeMap = { 'XFI': 0, 'XUSD': 1, 'MPX': 2 };
      
      toast.info('Creating event on blockchain...');
      const createTx = await contract.createEvent(
        formData.title,
        formData.description,
        formData.location,
        startTimestamp,
        endTimestamp,
        metadataURI,
        tokenTypeMap[formData.feeTokenType],
        {
          value: formData.feeTokenType === 'XFI' ? listingFee : 0,
          gasLimit: 2000000
        }
      );
      
      toast.info('Waiting for event creation confirmation...');
      const createReceipt = await createTx.wait();
      
      // Extract event ID from logs
      const eventCreatedLog = createReceipt.logs.find(log => 
        log.topics[0] === ethers.utils.id('EventCreated(uint256,address,string,uint256,uint256)')
      );
      
      if (!eventCreatedLog) {
        throw new Error('Event creation failed - no event ID found');
      }
      
      const eventId = ethers.BigNumber.from(eventCreatedLog.topics[1]).toNumber();
      
      // Step 5: Add ticket tiers
      toast.info('Adding ticket tiers...');
      for (const [index, tier] of tiers.entries()) {
        const tierTx = await contract.addTicketTier(
          eventId,
          tier.name,
          ethers.utils.parseEther(tier.pricePerPerson),
          parseInt(tier.maxSupply),
          tokenTypeMap[tier.tokenType],
          { gasLimit: 500000 }
        );
        await tierTx.wait();
        toast.info(`Added tier ${index + 1}/${tiers.length}`);
      }
      
      setTransactionHash(createReceipt.transactionHash);
      setStep('success');
      
      toast.success('Event created successfully!');
      
      // Notify backend of successful creation
      try {
        await fetch('/api/organizer/events/created', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: eventId,
            transactionHash: createReceipt.transactionHash,
            organizerAddress: account
          }),
        });
      } catch (error) {
        console.warn('Failed to notify backend:', error);
      }
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onSuccess();
      }, 3000);

    } catch (error) {
      console.error('Event creation error:', error);
      setStep('error');
      const errorMessage = error instanceof Error ? error.message : 'Event creation failed';
      if (errorMessage.includes('user rejected')) {
        toast.error('Transaction rejected by user');
      } else if (errorMessage.includes('insufficient funds')) {
        toast.error('Insufficient funds for transaction');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const getStepContent = () => {
    switch (step) {
      case 'form':
        return (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Event</h2>
              
              {/* Basic Event Info */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter event title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe your event"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Event location"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Listing Fee Token
                  </label>
                  <select
                    value={formData.feeTokenType}
                    onChange={(e) => handleInputChange('feeTokenType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="XFI">XFI (1 XFI)</option>
                    <option value="XUSD">XUSD (1 XUSD)</option>
                    <option value="MPX">MPX (1 MPX)</option>
                  </select>
                </div>
              </div>

              {/* Ticket Tiers */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Ticket Tiers</h3>
                  <button
                    onClick={addTier}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Tier</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {tiers.map((tier, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Tier {index + 1}</h4>
                        {tiers.length > 1 && (
                          <button
                            onClick={() => removeTier(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Tier Name
                          </label>
                          <input
                            type="text"
                            value={tier.name}
                            onChange={(e) => handleTierChange(index, 'name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g., VIP"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Price per Person
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={tier.pricePerPerson}
                            onChange={(e) => handleTierChange(index, 'pricePerPerson', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            placeholder="0.1"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Max Supply
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={tier.maxSupply}
                            onChange={(e) => handleTierChange(index, 'maxSupply', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            placeholder="100"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Token
                          </label>
                          <select
                            value={tier.tokenType}
                            onChange={(e) => handleTierChange(index, 'tokenType', e.target.value as 'XFI' | 'XUSD' | 'MPX')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
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

              {/* Listing Fee Notice */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Listing Fee:</strong> Creating an event requires a 1 {formData.feeTokenType} listing fee. 
                  This helps maintain platform quality and prevents spam.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={isCreating}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </>
        );

      case 'processing':
        return (
          <div className="text-center py-8">
            <Loader className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Creating Event</h3>
            <p className="text-gray-600">Please confirm transactions in your wallet...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Event Created Successfully!</h3>
            <p className="text-gray-600 mb-4">
              Your event has been created and deployed to the CrossFi blockchain.
            </p>
            {transactionHash && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Transaction Hash:</p>
                <p className="font-mono text-xs break-all">{transactionHash}</p>
              </div>
            )}
            <p className="text-sm text-gray-500">This window will close automatically...</p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <X className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Creation Failed</h3>
            <p className="text-gray-600 mb-6">There was an error creating your event. Please try again.</p>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setStep('form')}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {step === 'form' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {getStepContent()}
        </div>
      </div>
    </div>
  );
};
