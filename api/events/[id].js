import { ethers } from 'ethers';

// Mock event data for testing
const mockEvents = {
  1: {
    id: 1,
    organizer: '0x1f9031A2beA086a591e9872FE3A26F01570A8B2A',
    title: 'CrossFi Developer Conference 2024',
    description: 'Join us for the biggest blockchain developer conference of the year featuring CrossFi Chain innovations.',
    location: 'San Francisco, CA',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 7,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 8,
    metadataURI: 'ipfs://QmExample',
    active: true,
    tierCount: 3,
    tiers: [
      {
        id: 0,
        name: 'General Admission',
        price: '0.1',
        pricePerPerson: '0.1',
        maxSupply: 500,
        currentSupply: 150,
        tokenType: 'XFI',
        active: true,
        available: 350
      },
      {
        id: 1,
        name: 'VIP',
        price: '0.5',
        pricePerPerson: '0.5',
        maxSupply: 100,
        currentSupply: 25,
        tokenType: 'XFI',
        active: true,
        available: 75
      },
      {
        id: 2,
        name: 'Premium',
        price: '1.0',
        pricePerPerson: '1.0',
        maxSupply: 50,
        currentSupply: 10,
        tokenType: 'XUSD',
        active: true,
        available: 40
      }
    ],
    status: 'upcoming'
  },
  2: {
    id: 2,
    organizer: '0x2f9031A2beA086a591e9872FE3A26F01570A8B2B',
    title: 'DeFi Summit 2024',
    description: 'Explore the future of decentralized finance with industry leaders and innovators.',
    location: 'New York, NY',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 14,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 15,
    metadataURI: 'ipfs://QmExample2',
    active: true,
    tierCount: 2,
    tiers: [
      {
        id: 0,
        name: 'Standard',
        price: '0.2',
        pricePerPerson: '0.2',
        maxSupply: 300,
        currentSupply: 80,
        tokenType: 'XUSD',
        active: true,
        available: 220
      },
      {
        id: 1,
        name: 'VIP',
        price: '0.8',
        pricePerPerson: '0.8',
        maxSupply: 100,
        currentSupply: 30,
        tokenType: 'MPX',
        active: true,
        available: 70
      }
    ],
    status: 'upcoming'
  },
  3: {
    id: 3,
    organizer: '0x3f9031A2beA086a591e9872FE3A26F01570A8B2C',
    title: 'Web3 Gaming Expo',
    description: 'The ultimate showcase of blockchain gaming and NFT innovations.',
    location: 'Los Angeles, CA',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 21,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 22,
    metadataURI: 'ipfs://QmExample3',
    active: true,
    tierCount: 2,
    tiers: [
      {
        id: 0,
        name: 'General',
        price: '0.15',
        pricePerPerson: '0.15',
        maxSupply: 400,
        currentSupply: 120,
        tokenType: 'XFI',
        active: true,
        available: 280
      },
      {
        id: 1,
        name: 'VIP',
        price: '0.6',
        pricePerPerson: '0.6',
        maxSupply: 80,
        currentSupply: 20,
        tokenType: 'XUSD',
        active: true,
        available: 60
      }
    ],
    status: 'upcoming'
  }
};

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
      const { id } = req.query;
      
      console.log('Fetching event with ID:', id);

      if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Invalid event ID' });
      }

      const eventId = parseInt(id);
      const event = mockEvents[eventId];

      if (!event) {
        console.log('Event not found for ID:', eventId);
        return res.status(404).json({ error: 'Event not found' });
      }

      console.log('Returning event:', event.title);
      return res.status(200).json(event);

    } catch (error) {
      console.error('Error fetching event:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch event details',
        details: error.message 
      });
    }
  }

  if (req.method === 'POST' && req.url.includes('/purchase')) {
    try {
      const { id } = req.query;
      const { tierId, buyerAddress, signature, message, tokenType, attendeeCount = 1 } = req.body;

      if (!id || tierId === undefined || !buyerAddress || !signature || !message) {
        return res.status(400).json({ 
          error: 'Missing required fields: tierId, buyerAddress, signature, message' 
        });
      }

      // Verify the signature
      try {
        const signerAddress = ethers.utils.verifyMessage(message, signature);
        if (signerAddress.toLowerCase() !== buyerAddress.toLowerCase()) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } catch (error) {
        return res.status(401).json({ error: 'Signature verification failed' });
      }

      const event = mockEvents[parseInt(id)];
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const tier = event.tiers[parseInt(tierId)];
      if (!tier) {
        return res.status(404).json({ error: 'Tier not found' });
      }

      if (tier.available < attendeeCount) {
        return res.status(400).json({ error: 'Not enough tickets available for this tier' });
      }

      // Calculate total price
      const totalPrice = (parseFloat(tier.pricePerPerson) * attendeeCount).toFixed(3);

      // Generate metadata URI for the ticket
      const ticketMetadata = {
        eventId: id,
        tierId: parseInt(tierId),
        buyer: buyerAddress,
        attendeeCount: attendeeCount,
        totalPrice: totalPrice,
        pricePerPerson: tier.pricePerPerson,
        tokenType: tier.tokenType,
        purchaseTime: Math.floor(Date.now() / 1000),
        qrData: `${id}-${tierId}-${buyerAddress}-${Date.now()}`
      };

      const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(ticketMetadata)).toString('base64')}`;

      return res.status(200).json({
        success: true,
        purchaseDetails: {
          eventId: id,
          tierId: parseInt(tierId),
          price: tier.pricePerPerson,
          totalPrice: totalPrice,
          attendeeCount: attendeeCount,
          tokenType: tier.tokenType,
          metadataURI: metadataURI,
          qrCode: ticketMetadata.qrData,
          message: 'Ready to purchase - confirm transaction in your wallet'
        }
      });

    } catch (error) {
      console.error('Error processing purchase:', error);
      return res.status(500).json({ 
        error: 'Failed to process ticket purchase',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}