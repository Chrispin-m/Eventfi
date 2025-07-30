import express from 'express';
import QRCode from 'qrcode';
import { ethers } from 'ethers';
import { getEventManagerContract } from '../config/blockchain.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

/**
 * @route GET /api/tickets/user/:address
 * @desc Get all tickets for a specific user
 * @access Public
 */
router.get('/user/:address', asyncHandler(async (req, res) => {
  const { address } = req.params;

  if (!address) {
    return res.status(400).json({ error: 'User address is required' });
  }

  if (!ethers.utils.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid user address' });
  }

  try {
    const contract = getEventManagerContract();
    
    if (!contract) {
      return res.status(500).json({ 
        error: 'Contract not configured',
        details: 'EVENT_MANAGER_CONTRACT environment variable not set' 
      });
    }
    
    console.log(`Fetching blockchain-verified tickets for user: ${address}`);
    
    const userTicketIds = await contract.getUserTickets(address);
    console.log(`Found ${userTicketIds.length} ticket IDs for user`);
    
    const tickets = [];
    
    for (const ticketId of userTicketIds) {
      try {
        // Get complete ticket information from blockchain
        const ticketInfo = await contract.getTicketInfo(ticketId);
        
        // Destructure the array response
        const [
          id,
          eventId,
          tierId,
          purchaser,
          attendeeCount,
          totalAmountPaid,
          purchaseTimestamp,
          paymentToken,
          used,
          eventStatusAtPurchase,
          currentEventStatus,
          valid,
          reason
        ] = ticketInfo;

        // Get event details
        const eventData = await contract.getEvent(eventId.toString());
        const {
          id: eventIdData,
          organizer,
          title: eventTitle,
          description,
          location: eventLocation,
          startDate: eventStartDate,
          endDate: eventEndDate,
          metadataURI,
          active: eventActive,
          tierCount
        } = eventData;
        
        // Get tier details
        const tierData = await contract.getTicketTier(eventId.toString(), tierId.toString());
        const {
          name: tierName,
          pricePerPerson,
          maxSupply,
          currentSupply,
          tokenType: tierTokenType,
          active: tierActive
        } = tierData;
        
        // Map token types
        const tokenTypes = ['XFI', 'XUSD', 'MPX'];
        const tokenType = tokenTypes[paymentToken] || 'XFI';
        
        // Map event statuses
        const eventStatuses = ['upcoming', 'live', 'ended'];
        const eventStatusAtPurchaseStr = eventStatuses[eventStatusAtPurchase] || 'upcoming';
        const currentEventStatusStr = eventStatuses[currentEventStatus] || 'upcoming';
        
        const ticket = {
          id: id.toNumber(),
          eventId: eventId.toNumber(),
          eventTitle,
          eventLocation,
          eventStartDate: eventStartDate.toNumber(),
          eventEndDate: eventEndDate.toNumber(),
          tierName,
          pricePerPerson: ethers.utils.formatEther(pricePerPerson),
          attendeeCount: attendeeCount.toNumber(),
          totalAmountPaid: ethers.utils.formatEther(totalAmountPaid),
          tokenType,
          purchaseTime: purchaseTimestamp.toNumber(),
          used,
          valid,
          validationReason: reason,
          eventStatusAtPurchase: eventStatusAtPurchaseStr,
          currentEventStatus: currentEventStatusStr,
          purchaser,
          status: getEventStatus(
            eventStartDate.toNumber(), 
            eventEndDate.toNumber()
          )
        };
        
        tickets.push(ticket);
        
      } catch (error) {
        console.warn(`Error fetching ticket ${ticketId}:`, error.message);
        // Skips invalid tickets but continue processing others
      }
    }
    
    // Generate QR codes for valid tickets
    const ticketsWithQR = await Promise.all(
      tickets.map(async (ticket) => {
        const qrCode = await generateTicketQR(ticket);
        return {
          ...ticket,
          qrCode
        };
      })
    );

    console.log(`Returning ${ticketsWithQR.length} blockchain-verified tickets`);

    res.json({
      tickets: ticketsWithQR,
      totalTickets: ticketsWithQR.length,
      userAddress: address,
      blockchainVerified: true
    });

  } catch (error) {
    console.error('Error fetching user tickets:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user tickets',
      details: error.message 
    });
  }
}));

