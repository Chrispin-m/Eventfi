import React, { useState } from 'react';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';

export const WalletButton: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { account, isConnected, isConnecting, connectWallet, disconnectWallet, chainId } = useWeb3();

  const handleConnect = async () => {
    try {
      await connectWallet();
      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet. Please try again.');
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setIsDropdownOpen(false);
    toast.info('Wallet disconnected');
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      toast.success('Address copied to clipboard!');
      setIsDropdownOpen(false);
    }
  };

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 4157:
        return 'CrossFi Testnet';
      case 4158:
        return 'CrossFi Mainnet';
      default:
        return 'Unknown Network';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto min-w-[140px] touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Wallet className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm sm:text-base whitespace-nowrap">
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm w-full sm:w-auto min-w-[140px] touch-manipulation"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="font-medium text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">
          {formatAddress(account!)}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-w-[calc(100vw-2rem)]">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm text-gray-500">Connected to</div>
            <div className="font-medium text-gray-900">{getNetworkName(chainId)}</div>
          </div>
          
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm text-gray-500">Account</div>
            <div className="font-medium text-gray-900 text-xs break-all">{account}</div>
          </div>

          <button
            onClick={copyAddress}
            className="flex items-center space-x-2 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Copy className="w-4 h-4" />
            <span>Copy Address</span>
          </button>

          <a
            href={`https://scan.testnet.ms/address/${account}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <ExternalLink className="w-4 h-4" />
            <span>View on Explorer</span>
          </a>

          <button
            onClick={handleDisconnect}
            className="flex items-center space-x-2 w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        </div>
      )}

      {/* Backdrop */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
};