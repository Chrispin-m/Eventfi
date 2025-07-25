import express from 'express';
import { ethers } from 'ethers';

const router = express.Router();

function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// POST /api/events
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      startDate,
      endDate,
      metadataURI,
      feeTokenType,
      tiers,
      organizerAddress,
      signature,
      message
    } = req.body;

    // Validate signature
    if (!signature || !message || !organizerAddress) {
      return res.status(400).json({ 
        error: 'Missing required authentication fields: signature, message, organizerAddress' 
      });
    }

    try {
      const signerAddress = ethers.utils.verifyMessage(message, signature);
      if (signerAddress.toLowerCase() !== organizerAddress.toLowerCase()) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Signature validation failed' });
    }

    // Basic event validation
    if (!title || !description || !location || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, description, location, startDate, endDate' 
      });
    }

    if (new Date(startDate * 1000) <= new Date()) {
      return res.status(400).json({ error: 'Start date must be in the future' });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return res.status(400).json({ error: 'At least one ticket tier is required' });
    }

    // Event metadata
    const eventData = {
      title,
      description,
      location,
      startDate,
      endDate,
      metadataURI: metadataURI || `data:application/json;base64,${Buffer.from(JSON.stringify({
        title,
        description,
        location,
        image: 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg'
      })).toString('base64')}`,
      feeTokenType: feeTokenType || 0,
      organizer: organizerAddress
    };

    // Validate tiers
    const validatedTiers = tiers.map((tier, index) => {
      const pricePerPerson = tier.pricePerPerson || tier.price;

      if (!tier.name || !tier.name.trim()) {
        throw new Error(`Invalid tier ${index}: missing name`);
      }

      if (!pricePerPerson || Number(pricePerPerson) <= 0) {
        throw new Error(`Invalid tier ${index}: missing or invalid price`);
      }

      if (!tier.maxSupply || Number(tier.maxSupply) <= 0) {
        throw new Error(`Invalid tier ${index}: missing name, price, or maxSupply`);
      }

      return {
        name: tier.name,
        pricePerPerson: ethers.utils.parseEther(pricePerPerson.toString()),
        maxSupply: parseInt(tier.maxSupply),
        tokenType: tier.tokenType || 0
      };
    });

    // Simulated listing fee and event ID
    const listingFee = ethers.utils.parseEther('1');
    const tempEventId = Date.now();

    return res.status(200).json({
      success: true,
      eventData,
      tiers: validatedTiers,
      transactionInfo: {
        contractAddress: process.env.EVENT_MANAGER_CONTRACT,
        listingFee: ethers.utils.formatEther(listingFee),
        feeTokenType: eventData.feeTokenType,
        tempEventId,
        publicURL: `${process.env.VERCEL_URL || 'http://localhost:3000'}/event/${tempEventId}`
      },
      message: 'Event ready to create - confirm transaction in your wallet'
    });

  } catch (error) {
    console.error('Error preparing event creation:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to prepare event creation',
      details: error.message 
    });
  }
});

// GET /api/events - Fetch events from blockchain
router.get('/', async (req, res) => {
  const { page = 1, limit = 10, organizer } = req.query;
  
  console.log('Events API called with params:', { page, limit, organizer });
  
  try {
    const contract = getEventManagerContract();
    
    if (!contract) {
      console.warn('Contract not configured, returning mock data');
      // Fallback to mock data if contract not available
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
        }
      ];
      
      return res.status(200).json({
        events: mockEvents,
        pagination: {
          currentPage: parseInt(page),
          totalPages: 1,
          totalEvents: mockEvents.length,
          hasNext: false,
          hasPrev: false
        }
      });
    }
    
    console.log('Fetching events from blockchain...');
    const events = [];
    const maxEventId = 100; // Check up to 100 events for performance
    
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
        // Event doesn't exist or error reading it
        if (error.message.includes('execution reverted') || 
            error.message.includes('invalid opcode') ||
            error.code === 'CALL_EXCEPTION') {
          // No more events or invalid event ID
          continue;
        }
        console.warn(`Error fetching event ${i}:`, error.message);
      }
    }
    
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
    
  } catch (error) {
    console.error('Error fetching events from blockchain:', error);
    
    // Fallback to mock data on blockchain error
    const mockEvents = [
      {
        id: 1,
        organizer: '0x1f9031A2beA086a591e9872FE3A26F01570A8B2A',
        title: 'Celo Developer Conference 2024',
        description: 'Join us for the biggest blockchain developer conference of the year.',
        location: 'San Francisco, CA',
        startDate: Math.floor(Date.now() / 1000) + 86400 * 7,
        endDate: Math.floor(Date.now() / 1000) + 86400 * 8,
        active: true,
        status: 'upcoming'
      }
    ];
    
    return res.status(200).json({
      events: mockEvents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: 1,
        totalEvents: mockEvents.length,
        hasNext: false,
        hasPrev: false
      },
      blockchainVerified: false,
      fallbackData: true
    });
  }
});

export default router;
