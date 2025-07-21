import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

interface Web3ContextType {
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToCrossFi: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

const CROSSFI_CHAIN_CONFIG = {
  chainId: '0x103D',
  chainName: 'CrossFi Testnet',
  nativeCurrency: {
    name: 'XFI',
    symbol: 'XFI',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.testnet.ms'],
  blockExplorerUrls: ['https://scan.testnet.ms'],
};

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = !!account && !!provider;

  useEffect(() => {
    checkConnection();
    setupEventListeners();

    return () => {
      cleanupEventListeners();
    };
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const tempProvider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await tempProvider.listAccounts();
        if (accounts.length > 0) {
          const tempSigner = await tempProvider.getSigner();
          const network = await tempProvider.getNetwork();
          setProvider(tempProvider);
          setSigner(tempSigner);
          setAccount(accounts[0].address);
          setChainId(Number(network.chainId));
        }
      } catch (err) {
        console.error('Error checking wallet connection:', err);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or a Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      const tempProvider = new ethers.BrowserProvider(window.ethereum);

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found.');
      }

      const tempSigner = await tempProvider.getSigner();
      const network = await tempProvider.getNetwork();

      setProvider(tempProvider);
      setSigner(tempSigner);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));

      if (Number(network.chainId) !== 4157) {
        await switchToCrossFi();
      }

    } catch (error: any) {
      console.error('Wallet connection error:', error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  };

  const switchToCrossFi = async () => {
    if (!window.ethereum) throw new Error('No Ethereum provider found');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CROSSFI_CHAIN_CONFIG.chainId }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CROSSFI_CHAIN_CONFIG],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      } else {
        throw switchError;
      }
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
    }
  };

  const handleChainChanged = (hexChainId: string) => {
    const parsedId = parseInt(hexChainId, 16);
    setChainId(parsedId);
    checkConnection(); // signer/provider/account
  };

  const setupEventListeners = () => {
    if (window.ethereum?.on) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
  };

  const cleanupEventListeners = () => {
    if (window.ethereum?.removeListener) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  };

  const value: Web3ContextType = {
    account,
    provider,
    signer,
    chainId,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    switchToCrossFi,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

declare global {
  interface Window {
    ethereum?: any;
  }
}
