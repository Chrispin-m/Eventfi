import express from 'express';
import { ethers } from 'ethers';
import { getEventManagerContract } from '../config/blockchain.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

/**
 * @route POST /api/organizer/events/prepare
 * @desc Prepare event data for blockchain creation
 * @access Public
 */
router.post('/events/prepare', asyncHandler(async (req, res) => {
  const {
    title,
    description,
    location,
    startDate,
    endDate,
    feeTokenType,
    tiers,
    organizerAddress
  } = req.body;

  console.log('Preparing event creation with data:', {
    title,
    location,
    startDate,
    endDate,
    tiersCount: tiers?.length,
    organizer: organizerAddress
  });

  // Validation
  if (!title || !description || !location || !startDate || !endDate) {
    return res.status(400).json({ 
      error: 'Missing required fields: title, description, location, startDate, endDate' 
    });
  }

  if (!organizerAddress || !ethers.utils.isAddress(organizerAddress)) {
    return res.status(400).json({ error: 'Valid organizer address is required' });
  }

  if (startDate <= Math.floor(Date.now() / 1000)) {
    return res.status(400).json({ error: 'Start date must be in the future' });
  }

  if (endDate <= startDate) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
    return res.status(400).json({ error: 'At least one ticket tier is required' });
  }

  // Validate tiers
  for (const [index, tier] of tiers.entries()) {
    if (!tier.name || !tier.name.trim()) {
      return res.status(400).json({ 
        error: `Invalid tier ${index + 1}: missing name, price, or maxSupply` 
      });
    }
    
    const pricePerPerson = tier.pricePerPerson || tier.price;
    if (!pricePerPerson || Number(pricePerPerson) <= 0) {
      throw new Error(`Invalid tier ${index + 1}: missing name, price, or maxSupply`);
    }
    
    if (!tier.maxSupply || Number(tier.maxSupply) <= 0) {
      return res.status(400).json({ 
        error: `Invalid tier ${index + 1}: price must be greater than 0` 
      });
    }
    
    if (Number(tier.maxSupply) <= 0) {
      return res.status(400).json({ 
        error: `Invalid tier ${index + 1}: maxSupply must be greater than 0` 
      });
    }
  }

  try {
    // Create metadata for the event
    const metadata = {
      title,
      description,
      location,
      startDate,
      endDate,
      organizer: organizerAddress,
      image: 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg',
      tiers: tiers.map(tier => ({
        name: tier.name,
        price: tier.price,
        maxSupply: tier.maxSupply,
        tokenType: tier.tokenType
      }))
    };

    const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;

    const eventData = {
      title,
      description,
      location,
      startDate,
      endDate,
      metadataURI,
      feeTokenType: feeTokenType || 'XFI',
      organizer: organizerAddress,
      tiers: tiers.map(tier => ({
        name: tier.name,
        price: tier.price,
        maxSupply: Number(tier.maxSupply),
        tokenType: tier.tokenType || 'XFI'
      }))
    };

    console.log('Event data prepared successfully');

    res.json({
      success: true,
      eventData,
      contractInfo: {
        contractAddress: process.env.EVENT_MANAGER_CONTRACT || process.env.VITE_EVENT_MANAGER_CONTRACT,
        listingFee: '1.0', // 1 XFI
        gasLimit: '2000000'
      },
      message: 'Event data prepared successfully'
    });

  } catch (error) {
    console.error('Error preparing event creation:', error);
    res.status(500).json({ 
      error: 'Failed to prepare event creation',
      details: error.message 
    });
  }
}));

/**
 * @route POST /api/organizer/events/created
 * @desc Notify backend of successful event creation
 * @access Public
 */
router.post('/events/created', asyncHandler(async (req, res) => {
  const { eventId, transactionHash, organizerAddress } = req.body;

  if (!eventId || !transactionHash || !organizerAddress) {
    return res.status(400).json({ 
      error: 'Missing required fields: eventId, transactionHash, organizerAddress' 
    });
  }

  // Log successful event creation
  console.log(`Event created successfully:`, {
    eventId,
    transactionHash,
    organizer: organizerAddress,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Event creation recorded successfully',
    eventId,
    explorerUrl: `https://scan.testnet.ms/tx/${transactionHash}`
  });
}));

/**
 * @route GET /api/organizer/events
 * @desc Get events for a specific organizer
 * @access Public
 */
router.get('/events', asyncHandler(async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Organizer address is required' });
  }

  if (!ethers.utils.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid organizer address' });
  }

  try {
    const contract = getEventManagerContract();
    
    if (!contract) {
      return res.status(500).json({ 
        error: 'Contract not configured',
        details: 'EVENT_MANAGER_CONTRACT environment variable not set' 
      });
    }
    
    const events = [];
    const maxEventId = 100; // Check up to 100 events for performance
    
    console.log(`Fetching events for organizer: ${address}`);
    
    for (let i = 1; i <= maxEventId; i++) {
      try {
        const eventData = await contract.getEvent(i);
        
        // Check if event exists and belongs to organizer
        if (eventData[0] && 
            eventData[0].toString() !== '0' && 
            eventData[1] !== '0x0000000000000000000000000000000000000000' &&
            eventData[1].toLowerCase() === address.toLowerCase()) {
          
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

          if (event.active) {
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

    console.log(`Found ${events.length} events for organizer ${address}`);

    // Sort events by ID (newest first)
    events.sort((a, b) => b.id - a.id);

    res.json({
      events: events,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: events.length,
        hasNext: false,
        hasPrev: false
      }
    });
  } catch (error) {
    console.error('Error fetching organizer events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch organizer events',
      details: error.message 
    });
  }
}));

// Helper function
function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

export default router;
