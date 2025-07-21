import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { ethers } from 'ethers';

interface Web3ContextType {
  account: string | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
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

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = Boolean(account && provider);

  // Helper: detect mobile browsers
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Initialize on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    checkConnection();
    window.ethereum?.on('accountsChanged', handleAccountsChanged);
    window.ethereum?.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  // Attempt to restore existing connection
  const checkConnection = async () => {
    try {
      // EIP‑1193 provider
      const eth = (window as any).ethereum || (window as any).web3?.currentProvider;
      if (!eth) return;
      const web3p = new ethers.providers.Web3Provider(eth, 'any');
      const accs = await web3p.listAccounts();
      if (accs.length) {
        const net = await web3p.getNetwork();
        setProvider(web3p);
        setSigner(web3p.getSigner());
        setAccount(accs[0]);
        setChainId(net.chainId);
      }
    } catch (err) {
      console.error('checkConnection:', err);
    }
  };

  function handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) return disconnectWallet();
    setAccount(accounts[0]);
  }

  function handleChainChanged(raw: string) {
    const id = parseInt(raw, 16);
    setChainId(id);
    // Optionally: you could force refresh or re-init your contracts here
  }

  const connectWallet = async () => {
    if (typeof window === 'undefined') {
      throw new Error('Window object not found');
    }
    const eth = (window as any).ethereum;
    if (!eth) {
      throw new Error('MetaMask (or other wallet) not detected');
    }

    // For mobile: deep‑link into the MetaMask app if needed
    if (isMobile && !eth.isMetaMask) {
      const dappUrl = window.location.host + window.location.pathname;
      const deeplink = `https://metamask.app.link/dapp/${dappUrl}`;
      window.open(deeplink, '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const web3p = new ethers.providers.Web3Provider(eth, 'any');
      // Request access
      await web3p.send('eth_requestAccounts', []);
      const signer = web3p.getSigner();
      const address = await signer.getAddress();
      const net = await web3p.getNetwork();

      setProvider(web3p);
      setSigner(signer);
      setAccount(address);
      setChainId(net.chainId);

      // If on wrong chain, switch
      if (net.chainId !== 4157) {
        try { await switchToCrossFi(); }
        catch { /* user may ignore */ }
      }
    } catch (err: any) {
      console.error('connectWallet:', err);
      throw new Error(err.message || 'Connection failed');
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
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('MetaMask not installed');
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CROSSFI_CHAIN_CONFIG.chainId }],
      });
    } catch (switchError: any) {
      // Add network if missing
      if (switchError.code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [CROSSFI_CHAIN_CONFIG],
        });
      } else {
        console.error('switchToCrossFi:', switchError);
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
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used inside Web3Provider');
  return ctx;
};

// extend TS window for typings
declare global {
  interface Window {
    ethereum?: any;
    web3?: any;
  }
}
