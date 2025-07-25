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
const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

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
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { page = 1, limit = 10, organizer } = req.query;
      
      console.log('Events API called with params:', { page, limit, organizer });
      
      // For MVP, we'll return mock data since we don't have a deployed contract yet
      // Try to fetch from blockchain first
      try {
        const contract = getEventManagerContract();
        
        if (contract) {
          console.log('Fetching events from blockchain...');
          const events = [];
          const maxEventId = 50; // Check up to 50 events
          
          for (let i = 1; i <= maxEventId; i++) {
            try {
              const eventData = await contract.getEvent(i);
              
              // Check if event exists and is active
              if (eventData[0] && 
                  eventData[0].toString() !== '0' && 
                  eventData[1] !== '0x0000000000000000000000000000000000000000' &&
                  eventData[8] === true) { // active
                
                const startDate = parseInt(eventData[5].toString());
                const endDate = parseInt(eventData[6].toString());
                
                const event = {
                  id: parseInt(eventData[0].toString()),
                  organizer: eventData[1],
                  title: eventData[2],
                  description: eventData[3],
                  location: eventData[4],
                  startDate: startDate,
                  endDate: endDate,
                  metadataURI: eventData[7],
                  active: eventData[8],
                  tierCount: parseInt(eventData[9].toString()),
                  status: getEventStatus(startDate, endDate)
                };
                
                // Filter by organizer if specified
                if (!organizer || event.organizer.toLowerCase() === organizer.toLowerCase()) {
                  events.push(event);
                }
              }
            } catch (error) {
              // Event doesn't exist or error reading it - continue to next
              if (error.message.includes('execution reverted') || 
                  error.message.includes('invalid opcode') ||
                  error.code === 'CALL_EXCEPTION') {
                continue;
              }
            }
          }
          
          if (events.length > 0) {
            console.log(`Found ${events.length} blockchain events`);
            
            // Sort events by ID (newest first)
            events.sort((a, b) => b.id - a.id);
            
            // Implement pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedEvents = events.slice(startIndex, endIndex);
            
            return res.status(200).json({
              events: paginatedEvents,
              pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(events.length / limit),
                totalEvents: events.length,
                hasNext: endIndex < events.length,
                hasPrev: page > 1
              },
              blockchainVerified: true
            });
          }
        }
      } catch (error) {
        console.error('Blockchain fetch error:', error);
      }
      
      // Fallback to mock data
      console.log('Using fallback mock data');
      const mockEvents = [
        {
          id: 1,
          organizer: '0x1f9031A2beA086a591e9872FE3A26F01570A8B2A', 
          title: 'Celo Developer Conference 2024',
          description: 'Join us for the biggest blockchain developer conference of the year featuring Celo innovations.',
          location: 'San Francisco, CA',
          startDate: Math.floor(Date.now() / 1000) + 86400 * 7,
          endDate: Math.floor(Date.now() / 1000) + 86400 * 8,
          active: true,
          status: 'upcoming'
        },
        {
          id: 2,
          organizer: '0x2f9031A2beA086a591e9872FE3A26F01570A8B2B',
          title: 'DeFi Summit 2024',
          description: 'Explore the future of decentralized finance with industry leaders and innovators.',
          location: 'New York, NY',
          startDate: Math.floor(Date.now() / 1000) + 86400 * 14,
          endDate: Math.floor(Date.now() / 1000) + 86400 * 15,
          active: true,
          status: 'upcoming'
        },
        {
          id: 3,
          organizer: '0x3f9031A2beA086a591e9872FE3A26F01570A8B2C',
          title: 'Web3 Gaming Expo',
          description: 'The ultimate showcase of blockchain gaming and NFT innovations.',
          location: 'Los Angeles, CA',
          startDate: Math.floor(Date.now() / 1000) + 86400 * 21,
          endDate: Math.floor(Date.now() / 1000) + 86400 * 22,
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

      console.log(`Returning ${paginatedEvents.length} events`);

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