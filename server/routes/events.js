import express from 'express';
import { ethers } from 'ethers';
import { getEventManagerContract } from '../config/blockchain.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

/**
 * @route GET /api/events/:id
 * @desc Get event details by ID
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }

  try {
    const contract = getEventManagerContract();
    
    // Get event details
    const eventData = await contract.getEvent(id);
    
    // Check if event exists
    if (!eventData[0] || eventData[0].toString() === '0' || eventData[1] === '0x0000000000000000000000000000000000000000') {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get all ticket tiers
    const tierCount = parseInt(eventData[9].toString());
    const tiers = [];
    
    for (let i = 0; i < tierCount; i++) {
      try {
        const tierData = await contract.getTicketTier(id, i);
        tiers.push({
          id: i,
          name: tierData[0],
          price: ethers.utils.formatEther(tierData[1]),
          maxSupply: parseInt(tierData[2].toString()),
          currentSupply: parseInt(tierData[3].toString()),
          tokenType: ['XFI', 'XUSD', 'MPX'][parseInt(tierData[4].toString())],
          active: tierData[5],
          available: parseInt(tierData[2].toString()) - parseInt(tierData[3].toString())
        });
      } catch (error) {
        console.warn(`Error fetching tier ${i} for event ${id}:`, error.message);
      }
    }

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
      tierCount: tierCount,
      tiers: tiers,
      status: getEventStatus(startDate, endDate)
    };

    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ 
      error: 'Failed to fetch event details',
      details: error.message 
    });
  }
}));

/**
 * @route GET /api/events
 * @desc Get all active events (paginated)
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, organizer } = req.query;

  try {
    const contract = getEventManagerContract();
    const events = [];
    const maxEventId = 1000; // Check up to 1000 events
    
    console.log('Fetching all events...');
    
    for (let i = 1; i <= maxEventId; i++) {
      try {
        const eventData = await contract.getEvent(i);
        
        // Check if event exists (id > 0 and has organizer)
        if (eventData[0] && eventData[0].toString() !== '0' && eventData[1] !== '0x0000000000000000000000000000000000000000') {
          // Filter by organizer if specified
          if (organizer && eventData[1].toLowerCase() !== organizer.toLowerCase()) {
            continue;
          }

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
        if (error.message.includes('execution reverted')) {
          // No more events, break the loop
          break;
        }
        continue;
      }
    }

    console.log(`Found ${events.length} total events`);

    // Sort events by ID (newest first)
    events.sort((a, b) => b.id - a.id);

    // Implement pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedEvents = events.slice(startIndex, endIndex);

    res.json({
      events: paginatedEvents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(events.length / parseInt(limit)),
        totalEvents: events.length,
        hasNext: endIndex < events.length,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch events',
      details: error.message 
    });
  }
}));

/**
 * @route POST /api/events/:id/purchase
 * @desc Purchase a ticket for an event
 * @access Public
 */
router.post('/:id/purchase', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tierId, buyerAddress, signature, tokenType } = req.body;

  if (!id || !tierId || !buyerAddress || !signature) {
    return res.status(400).json({ 
      error: 'Missing required fields: eventId, tierId, buyerAddress, signature' 
    });
  }

  const contract = getEventManagerContract();

  try {
    // Verify the buyer's signature (simplified for MVP)
    const message = `Purchase ticket for event ${id}, tier ${tierId}`;
    const signerAddress = ethers.utils.verifyMessage(message, signature);
    
    if (signerAddress.toLowerCase() !== buyerAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Get ticket tier details
    const tierData = await contract.getTicketTier(id, tierId);
    const price = tierData[1];
    const available = parseInt(tierData[2].toString()) - parseInt(tierData[3].toString());

    if (available <= 0) {
      return res.status(400).json({ error: 'Tickets sold out for this tier' });
    }

    // Generate metadata URI for the ticket (QR code will include this info)
    const ticketMetadata = {
      eventId: id,
      tierId: tierId,
      buyer: buyerAddress,
      purchaseTime: Math.floor(Date.now() / 1000),
      qrData: `${id}-${tierId}-${buyerAddress}-${Date.now()}`
    };

    const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(ticketMetadata)).toString('base64')}`;

    // Return purchase information (in production, this would trigger the actual transaction)
    res.json({
      success: true,
      purchaseDetails: {
        eventId: id,
        tierId: tierId,
        price: ethers.utils.formatEther(price),
        tokenType: ['XFI', 'XUSD', 'MPX'][parseInt(tierData[4].toString())],
        metadataURI: metadataURI,
        qrCode: ticketMetadata.qrData,
        message: 'Ready to purchase - confirm transaction in your wallet'
      }
    });

  } catch (error) {
    console.error('Error processing purchase:', error);
    res.status(500).json({ error: 'Failed to process ticket purchase' });
  }
}));

function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

export default router;