import React, { useState } from 'react';
import { X, Ticket, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';

interface Event {
  id: number;
  title: string;
}

interface TicketTier {
  id: number;
  name: string;
  price: string;
  pricePerPerson?: string;
  tokenType: string;
}

interface PurchaseModalProps {
  event: Event;
  tier: TicketTier;
  onClose: () => void;
  onComplete: () => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  event,
  tier,
  onClose,
  onComplete
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [attendeeCount, setAttendeeCount] = useState(1);
  const { account, signer } = useWeb3();

  const pricePerPerson = tier.pricePerPerson || tier.price;
  const totalPrice = (parseFloat(pricePerPerson) * attendeeCount).toFixed(3);

  const handlePurchase = async () => {
    if (!account || !signer) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsPurchasing(true);
    setPurchaseStep('processing');

    try {
      // Step 1: Sign purchase message
      const message = `Purchase ticket for event ${event.id}, tier ${tier.id}, attendees ${attendeeCount}, buyer ${account}, timestamp ${Date.now()}`;
      toast.info('Please sign the message in your wallet...');
      const signature = await signer.signMessage(message);
      
      // Step 2: Send purchase request to backend
      const response = await fetch(`/api/events/${event.id}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: tier.id,
          attendeeCount: attendeeCount,
          buyerAddress: account,
          signature: signature,
          message: message,
          tokenType: tier.tokenType
        }),
      });

      const purchaseData = await response.json();
      
      if (!response.ok) {
        throw new Error(purchaseData.error || 'Purchase failed');
      }

      // Step 3: Execute blockchain transaction
      const contractAddress = "0xe3C53563FF4AE7c70B41f31B116c16F1f1583923";
      if (!contractAddress) {
        throw new Error('Contract address not configured');
      }

      const contractABI = [
        'function buyTicket(uint256 eventId, uint256 tierId, uint256 attendeeCount, string memory ticketMetadataURI) payable returns (uint256)'
      ];

      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      
      // Create ticket metadata
      const ticketMetadata = {
        eventId: event.id,
        tierId: tier.id,
        eventTitle: event.title,
        tierName: tier.name,
        attendeeCount: attendeeCount,
        buyer: account,
        purchaseTime: Math.floor(Date.now() / 1000),
        pricePerPerson: pricePerPerson,
        totalPrice: totalPrice,
        tokenType: tier.tokenType
      };
      
      const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(ticketMetadata)).toString('base64')}`;
      
      // Execute purchase transaction
      const totalPriceWei = ethers.utils.parseEther(totalPrice);
      toast.info('Confirm the purchase transaction in your wallet...');
      const tx = await contract.buyTicket(
        event.id,
        tier.id,
        attendeeCount,
        metadataURI,
        {
          value: tier.tokenType === 'XFI' ? totalPriceWei : 0,
          gasLimit: 1000000
        }
      );
      
      toast.info('Transaction sent, waiting for confirmation...');
      const receipt = await tx.wait();
      
      setTransactionHash(receipt.transactionHash);
      setPurchaseStep('success');
      
      toast.success('Ticket purchased successfully!');
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onComplete();
      }, 3000);

    } catch (error) {
      console.error('Purchase error:', error);
      setPurchaseStep('error');
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      if (errorMessage.includes('user rejected')) {
        toast.error('Transaction rejected by user');
      } else if (errorMessage.includes('insufficient funds')) {
        toast.error('Insufficient funds for transaction');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const viewMyTickets = () => {
    onComplete();
    // Navigate to my tickets page
    window.location.href = '/my-tickets';
  };

  const getStepContent = () => {
    switch (purchaseStep) {
      case 'confirm':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Purchase</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Event:</span>
                  <span className="font-medium">{event.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tier:</span>
                  <span className="font-medium">{tier.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Attendees:</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setAttendeeCount(Math.max(1, attendeeCount - 1))}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="font-medium w-8 text-center">{attendeeCount}</span>
                    <button
                      onClick={() => setAttendeeCount(Math.min(10, attendeeCount + 1))}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price per person:</span>
                  <span className="font-medium">{pricePerPerson} {tier.tokenType}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-900 font-semibold">Total Price:</span>
                  <span className="font-bold text-lg">{totalPrice} {tier.tokenType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Buyer:</span>
                  <span className="font-mono text-sm">{account?.slice(0, 6)}...{account?.slice(-4)}</span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Multi-Person Ticket:</strong> This ticket is valid for {attendeeCount} attendee{attendeeCount > 1 ? 's' : ''} 
                  and can be used for group entry at the event.
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
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
              >
                {isPurchasing ? 'Processing...' : 'Purchase Ticket'}
              </button>
            </div>
          </>
        );

      case 'processing':
        return (
          <div className="text-center py-8">
            <Loader className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Purchase</h3>
            <p className="text-gray-600">Please confirm the transaction in your wallet...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Purchase Successful!</h3>
            <p className="text-gray-600 mb-4">
              Your multi-person ticket NFT for {attendeeCount} attendee{attendeeCount > 1 ? 's' : ''} has been minted successfully.
            </p>
            {transactionHash && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Transaction Hash:</p>
                <p className="font-mono text-xs break-all">{transactionHash}</p>
              </div>
            )}
            <p className="text-sm text-gray-500">This window will close automatically...</p>
            <button
              onClick={viewMyTickets}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View My Tickets →
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Purchase Failed</h3>
            <p className="text-gray-600 mb-6">There was an error processing your purchase. Please try again.</p>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setPurchaseStep('confirm')}
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
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        {purchaseStep === 'confirm' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-2 mb-4">
          <Ticket className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Purchase Ticket</span>
        </div>

        {getStepContent()}
      </div>
    </div>
  );
};