/**
 * @route GET /api/tickets/:id
 * @desc Get ticket details and QR code (blockchain verified)
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket ID' });
  }

  try {
    const contract = getEventManagerContract();
    
    if (!contract) {
      return res.status(500).json({ 
        error: 'Contract not configured' 
      });
    }
    
    // Get complete ticket information from blockchain
    const ticketInfo = await contract.getTicketInfo(id);
    
    // Destructure the array response
    const [
      idBN,
      eventIdBN,
      tierIdBN,
      purchaser,
      attendeeCountBN,
      totalAmountPaidBN,
      purchaseTimestampBN,
      paymentTokenUint,
      used,
      eventStatusAtPurchaseUint,
      currentEventStatusUint,
      valid,
      reason
    ] = ticketInfo;

    const eventId = eventIdBN.toString();
    const tierId = tierIdBN.toString();
    
    // Get event details
    const eventData = await contract.getEvent(eventId);
    const {
      id: eventIdData,
      organizer,
      title: eventTitle,
      description,
      location: eventLocation,
      startDate: eventStartDate,
      endDate: eventEndDate,
      metadataURI,
      active: eventActive,
      tierCount
    } = eventData;
    
    // Get tier details
    const tierData = await contract.getTicketTier(eventId, tierId);
    const {
      name: tierName,
      pricePerPerson,
      maxSupply,
      currentSupply,
      tokenType: tierTokenType,
      active: tierActive
    } = tierData;
    
    // Map token types
    const tokenTypes = ['XFI', 'XUSD', 'MPX'];
    const tokenType = tokenTypes[paymentTokenUint] || 'XFI';
    
    // Map event statuses
    const eventStatuses = ['upcoming', 'live', 'ended'];
    const eventStatusAtPurchase = eventStatuses[eventStatusAtPurchaseUint] || 'upcoming';
    const currentEventStatus = eventStatuses[currentEventStatusUint] || 'upcoming';
    
    const ticketData = {
      id: idBN.toNumber(),
      eventId: eventIdBN.toNumber(),
      eventTitle,
      eventLocation,
      eventStartDate: eventStartDate.toNumber(),
      eventEndDate: eventEndDate.toNumber(),
      tierName,
      pricePerPerson: ethers.utils.formatEther(pricePerPerson),
      attendeeCount: attendeeCountBN.toNumber(),
      totalAmountPaid: ethers.utils.formatEther(totalAmountPaidBN),
      tokenType,
      purchaseTime: purchaseTimestampBN.toNumber(),
      used,
      valid,
      validationReason: reason,
      eventStatusAtPurchase,
      currentEventStatus,
      purchaser,
      qrCode: await generateTicketQR({
        id: idBN.toNumber(),
        eventId: eventIdBN.toNumber(),
        attendeeCount: attendeeCountBN.toNumber(),
        purchaser,
        totalAmountPaid: ethers.utils.formatEther(totalAmountPaidBN),
        tokenType,
        purchaseTime: purchaseTimestampBN.toNumber(),
        currentEventStatus
      }),
      blockchainVerified: true
    };

    res.json(ticketData);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    if (error.message.includes('Ticket does not exist')) {
      res.status(404).json({ error: 'Ticket not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch ticket details' });
    }
  }
}));

/**
 * @route POST /api/tickets/verify
 * @desc Verify a ticket using QR code data (enhanced with full ticket info)
 * @access Public
 */
router.post('/verify', asyncHandler(async (req, res) => {
  const { qrData, organizerAddress } = req.body;

  if (!qrData) {
    return res.status(400).json({ error: 'QR code data is required' });
  }

  try {
    // Parse QR code data to extract ticket information
    const ticketData = extractTicketDataFromQR(qrData);
    console.log(ticketData);
    
    if (!ticketData || !ticketData.ticketId) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    const contract = getEventManagerContract();
    
    if (!contract) {
      return res.status(500).json({ 
        error: 'Contract not configured' 
      });
    }
    
    // Get ticket info
    const ticketInfo = await contract.getTicketInfo(ticketData.ticketId);

    // Destructure the tuple
    const [
      id, 
      eventId, 
      tierId, 
      purchaser, 
      attendeeCount, 
      totalAmountPaid, 
      purchaseTimestamp, 
      paymentToken, 
      used, 
      eventStatusAtPurchase, 
      currentEventStatus, 
      valid, 
      reason
    ] = ticketInfo;

    // Convert to strings for contract calls
    const eventIdStr = eventId.toString();
    const tierIdStr = tierId.toString();

    // Get event and tier details
    const eventData = await contract.getEvent(eventIdStr);
    const tierData = await contract.getTicketTier(eventIdStr, tierIdStr);

    const verificationResult = {
      ticketId: id.toNumber(),
      eventId: eventId.toNumber(),
      eventTitle: eventData.title,
      eventLocation: eventData.location,
      eventStartDate: eventData.startDate.toNumber(),
      eventEndDate: eventData.endDate.toNumber(),
      tierName: tierData.name,
      attendeeCount: attendeeCount.toNumber(),
      totalAmountPaid: ethers.utils.formatEther(totalAmountPaid),
      pricePerPerson: ethers.utils.formatEther(tierData.pricePerPerson),
      tokenType: ['XFI', 'XUSD', 'MPX'][paymentToken] || 'XFI',
      purchaseTimestamp: purchaseTimestamp.toNumber(),
      purchaser,
      used,
      valid,
      validationReason: reason,
      eventStatusAtPurchase: ['upcoming', 'live', 'ended'][eventStatusAtPurchase] || 'upcoming',
      currentEventStatus: ['upcoming', 'live', 'ended'][currentEventStatus] || 'upcoming',
      timestamp: new Date().toISOString(),
      blockchainVerified: true
    };

    res.json(verificationResult);

  } catch (error) {
    console.error('Error verifying ticket:', error);
    if (error.message.includes('Ticket does not exist')) {
      res.status(404).json({ 
        error: 'Ticket not found',
        valid: false,
        reason: 'Ticket does not exist on blockchain'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to verify ticket',
        details: error.message 
      });
    }
  }
}));

