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
    
    // Get user's ticket IDs from blockchain
    const userTicketIds = await contract.getUserTickets(address);
    console.log(`Found ${userTicketIds.length} ticket IDs for user`);
    
    const tickets = [];
    
    for (const ticketId of userTicketIds) {
      try {
        // Get complete ticket information from blockchain
        const ticketInfo = await contract.getTicketInfo(ticketId.toString());
        
        // Get event details
        const eventData = await contract.getEvent(ticketInfo.eventId.toString());
        
        // Get tier details
        const tierData = await contract.getTicketTier(ticketInfo.eventId.toString(), ticketInfo.tierId.toString());
        
        const ticket = {
          id: parseInt(ticketInfo.id.toString()),
          eventId: parseInt(ticketInfo.eventId.toString()),
          eventTitle: eventData[2], // title
          eventLocation: eventData[4], // location
          eventStartDate: parseInt(eventData[5].toString()),
          eventEndDate: parseInt(eventData[6].toString()),
          tierName: tierData[0], // name
          pricePerPerson: ethers.utils.formatEther(tierData[1]), // pricePerPerson
          attendeeCount: parseInt(ticketInfo.attendeeCount.toString()),
          totalAmountPaid: ethers.utils.formatEther(ticketInfo.totalAmountPaid),
          tokenType: ['XFI', 'XUSD', 'MPX'][parseInt(ticketInfo.paymentToken.toString())],
          purchaseTime: parseInt(ticketInfo.purchaseTimestamp.toString()),
          used: ticketInfo.used,
          valid: ticketInfo.valid,
          validationReason: ticketInfo.reason,
          eventStatusAtPurchase: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.eventStatusAtPurchase.toString())],
          currentEventStatus: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.currentEventStatus.toString())],
          purchaser: ticketInfo.purchaser,
          status: getEventStatus(parseInt(eventData[5].toString()), parseInt(eventData[6].toString()))
        };
        
        tickets.push(ticket);
        
      } catch (error) {
        console.warn(`Error fetching ticket ${ticketId}:`, error.message);
        // Skip invalid tickets but continue processing others
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
    
    // Get event details
    const eventData = await contract.getEvent(ticketInfo.eventId.toString());
    
    // Get tier details
    const tierData = await contract.getTicketTier(ticketInfo.eventId.toString(), ticketInfo.tierId.toString());
    
    const ticketData = {
      id: parseInt(ticketInfo.id.toString()),
      eventId: parseInt(ticketInfo.eventId.toString()),
      eventTitle: eventData[2],
      eventLocation: eventData[4],
      eventStartDate: parseInt(eventData[5].toString()),
      eventEndDate: parseInt(eventData[6].toString()),
      tierName: tierData[0],
      pricePerPerson: ethers.utils.formatEther(tierData[1]),
      attendeeCount: parseInt(ticketInfo.attendeeCount.toString()),
      totalAmountPaid: ethers.utils.formatEther(ticketInfo.totalAmountPaid),
      tokenType: ['XFI', 'XUSD', 'MPX'][parseInt(ticketInfo.paymentToken.toString())],
      purchaseTime: parseInt(ticketInfo.purchaseTimestamp.toString()),
      used: ticketInfo.used,
      valid: ticketInfo.valid,
      validationReason: ticketInfo.reason,
      eventStatusAtPurchase: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.eventStatusAtPurchase.toString())],
      currentEventStatus: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.currentEventStatus.toString())],
      purchaser: ticketInfo.purchaser,
      qrCode: await generateTicketQR({
        id: parseInt(ticketInfo.id.toString()),
        eventId: parseInt(ticketInfo.eventId.toString()),
        attendeeCount: parseInt(ticketInfo.attendeeCount.toString()),
        purchaser: ticketInfo.purchaser,
        totalAmountPaid: ethers.utils.formatEther(ticketInfo.totalAmountPaid),
        tokenType: ['XFI', 'XUSD', 'MPX'][parseInt(ticketInfo.paymentToken.toString())],
        purchaseTime: parseInt(ticketInfo.purchaseTimestamp.toString()),
        currentEventStatus: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.currentEventStatus.toString())]
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
    
    if (!ticketData || !ticketData.ticketId) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    const contract = getEventManagerContract();
    
    if (!contract) {
      return res.status(500).json({ 
        error: 'Contract not configured' 
      });
    }
    
    // Get complete ticket information from blockchain
    const ticketInfo = await contract.getTicketInfo(ticketData.ticketId);
    
    // Get event details
    const eventData = await contract.getEvent(ticketInfo.eventId.toString());
    
    // Get tier details
    const tierData = await contract.getTicketTier(ticketInfo.eventId.toString(), ticketInfo.tierId.toString());
    
    const verificationResult = {
      ticketId: parseInt(ticketInfo.id.toString()),
      eventId: parseInt(ticketInfo.eventId.toString()),
      eventTitle: eventData[2],
      eventLocation: eventData[4],
      eventStartDate: parseInt(eventData[5].toString()),
      eventEndDate: parseInt(eventData[6].toString()),
      tierName: tierData[0],
      attendeeCount: parseInt(ticketInfo.attendeeCount.toString()),
      totalAmountPaid: ethers.utils.formatEther(ticketInfo.totalAmountPaid),
      pricePerPerson: ethers.utils.formatEther(tierData[1]),
      tokenType: ['XFI', 'XUSD', 'MPX'][parseInt(ticketInfo.paymentToken.toString())],
      purchaseTimestamp: parseInt(ticketInfo.purchaseTimestamp.toString()),
      purchaser: ticketInfo.purchaser,
      used: ticketInfo.used,
      valid: ticketInfo.valid,
      reason: ticketInfo.reason,
      eventStatusAtPurchase: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.eventStatusAtPurchase.toString())],
      currentEventStatus: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.currentEventStatus.toString())],
      qrData,
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
    // Parse QR code data to extract ticket information
    const ticketData = extractTicketDataFromQR(qrData);
    
    if (!ticketData || !ticketData.ticketId) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    // Verify staff code (simple implementation - in production use proper authentication)
    const validStaffCode = `STAFF-${eventId}`;
    if (staffCode !== validStaffCode) {
      return res.status(401).json({ error: 'Invalid staff code' });
    }

    const contract = getEventManagerContract();
    
    if (!contract) {
      return res.status(500).json({ 
        error: 'Contract not configured' 
      });
    }
    
    // Get complete ticket information from blockchain
    const ticketInfo = await contract.getTicketInfo(ticketData.ticketId);
    
    // Verify ticket belongs to the specified event
    if (parseInt(ticketInfo.eventId.toString()) !== parseInt(eventId)) {
      return res.status(400).json({ 
        error: 'Ticket does not belong to this event',
        valid: false,
        reason: 'Invalid event for this ticket'
      });
    }
    
    // Get event details
    const eventData = await contract.getEvent(ticketInfo.eventId.toString());
    
    // Get tier details
    const tierData = await contract.getTicketTier(ticketInfo.eventId.toString(), ticketInfo.tierId.toString());
    
    const verificationResult = {
      ticketId: parseInt(ticketInfo.id.toString()),
      eventId: parseInt(ticketInfo.eventId.toString()),
      eventTitle: eventData[2],
      eventLocation: eventData[4],
      eventStartDate: parseInt(eventData[5].toString()),
      eventEndDate: parseInt(eventData[6].toString()),
      tierName: tierData[0],
      attendeeCount: parseInt(ticketInfo.attendeeCount.toString()),
      totalAmountPaid: ethers.utils.formatEther(ticketInfo.totalAmountPaid),
      pricePerPerson: ethers.utils.formatEther(tierData[1]),
      tokenType: ['XFI', 'XUSD', 'MPX'][parseInt(ticketInfo.paymentToken.toString())],
      purchaseTimestamp: parseInt(ticketInfo.purchaseTimestamp.toString()),
      purchaser: ticketInfo.purchaser,
      used: ticketInfo.used,
      valid: ticketInfo.valid,
      reason: ticketInfo.reason,
      eventStatusAtPurchase: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.eventStatusAtPurchase.toString())],
      currentEventStatus: ['upcoming', 'live', 'ended'][parseInt(ticketInfo.currentEventStatus.toString())],
      qrData,
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
    const data = JSON.parse(qrData);
    return {
      ticketId: data.ticketId || null,
      eventId: data.eventId || null,
      attendeeCount: data.attendeeCount || null,
      purchaser: data.purchaser || null,
      totalAmountPaid: data.totalAmountPaid || null,
      tokenType: data.tokenType || null,
      purchaseTimestamp: data.purchaseTimestamp || null,
      eventStatus: data.eventStatus || null
    };
  } catch (error) {
    // Try to extract ticket ID from simple format (backward compatibility)
    const match = qrData.match(/ticketId[:\s]*(\d+)/i);
    return match ? { ticketId: parseInt(match[1]) } : null;
  }
}

function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

export default router;