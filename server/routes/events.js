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
    
    if (!contract) {
      return res.status(500).json({ 
        error: 'Contract not configured',
        details: 'EVENT_MANAGER_CONTRACT environment variable not set' 
      });
    }
    
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
          price: ethers.utils.formatEther(tierData[1]), // Keep for backward compatibility
          pricePerPerson: ethers.utils.formatEther(tierData[1]),
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
    
    if (!contract) {
      return res.status(500).json({ 
        error: 'Contract not configured',
        details: 'EVENT_MANAGER_CONTRACT environment variable not set' 
      });
    }
    
    const events = [];
    const maxEventId = 100; // Check up to 100 events for performance
    
    console.log('Fetching all events...');
    
    for (let i = 1; i <= maxEventId; i++) {
      try {
        const eventData = await contract.getEvent(i);
        
        // Check if event exists and is valid
        if (eventData[0] && 
            eventData[0].toString() !== '0' && 
            eventData[1] !== '0x0000000000000000000000000000000000000000') {
          
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
        if (error.message.includes('execution reverted') || 
            error.message.includes('invalid opcode') ||
            error.code === 'CALL_EXCEPTION') {
          // No more events, break the loop
          continue;
        }
        console.warn(`Error fetching event ${i}:`, error.message);
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
router.post('/:eventId/purchase', asyncHandler(async (req, res) => {
  const eventId = req.params.eventId;
  const { tierId, attendeeCount = 1, buyerAddress, signature, message, tokenType } = req.body;

  if (tierId === undefined || !attendeeCount || !buyerAddress || !signature || !message) {
    return res.status(400).json({ 
      error: 'Missing required fields: tierId, attendeeCount, buyerAddress, signature, message'
    });
  }

  if (attendeeCount < 1 || attendeeCount > 10) {
    return res.status(400).json({ 
      error: 'Attendee count must be between 1 and 10'
    });
  }

  // Verify the signature
  try {
    const signerAddress = ethers.utils.verifyMessage(message, signature);
    if (signerAddress.toLowerCase() !== buyerAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Signature verification error:', error);
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  const contract = getEventManagerContract();
  
  if (!contract) {
    return res.status(500).json({ 
      error: 'Contract not configured',
      details: 'EVENT_MANAGER_CONTRACT environment variable not set' 
    });
  }

  try {
    // Get ticket tier details
    const tierData = await contract.getTicketTier(eventId, parseInt(tierId));
    const pricePerPerson = tierData[1];
    const maxSupply = parseInt(tierData[2].toString());
    const currentSupply = parseInt(tierData[3].toString());
    const available = maxSupply - currentSupply;

    if (available < attendeeCount) {
      return res.status(400).json({ error: 'Tickets sold out for this tier' });
    }

    const totalPrice = pricePerPerson.mul(attendeeCount);

    // Generate metadata URI for the ticket (QR code will include this info)
    const ticketMetadata = {
      eventId: eventId,
      tierId: parseInt(tierId),
      attendeeCount: parseInt(attendeeCount),
      buyer: buyerAddress,
      purchaseTime: Math.floor(Date.now() / 1000),
      totalPrice: ethers.utils.formatEther(totalPrice),
      pricePerPerson: ethers.utils.formatEther(pricePerPerson),
      qrData: `${eventId}-${tierId}-${attendeeCount}-${buyerAddress}-${Date.now()}`
    };

    const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(ticketMetadata)).toString('base64')}`;

    // Return purchase information (in production, this would trigger the actual transaction)
    res.json({
      success: true,
      purchaseDetails: {
        eventId: eventId,
        tierId: parseInt(tierId),
        attendeeCount: parseInt(attendeeCount),
        pricePerPerson: ethers.utils.formatEther(pricePerPerson),
        totalPrice: ethers.utils.formatEther(totalPrice),
        tokenType: ['XFI', 'XUSD', 'MPX'][parseInt(tierData[4].toString())],
        metadataURI: metadataURI,
        qrCode: ticketMetadata.qrData,
        message: `Ready to purchase ticket for ${attendeeCount} attendee${attendeeCount > 1 ? 's' : ''} - confirm transaction in your wallet`
      }
    });

  } catch (error) {
    console.error('Error processing purchase:', error);
    res.status(500).json({ 
      error: 'Failed to process ticket purchase',
      details: error.message 
    });
  }
}));

function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

export default router;