/**
 * @route POST /api/tickets/staff-verify
 * @desc Verify a ticket using staff member credentials (enhanced)
 * @access Public
 */
router.post('/staff-verify', asyncHandler(async (req, res) => {
  const { qrData, staffCode, eventId } = req.body;

  if (!qrData || !staffCode || !eventId) {
    return res.status(400).json({ error: 'QR code data, staff code, and event ID are required' });
  }

  try {
    // Parse QR code data
    const ticketData = extractTicketDataFromQR(qrData);
    
    if (!ticketData || !ticketData.ticketId) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    // Verify staff code
    const validStaffCode = `STAFF-${eventId}`;
    if (staffCode !== validStaffCode) {
      return res.status(401).json({ error: 'Invalid staff code' });
    }

    const contract = getEventManagerContract();
    
    if (!contract) {
      return res.status(500).json({ error: 'Contract not configured' });
    }
    
    // Get ticket info
    const ticketInfo = await contract.getTicketInfo(ticketData.ticketId);

    // Destructure tuple
    const [
      id, 
      ticketEventId, 
      tierId, 
      purchaser, 
      attendeeCount, 
      totalAmountPaid, 
      purchaseTimestamp, 
      paymentToken, 
      used, 
      eventStatusAtPurchase, 
      currentEventStatus, 
      valid, 
      reason
    ] = ticketInfo;

    // Convert to strings for contract calls
    const ticketEventIdStr = ticketEventId.toString();
    const eventIdStr = eventId.toString();
    const tierIdStr = tierId.toString();

    // Verify event match
    if (parseInt(ticketEventIdStr) !== parseInt(eventIdStr)) {
      return res.status(400).json({ 
        error: 'Ticket does not belong to this event',
        valid: false,
        reason: 'Invalid event for this ticket'
      });
    }

    // Get event and tier details
    const eventData = await contract.getEvent(ticketEventIdStr);
    const tierData = await contract.getTicketTier(ticketEventIdStr, tierIdStr);

    const verificationResult = {
      ticketId: id.toNumber(),
      eventId: ticketEventId.toNumber(),
      eventTitle: eventData.title,
      eventLocation: eventData.location,
      eventStartDate: eventData.startDate.toNumber(),
      eventEndDate: eventData.endDate.toNumber(),
      tierName: tierData.name,
      attendeeCount: attendeeCount.toNumber(),
      totalAmountPaid: ethers.utils.formatEther(totalAmountPaid),
      pricePerPerson: ethers.utils.formatEther(tierData.pricePerPerson),
      tokenType: ['XFI', 'XUSD', 'MPX'][paymentToken] || 'XFI',
      purchaseTimestamp: purchaseTimestamp.toNumber(),
      purchaser,
      used,
      valid,
      validationReason: reason,
      eventStatusAtPurchase: ['upcoming', 'live', 'ended'][eventStatusAtPurchase] || 'upcoming',
      currentEventStatus: ['upcoming', 'live', 'ended'][currentEventStatus] || 'upcoming',
      timestamp: new Date().toISOString(),
      staffVerified: true,
      blockchainVerified: true
    };

    res.json(verificationResult);

  } catch (error) {
    console.error('Error verifying ticket with staff code:', error);
    if (error.message.includes('Ticket does not exist')) {
      res.status(404).json({ 
        error: 'Ticket not found',
        valid: false,
        reason: 'Ticket does not exist on blockchain'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to verify ticket',
        details: error.message 
      });
    }
  }
}));

// Helper functions
async function generateTicketQR(ticket) {
  try {
    const qrData = JSON.stringify({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      attendeeCount: ticket.attendeeCount,
      purchaser: ticket.purchaser,
      totalAmountPaid: ticket.totalAmountPaid,
      tokenType: ticket.tokenType,
      purchaseTimestamp: ticket.purchaseTime,
      eventStatus: ticket.currentEventStatus,
      platform: 'CrossFi-Tickets',
      version: '2.0'
    });

    return await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

function extractTicketDataFromQR(qrData) {
  try {
    // Handle both stringified JSON and object
    const data = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    
    return {
      ticketId: data.ticketId ? parseInt(data.ticketId) : null,
      eventId: data.eventId ? parseInt(data.eventId) : null,
      attendeeCount: data.attendeeCount ? parseInt(data.attendeeCount) : null,
      purchaser: data.purchaser || null,
      totalAmountPaid: data.totalAmountPaid || null,
      tokenType: data.tokenType || null,
      purchaseTimestamp: data.purchaseTimestamp ? parseInt(data.purchaseTimestamp) : null,
      eventStatus: data.eventStatus || null
    };
  } catch (error) {
    // Try to extract ticket ID from simple format
    if (typeof qrData === 'string') {
      const match = qrData.match(/ticketId[:\s]*(\d+)/i);
      return match ? { ticketId: parseInt(match[1]) } : null;
    }
    return null;
  }
}

function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

export default router;
