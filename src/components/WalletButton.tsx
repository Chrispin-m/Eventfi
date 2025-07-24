import React, { useState } from 'react';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink, Smartphone, Monitor } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { toast } from 'react-toastify';

export const WalletButton: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const { account, isConnected, isConnecting, connectWallet, disconnectWallet, chainId } = useWeb3();

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const handleConnect = async (walletType: 'metamask' | 'walletconnect' | 'injected' = 'injected') => {
    try {
      await connectWallet(walletType);
      toast.success('Wallet connected successfully!');
      setShowWalletOptions(false);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      toast.error(errorMessage);
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
          onClick={() => setShowWalletOptions(!showWalletOptions)}
          disabled={isConnecting}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed w-full touch-manipulation text-base font-medium"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Wallet className="w-4 h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </span>
          <ChevronDown className="w-4 h-4" />
        </button>

        {showWalletOptions && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">Choose Wallet</p>
            </div>
            
            <button
              onClick={() => handleConnect('injected')}
              className="flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Monitor className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-medium">Browser Wallet</p>
                <p className="text-xs text-gray-500">MetaMask, Coinbase, etc.</p>
              </div>
            </button>

            <button
              onClick={() => handleConnect('walletconnect')}
              className="flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Smartphone className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium">WalletConnect</p>
                <p className="text-xs text-gray-500">Mobile wallets & more</p>
              </div>
            </button>

            {isMobile && (
              <button
                onClick={() => {
                  const dappUrl = encodeURIComponent(window.location.href);
                  const metamaskUrl = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
                  window.open(metamaskUrl, '_blank');
                }}
                className="flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Wallet className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-medium">Open in MetaMask</p>
                  <p className="text-xs text-gray-500">Mobile app</p>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Backdrop */}
        {showWalletOptions && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowWalletOptions(false)}
          />
        )}
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
        <span className="font-medium text-sm truncate max-w-[120px]">
          {formatAddress(account!)}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-w-[calc(100vw-1rem)]">
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