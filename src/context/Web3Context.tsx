import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { ethers } from 'ethers';
import { WalletConnectModal } from '@walletconnect/modal';
import WalletConnectProvider from '@walletconnect/web3-provider';

// Polyfill for global object required by WalletConnect
if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  window.global = window;
}

interface Web3ContextType {
  account: string | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: (walletType?: 'metamask' | 'walletconnect' | 'injected') => Promise<void>;
  disconnectWallet: () => void;
  switchToCrossFi: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

const CROSSFI_CHAIN_CONFIG = {
  chainId: '0x103D', // Hex for 4157
  chainName: 'CrossFi Testnet',
  nativeCurrency: { name: 'XFI', symbol: 'XFI', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.ms'],
  blockExplorerUrls: ['https://scan.testnet.ms'],
};

const WALLETCONNECT_PROJECT_ID = "bd8322da1682ec5afc8ecdb3ce24c57d";
const WALLETCONNECT_APP_NAME = 'mini';

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wcProvider, setWcProvider] = useState<WalletConnectProvider | null>(null);
  const [wcModal, setWcModal] = useState<WalletConnectModal | null>(null);

  const isConnected = Boolean(account && provider);

  // Initialize WalletConnect Modal
  useEffect(() => {
    if (typeof window === 'undefined' || !WALLETCONNECT_PROJECT_ID) return;
    
    const modal = new WalletConnectModal({
      projectId: WALLETCONNECT_PROJECT_ID,
      walletConnectVersion: 2,
      themeMode: 'dark',
      themeVariables: {
        '--wcm-z-index': '10000'
      },
      mobileWallets: [
        { id: 'metamask', name: 'MetaMask', links: { native: 'metamask://', universal: 'https://metamask.app.link' } },
        { id: 'trust', name: 'Trust Wallet', links: { native: 'trust://', universal: 'https://link.trustwallet.com' } },
      ],
      desktopWallets: [
        { id: 'metamask', name: 'MetaMask', links: { native: '', universal: 'https://metamask.io' } },
      ],
    });
    
    setWcModal(modal);
    
    return () => {
      modal.closeModal();
    };
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    checkConnection();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
      
      if (wcProvider) {
        wcProvider.removeListener('accountsChanged', handleAccountsChanged);
        wcProvider.removeListener('chainChanged', handleChainChanged);
        wcProvider.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [wcProvider]);

  // Attempt to restore existing connection
  const checkConnection = useCallback(async () => {
    try {
      // Check for injected provider
      const ethereum = getInjectedProvider();
      if (ethereum) {
        const web3Provider = new ethers.providers.Web3Provider(ethereum, 'any');
        const accounts = await web3Provider.listAccounts();
        
        if (accounts.length > 0) {
          const network = await web3Provider.getNetwork();
          setProvider(web3Provider);
          setSigner(web3Provider.getSigner());
          setAccount(accounts[0]);
          setChainId(network.chainId);
          return;
        }
      }
      
      // Check for existing WalletConnect session
      if (wcProvider?.connected) {
        const web3Provider = new ethers.providers.Web3Provider(wcProvider);
        const signer = web3Provider.getSigner();
        const address = await signer.getAddress();
        const network = await web3Provider.getNetwork();
        
        setProvider(web3Provider);
        setSigner(signer);
        setAccount(address);
        setChainId(network.chainId);
      }
    } catch (err) {
      console.error('checkConnection:', err);
    }
  }, [wcProvider]);

  const getInjectedProvider = useCallback(() => {
    // Check for modern EIP-1193 providers
    if (window.ethereum) {
      return window.ethereum;
    }
    
    // Check for legacy web3
    if (window.web3?.currentProvider) {
      return window.web3.currentProvider;
    }
    
    return null;
  }, []);

  const connectToWalletConnect = useCallback(async () => {
    if (!WALLETCONNECT_PROJECT_ID) {
      throw new Error('WalletConnect project ID is not configured');
    }
    
    if (!wcModal) {
      throw new Error('WalletConnect modal not initialized');
    }

    try {
      const provider = new WalletConnectProvider({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [4157],
        showQrModal: false, // We'll handle the modal ourselves
        rpcMap: {
          4157: 'https://rpc.testnet.ms',
        },
        metadata: {
          name: WALLETCONNECT_APP_NAME,
          description: 'Connect to Mini App',
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.ico`],
        },
      });

      // Subscribe to events
      provider.on('display_uri', (uri: string) => {
        wcModal.openModal({ uri });
      });

      provider.on('connect', () => {
        wcModal.closeModal();
      });

      provider.on('disconnect', () => {
        disconnectWallet();
      });

      await provider.enable();

      const web3Provider = new ethers.providers.Web3Provider(provider);
      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(signer);
      setAccount(address);
      setChainId(network.chainId);
      setWcProvider(provider);

      // Listen for events
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);
      provider.on('disconnect', handleDisconnect);

    } catch (error) {
      wcModal?.closeModal();
      console.error('WalletConnect connection failed:', error);
      throw new Error('Failed to connect with WalletConnect');
    }
  }, [wcModal]);

  const handleAccountsChanged = useCallback((accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
    }
  }, []);

  const handleChainChanged = useCallback((chainIdHex: string) => {
    try {
      const newChainId = parseInt(chainIdHex, 16);
      if (!isNaN(newChainId)) {
        setChainId(newChainId);
      }
    } catch (e) {
      console.error('Error parsing chain ID:', e);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnectWallet();
  }, []);

  const connectWallet = useCallback(async (walletType: 'metamask' | 'walletconnect' | 'injected' = 'injected') => {
    if (typeof window === 'undefined') {
      throw new Error('Window object not found');
    }

    setIsConnecting(true);

    try {
      // Detect mobile browsers
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (walletType === 'walletconnect' || (isMobile && !getInjectedProvider())) {
        await connectToWalletConnect();
        return;
      }

      const ethereum = getInjectedProvider();
      
      if (!ethereum) {
        // For mobile devices, try to open MetaMask app
        if (isMobile) {
          const metamaskUrl = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
          window.open(metamaskUrl, '_blank');
          throw new Error('Please open this page in MetaMask mobile browser or use WalletConnect');
        } else {
          throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
        }
      }

      const web3Provider = new ethers.providers.Web3Provider(ethereum, 'any');
      
      // Request account access
      const accounts = await web3Provider.send('eth_requestAccounts', []);
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(signer);
      setAccount(address);
      setChainId(network.chainId);

      // Switch to CrossFi if on wrong network
      if (network.chainId !== 4157) {
        await switchToCrossFi();
      }

    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [connectToWalletConnect, getInjectedProvider]);

  const disconnectWallet = useCallback(() => {
    if (wcProvider) {
      wcProvider.disconnect();
      setWcProvider(null);
    }
    
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, [wcProvider]);

  const switchToCrossFi = useCallback(async () => {
    let ethereum: any;
    
    if (wcProvider) {
      ethereum = wcProvider;
    } else {
      ethereum = getInjectedProvider();
    }
    
    if (!ethereum) throw new Error('No wallet detected');

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CROSSFI_CHAIN_CONFIG.chainId }],
      });
    } catch (switchError: any) {
      // Add network if it doesn't exist
      if (switchError.code === 4902 || switchError.error?.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [CROSSFI_CHAIN_CONFIG],
        });
      } else {
        console.error('Failed to switch network:', switchError);
        throw switchError;
      }
    }
  }, [wcProvider, getInjectedProvider]);

  return (
    <Web3Context.Provider
      value={{
        account,
        provider,
        signer,
        chainId,
        isConnected,
        isConnecting,
        connectWallet,
        disconnectWallet,
        switchToCrossFi,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
};

declare global {
  interface Window {
    ethereum?: any;
    web3?: any;
    global?: typeof globalThis;
  }
}
