import { ethers } from 'ethers';

// CrossFi Chain configuration
const CROSSFI_CONFIG = {
  testnet: {
    chainId: 4157,
    name: 'CrossFi Testnet',
    rpcUrl: process.env.CROSSFI_TESTNET_RPC || 'https://rpc.testnet.ms',
  },
  mainnet: {
    chainId: 4158,
    name: 'CrossFi Mainnet',
    rpcUrl: process.env.CROSSFI_MAINNET_RPC || 'https://rpc.mainnet.ms',
  }
};

// Contract configuration
const CONTRACT_ADDRESSES = {
  EVENT_MANAGER: process.env.EVENT_MANAGER_CONTRACT || '',
};

// Contract ABI (simplified for key functions)
const EVENT_MANAGER_ABI = [
  "function getEvent(uint256 eventId) view returns (uint256, address, string, string, string, uint256, uint256, string, bool, uint256)",
  "function getTicketTier(uint256 eventId, uint256 tierId) view returns (string, uint256, uint256, uint256, uint8, bool)",
];

// Initialize provider
const network = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
const config = CROSSFI_CONFIG[network];
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

// Get contract instance
function getEventManagerContract() {
  if (!CONTRACT_ADDRESSES.EVENT_MANAGER) {
    throw new Error('EventManager contract address not configured');
  }
  
  return new ethers.Contract(
    CONTRACT_ADDRESSES.EVENT_MANAGER,
    EVENT_MANAGER_ABI,
    provider
  );
}

function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { page = 1, limit = 10, organizer } = req.query;
      
      // For MVP, we'll return mock data since we don't have a deployed contract yet
      const mockEvents = [
        {
          id: 1,
          organizer: '0x1f9031A2beA086a591e9872FE3A26F01570A8B2A',
          title: 'CrossFi Developer Conference 2024',
          description: 'Join us for the biggest blockchain developer conference of the year featuring CrossFi Chain innovations.',
          location: 'San Francisco, CA',
          startDate: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days from now
          endDate: Math.floor(Date.now() / 1000) + 86400 * 8, // 8 days from now
          active: true,
          status: 'upcoming'
        },
        {
          id: 2,
          organizer: '0x2f9031A2beA086a591e9872FE3A26F01570A8B2B',
          title: 'DeFi Summit 2024',
          description: 'Explore the future of decentralized finance with industry leaders and innovators.',
          location: 'New York, NY',
          startDate: Math.floor(Date.now() / 1000) + 86400 * 14, // 14 days from now
          endDate: Math.floor(Date.now() / 1000) + 86400 * 15, // 15 days from now
          active: true,
          status: 'upcoming'
        },
        {
          id: 3,
          organizer: '0x3f9031A2beA086a591e9872FE3A26F01570A8B2C',
          title: 'Web3 Gaming Expo',
          description: 'The ultimate showcase of blockchain gaming and NFT innovations.',
          location: 'Los Angeles, CA',
          startDate: Math.floor(Date.now() / 1000) + 86400 * 21, // 21 days from now
          endDate: Math.floor(Date.now() / 1000) + 86400 * 22, // 22 days from now
          active: true,
          status: 'upcoming'
        }
      ];

      // Filter by organizer if specified
      let filteredEvents = mockEvents;
      if (organizer) {
        filteredEvents = mockEvents.filter(event => 
          event.organizer.toLowerCase() === organizer.toLowerCase()
        );
      }

      // Implement pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

      return res.status(200).json({
        events: paginatedEvents,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredEvents.length / limit),
          totalEvents: filteredEvents.length,
          hasNext: endIndex < filteredEvents.length,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch events',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}