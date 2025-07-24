import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { ethers } from 'ethers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';

// Type declarations for global extensions
declare global {
  interface Window {
    ethereum?: any;
    web3?: any;
    global?: typeof globalThis;
    Buffer?: any;
    process?: any;
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
  const [ethereumProvider, setEthereumProvider] = useState<any>(null);

  const isConnected = Boolean(account && provider);

  // Initialize polyfills and connections
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize polyfills
    const initPolyfills = async () => {
      if (!window.Buffer) {
        const { Buffer } = await import('buffer');
        window.Buffer = Buffer;
      }
      if (!window.process) {
        window.process = { env: {} } as any;
      }
      window.global = window;
    };

    initPolyfills().then(() => {
      checkConnection();
    });

    // Listen for account changes
    const handleEthereumEvents = () => {
      if (window.ethereum) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
        window.ethereum.on('disconnect', handleDisconnect);
      }
    };

    handleEthereumEvents();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
      
      if (ethereumProvider) {
        ethereumProvider.removeListener('accountsChanged', handleAccountsChanged);
        ethereumProvider.removeListener('chainChanged', handleChainChanged);
        ethereumProvider.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [ethereumProvider]);

  // Check for existing connections
  const checkConnection = useCallback(async () => {
    try {
      // Check for injected provider first
      const ethereum = getInjectedProvider();
      if (ethereum) {
        const web3Provider = new ethers.providers.Web3Provider(ethereum, 'any');
        const accounts = await web3Provider.listAccounts();
        
        if (accounts.length > 0) {
          const network = await web3Provider.getNetwork();
          updateProviderState(web3Provider, accounts[0], network.chainId);
          return;
        }
      }
      
      // Check for existing WalletConnect session
      if (ethereumProvider?.session) {
        const web3Provider = new ethers.providers.Web3Provider(ethereumProvider);
        const signer = web3Provider.getSigner();
        const address = await signer.getAddress();
        const network = await web3Provider.getNetwork();
        updateProviderState(web3Provider, address, network.chainId);
      }
    } catch (err) {
      console.error('Connection check failed:', err);
    }
  }, [ethereumProvider]);

  const updateProviderState = (
    web3Provider: ethers.providers.Web3Provider,
    account: string,
    chainId: number
  ) => {
    setProvider(web3Provider);
    setSigner(web3Provider.getSigner());
    setAccount(account);
    setChainId(chainId);
  };

  const getInjectedProvider = useCallback(() => {
    if (window.ethereum) return window.ethereum;
    if (window.web3?.currentProvider) return window.web3.currentProvider;
    return null;
  }, []);

  const connectToWalletConnect = useCallback(async () => {
    if (!WALLETCONNECT_PROJECT_ID) {
      throw new Error('WalletConnect project ID is not configured');
    }

    try {
      const provider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [4157],
        showQrModal: true,
        methods: ['eth_sendTransaction', 'personal_sign'],
        events: ['chainChanged', 'accountsChanged'],
        metadata: {
          name: 'mini',
          description: 'Connect to Mini App',
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.ico`],
        }
      });

      await provider.enable();

      const web3Provider = new ethers.providers.Web3Provider(provider);
      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();
      const network = await web3Provider.getNetwork();

      updateProviderState(web3Provider, address, network.chainId);
      setEthereumProvider(provider);

      // Setup event listeners
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);
      provider.on('disconnect', handleDisconnect);

    } catch (error) {
      console.error('WalletConnect connection failed:', error);
      throw new Error('Failed to connect with WalletConnect');
    }
  }, []);

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
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (walletType === 'walletconnect' || (isMobile && !getInjectedProvider())) {
        await connectToWalletConnect();
        return;
      }

      const ethereum = getInjectedProvider();
      
      if (!ethereum) {
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

      const network = await web3Provider.getNetwork();
      updateProviderState(web3Provider, accounts[0], network.chainId);

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
    if (ethereumProvider) {
      ethereumProvider.disconnect().catch(console.error);
      setEthereumProvider(null);
    }
    
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, [ethereumProvider]);

  const switchToCrossFi = useCallback(async () => {
    let ethereum: any;
    
    if (ethereumProvider) {
      ethereum = ethereumProvider;
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
  }, [ethereumProvider, getInjectedProvider]);

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
