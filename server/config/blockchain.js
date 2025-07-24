import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// CrossFi Chain configuration
export const CROSSFI_CONFIG = {
  testnet: {
    chainId: 4157,
    name: 'CrossFi Testnet',
    rpcUrl: process.env.CROSSFI_TESTNET_RPC || 'https://rpc.testnet.ms',
    explorer: 'https://scan.testnet.ms',
  },
  mainnet: {
    chainId: 4158,
    name: 'CrossFi Mainnet',
    rpcUrl: process.env.CROSSFI_MAINNET_RPC || 'https://rpc.mainnet.ms',
    explorer: 'https://scan.ms',
  }
};

// Token addresses
export const TOKEN_ADDRESSES = {
  XFI: '0x0000000000000000000000000000000000000000', // Native token (ETH-like)
  XUSD: process.env.XUSD_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000001',
  MPX: process.env.MPX_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000002',
};

// Contract addresses
export const CONTRACT_ADDRESSES = {
  EVENT_MANAGER: process.env.EVENT_MANAGER_CONTRACT || '',
};

// Platform configuration
export const PLATFORM_CONFIG = {
  address: '0xdeAFa17D50dBa6224177FFA396395A7E096f250E',
  listingFee: ethers.utils.parseEther('1'), // 1 XFI listing fee
};

// Initialize providers
const network = 'testnet'; //process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
const config = CROSSFI_CONFIG[network];

export const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

// Initialize wallet for contract interactions
export const wallet = process.env.PRIVATE_KEY 
  ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  : null;

// Contract ABI (simplified for key functions)
export const EVENT_MANAGER_ABI = [
  "function createEvent(string memory title, string memory description, string memory location, uint256 startDate, uint256 endDate, string memory metadataURI, uint8 feeTokenType) payable returns (uint256)",
  "function addTicketTier(uint256 eventId, string memory tierName, uint256 price, uint256 maxSupply, uint8 tokenType) external",
  "function buyTicket(uint256 eventId, uint256 tierId, string memory ticketMetadataURI) payable returns (uint256)",
  "function getEvent(uint256 eventId) view returns (uint256, address, string, string, string, uint256, uint256, string, bool, uint256)",
  "function getTicketTier(uint256 eventId, uint256 tierId) view returns (string, uint256, uint256, uint256, uint8, bool)",
  "function verifyTicket(uint256 ticketId) view returns (bool, string)",
  "function verifyAndUseTicket(uint256 ticketId) returns (bool)",
  "event EventCreated(uint256 indexed eventId, address indexed organizer, string title, uint256 startDate, uint256 endDate)",
  "event TicketPurchased(uint256 indexed ticketId, uint256 indexed eventId, uint256 indexed tierId, address buyer, uint256 price, uint8 tokenType)",
  "event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId)"
];

// Get contract instance
export function getEventManagerContract() {
  const contractAddress = process.env.EVENT_MANAGER_CONTRACT || 
                         process.env.VITE_EVENT_MANAGER_CONTRACT || 
                         CONTRACT_ADDRESSES.EVENT_MANAGER;
  
  if (!contractAddress) {
    console.warn('EventManager contract address not configured. Please set EVENT_MANAGER_CONTRACT environment variable.');
    // Return null instead of throwing to allow graceful handling
    return null;
  }
  
  console.log('Using contract address:', contractAddress);
  
  return new ethers.Contract(
    contractAddress,
    EVENT_MANAGER_ABI,
    provider
  );
}

// Get contract instance with signer
export function getEventManagerContractWithSigner() {
  if (!wallet) {
    throw new Error('Wallet not configured');
  }
  
  const contract = getEventManagerContract();
  if (!contract) {
    throw new Error('Contract not available');
  }
  return contract.connect(wallet);
}

export default {
  CROSSFI_CONFIG,
  TOKEN_ADDRESSES,
  CONTRACT_ADDRESSES,
  PLATFORM_CONFIG,
  provider,
  wallet,
  getEventManagerContract,
  getEventManagerContractWithSigner
};
