import React from 'react';
import { Ticket, Clock } from 'lucide-react';

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

interface TicketTierCardProps {
  tier: TicketTier;
  onPurchase: () => void;
  disabled?: boolean;
}

export const TicketTierCard: React.FC<TicketTierCardProps> = ({ 
  tier, 
  onPurchase, 
  disabled = false 
}) => {
  const getTokenColor = (tokenType: string) => {
    switch (tokenType) {
      case 'XFI': return 'text-blue-600 bg-blue-100';
      case 'XUSD': return 'text-green-600 bg-green-100';
      case 'MPX': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAvailabilityColor = (available: number, total: number) => {
    const percentage = (available / total) * 100;
    if (percentage > 50) return 'text-green-600';
    if (percentage > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const isSoldOut = tier.available <= 0;

  return (
    <div className={`border rounded-lg p-6 transition-all duration-200 ${
      disabled || isSoldOut 
        ? 'border-gray-200 bg-gray-50 opacity-75' 
        : 'border-gray-300 bg-white hover:border-blue-300 hover:shadow-md'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTokenColor(tier.tokenType)}`}>
          {tier.tokenType}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline space-x-1">
          <span className="text-2xl font-bold text-gray-900">{tier.price}</span>
          <span className="text-sm text-gray-500">{tier.tokenType}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Availability</span>
          <span className={getAvailabilityColor(tier.available, tier.maxSupply)}>
            {tier.available} / {tier.maxSupply}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              tier.available > tier.maxSupply * 0.5 ? 'bg-green-500' :
              tier.available > tier.maxSupply * 0.2 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${(tier.available / tier.maxSupply) * 100}%` }}
          ></div>
        </div>
      </div>

      <button
        onClick={onPurchase}
        disabled={disabled || isSoldOut}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
          disabled || isSoldOut
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg'
        }`}
      >
        {isSoldOut ? (
          <>
            <Clock className="w-4 h-4" />
            <span>Sold Out</span>
          </>
        ) : (
          <>
            <Ticket className="w-4 h-4" />
            <span>Purchase Ticket</span>
          </>
        )}
      </button>

      {tier.available <= 5 && tier.available > 0 && (
        <p className="text-xs text-red-600 mt-2 text-center font-medium">
          Only {tier.available} tickets left!
        </p>
      )}
    </div>
  );
};
