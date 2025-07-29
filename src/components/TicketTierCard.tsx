import React from 'react';
import { ArrowRight } from 'lucide-react';

interface TicketTier {
  id: number;
  name: string;
  price: string;
  pricePerPerson: string;
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
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-900">{tier.name}</h3>
        <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
          {tier.tokenType}
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600 text-sm">Price per ticket:</span>
          <span className="font-medium">
            {tier.pricePerPerson || tier.price} {tier.tokenType}
          </span>
        </div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600 text-sm">Available:</span>
          <span className="font-medium">
            {tier.available} / {tier.maxSupply}
          </span>
        </div>
      </div>
      
      <button
        onClick={onPurchase}
        disabled={disabled}
        className={`w-full flex items-center justify-center py-2 px-4 rounded-lg font-medium transition-colors ${
          disabled 
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
        }`}
      >
        <span>Purchase</span>
        <ArrowRight className="w-4 h-4 ml-2" />
      </button>
    </div>
  );
};
