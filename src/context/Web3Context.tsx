import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { ethers } from 'ethers';

// Polyfill for global object required by WalletConnect
if (typeof window !== 'undefined') {
  if (typeof window.global === 'undefined') {
    window.global = window;
  }
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

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletConnectProvider, setWalletConnectProvider] = useState<any>(null);

  const isConnected = Boolean(account && provider);

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
      
      if (walletConnectProvider) {
        walletConnectProvider.removeListener('accountsChanged', handleAccountsChanged);
        walletConnectProvider.removeListener('chainChanged', handleChainChanged);
        walletConnectProvider.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [walletConnectProvider]);

  // Attempt to restore existing connection
  const checkConnection = async () => {
    try {
      const ethereum = getInjectedProvider();
      if (!ethereum) return;
      
      const web3Provider = new ethers.providers.Web3Provider(ethereum, 'any');
      const accounts = await web3Provider.listAccounts();
      
      if (accounts.length > 0) {
        const network = await web3Provider.getNetwork();
        setProvider(web3Provider);
        setSigner(web3Provider.getSigner());
        setAccount(accounts[0]);
        setChainId(network.chainId);
      }
    } catch (err) {
      console.error('checkConnection:', err);
    }
  };

  const getInjectedProvider = () => {
    // Check for modern EIP-1193 providers
    if (window.ethereum) {
      return window.ethereum;
    }
    
    // Check for legacy web3
    if (window.web3?.currentProvider) {
      return window.web3.currentProvider;
    }
    
    return null;
  };

  const connectToWalletConnect = async () => {
    try {
      // Dynamic import for WalletConnect
      const WalletConnectProvider = (await import('@walletconnect/web3-provider')).default;
      
      const wcProvider = new WalletConnectProvider({
        rpc: {
          4157: 'https://rpc.testnet.ms',
          1: 'https://mainnet.infura.io/v3/',
          56: 'https://bsc-dataseed.binance.org/',
        },
        chainId: 4157,
        qrcode: true,
        qrcodeModalOptions: {
          mobileLinks: [
            'metamask',
            'trust',
            'rainbow',
            'argent',
            'imtoken',
            'pillar',
          ],
        },
      });

      await wcProvider.enable();
      
      const web3Provider = new ethers.providers.Web3Provider(wcProvider);
      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(signer);
      setAccount(address);
      setChainId(network.chainId);
      setWalletConnectProvider(wcProvider);

      // Listen for WalletConnect events
      wcProvider.on('accountsChanged', handleAccountsChanged);
      wcProvider.on('chainChanged', handleChainChanged);
      wcProvider.on('disconnect', handleDisconnect);

    } catch (error) {
      console.error('WalletConnect connection failed:', error);
      throw new Error('Failed to connect with WalletConnect');
    }
  };

  function handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
    }
  }

  function handleChainChanged(chainIdHex: string) {
    try {
      const newChainId = parseInt(chainIdHex, 16);
      if (!isNaN(newChainId)) {
        setChainId(newChainId);
      }
    } catch (e) {
      console.error('Error parsing chain ID:', e);
    }
  }

  function handleDisconnect() {
    disconnectWallet();
  }

  const connectWallet = async (walletType: 'metamask' | 'walletconnect' | 'injected' = 'injected') => {
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
  };

  const disconnectWallet = () => {
    if (walletConnectProvider) {
      walletConnectProvider.disconnect();
    }
    
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setWalletConnectProvider(null);
  };

  const switchToCrossFi = async () => {
    const ethereum = walletConnectProvider || getInjectedProvider();
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
  };

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
