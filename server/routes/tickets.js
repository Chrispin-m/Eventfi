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
        // complete ticket information from blockchain
        const ticketInfo = await contract.getTicketInfo(ticketId.toString());
        console.log('Raw ticketInfo:', ticketInfo);
        
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

        // BigNumbers to numbers
        const eventId = parseInt(eventIdBN.toString());
        const tierId = parseInt(tierIdBN.toString());
        const attendeeCount = parseInt(attendeeCountBN.toString());
        const totalAmountPaid = ethers.utils.formatEther(totalAmountPaidBN);
        const purchaseTimestamp = parseInt(purchaseTimestampBN.toString());
        
        // Get event details
        const eventData = await contract.getEvent(eventId.toString());
        const [
          eventIdData,
          eventOrganizer,
          eventTitle,
          eventDescription,
          eventLocation,
          eventStartDateBN,
          eventEndDateBN,
          eventMetadataURI,
          eventActive,
          eventTierCountBN
        ] = eventData;
        
        // tier details
        const tierData = await contract.getTicketTier(eventId.toString(), tierId.toString());
        const [
          tierName,
          pricePerPersonBN,
          maxSupplyBN,
          currentSupplyBN,
          tokenTypeUint,
          tierActive
        ] = tierData;
        
        // Map token types
        const tokenTypes = ['XFI', 'XUSD', 'MPX'];
        const tokenType = tokenTypes[parseInt(paymentTokenUint)] || 'XFI';
        const tierTokenType = tokenTypes[parseInt(tokenTypeUint)] || 'XFI';
        
        // Map event statuses
        const eventStatuses = ['upcoming', 'live', 'ended'];
        const eventStatusAtPurchase = eventStatuses[parseInt(eventStatusAtPurchaseUint)] || 'upcoming';
        const currentEventStatus = eventStatuses[parseInt(currentEventStatusUint)] || 'upcoming';
        
        const ticket = {
          id: parseInt(idBN.toString()),
          eventId,
          eventTitle,
          eventLocation: eventLocation,
          eventStartDate: parseInt(eventStartDateBN.toString()),
          eventEndDate: parseInt(eventEndDateBN.toString()),
          tierName,
          pricePerPerson: ethers.utils.formatEther(pricePerPersonBN),
          attendeeCount,
          totalAmountPaid,
          tokenType,
          purchaseTime: purchaseTimestamp,
          used,
          valid,
          validationReason: reason,
          eventStatusAtPurchase,
          currentEventStatus,
          purchaser,
          status: getEventStatus(
            parseInt(eventStartDateBN.toString()), 
            parseInt(eventEndDateBN.toString())
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
  const { address, signature, message } = req.query;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket ID' });
  }

  // Verify required authentication parameters
  if (!address || !signature || !message) {
    return res.status(401).json({
      error: 'Please connect your wallet and access this ticket through "My Tickets"',
      solution: 'Go to your profile and access tickets from your purchase history'
    });
  }

  // Parse and validate message format
  const messagePattern = /^Accessing ticket (\d+) at (\d+)$/;
  const match = message.match(messagePattern);
  
  if (!match) {
    return res.status(400).json({ 
      error: 'Invalid message format',
      requiredFormat: 'Accessing ticket {id} at {timestamp}'
    });
  }

  // Verify ticket ID consistency
  const [_, msgId, timestamp] = match;
  if (parseInt(msgId) !== parseInt(id)) {
    return res.status(403).json({
      error: 'Ticket ID mismatch',
      detail: 'Message references different ticket'
    });
  }

  // Verify message timestamp (5-minute validity window)
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(currentTime - parseInt(timestamp));
  
  if (timeDiff > 300) {
    return res.status(401).json({
      error: 'Expired signature',
      detail: `Signature is ${timeDiff} seconds old (max 300 allowed)`
    });
  }

  try {
    // Verify cryptographic signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({
        error: 'Signature verification failed',
        detail: 'Signer address does not match provided address'
      });
    }

    const contract = getEventManagerContract();
    if (!contract) {
      return res.status(500).json({ 
        error: 'Blockchain connection error' 
      });
    }

    const ticketInfo = await contract.getTicketInfo(id);
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

    // Verify purchaser ownership
    if (purchaser.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({
        error: 'Access denied',
        detail: 'Connected wallet does not own this ticket'
      });
    }

    const eventId = parseInt(eventIdBN.toString());
    const tierId = parseInt(tierIdBN.toString());
    
    // Get event details
    const eventData = await contract.getEvent(eventId.toString());
    const [
      eventIdData,
      eventOrganizer,
      eventTitle,
      eventDescription,
      eventLocation,
      eventStartDateBN,
      eventEndDateBN,
      eventMetadataURI,
      eventActive,
      eventTierCountBN
    ] = eventData;
    
    // Get tier details
    const tierData = await contract.getTicketTier(eventId.toString(), tierId.toString());
    const [
      tierName,
      pricePerPersonBN,
      maxSupplyBN,
      currentSupplyBN,
      tokenTypeUint,
      tierActive
    ] = tierData;
    
    // Map token types
    const tokenTypes = ['XFI', 'XUSD', 'MPX'];
    const tokenType = tokenTypes[parseInt(paymentTokenUint)] || 'XFI';
    
    // Map event statuses
    const eventStatuses = ['upcoming', 'live', 'ended'];
    const eventStatusAtPurchase = eventStatuses[parseInt(eventStatusAtPurchaseUint)] || 'upcoming';
    const currentEventStatus = eventStatuses[parseInt(currentEventStatusUint)] || 'upcoming';
    
    const ticketData = {
      id: parseInt(idBN.toString()),
      eventId,
      eventTitle,
      eventLocation,
      eventStartDate: parseInt(eventStartDateBN.toString()),
      eventEndDate: parseInt(eventEndDateBN.toString()),
      tierName,
      pricePerPerson: ethers.utils.formatEther(pricePerPersonBN),
      attendeeCount: parseInt(attendeeCountBN.toString()),
      totalAmountPaid: ethers.utils.formatEther(totalAmountPaidBN),
      tokenType,
      purchaseTime: parseInt(purchaseTimestampBN.toString()),
      used,
      valid,
      validationReason: reason,
      eventStatusAtPurchase,
      currentEventStatus,
      purchaser,
      qrCode: await generateTicketQR({
        id: parseInt(idBN.toString()),
        eventId,
        attendeeCount: parseInt(attendeeCountBN.toString()),
        purchaser,
        totalAmountPaid: ethers.utils.formatEther(totalAmountPaidBN),
        tokenType,
        purchaseTime: parseInt(purchaseTimestampBN.toString()),
        currentEventStatus
      }),
      blockchainVerified: true,
      purchaserVerified: true,
      signatureValid: true,
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
/**
 * @route POST /api/tickets/verify
 * @desc Verify a ticket using QR code data (enhanced with full ticket info)
 * @access Public
 */
/**
 * @route POST /api/tickets/verify
 * @desc Verify a ticket using QR code data (enhanced with full ticket info)
 * @access Public
 */
/**
 * @route POST /api/tickets/verify
 * @desc Verify a ticket using QR code data
 * @access Public
 */
router.post('/verify', asyncHandler(async (req, res) => {
  const { qrData, organizerAddress } = req.body;
  console.log('📩 [VERIFY] Incoming request body:', req.body);

  if (!qrData || !organizerAddress) {
    console.warn('❌ Missing required fields in request');
    return res.status(400).json({ 
      error: 'Both qrData and organizerAddress are required' 
    });
  }

  try {
    // Parse QR data
    const ticketData = extractTicketDataFromQR(qrData);
    console.log('🔍 Parsed ticket data from QR:', ticketData);

    if (!ticketData?.ticketId || !ticketData?.eventId) {
      console.warn('⚠️ Invalid QR data structure:', ticketData);
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    // Get contract instance
    const contract = getEventManagerContract();
    if (!contract) {
      console.error('🚫 Contract not initialized');
      return res.status(500).json({ error: 'Contract configuration error' });
    }

    // Fetch ticket info from blockchain
    console.log(`🔗 Fetching ticket info for ticketId ${ticketData.ticketId}...`);
    const ticketInfo = await contract.getTicketInfo(ticketData.ticketId);
    console.log('🎟️ Raw ticketInfo from contract:', ticketInfo);

    // Validate ticket info structure
    if (!Array.isArray(ticketInfo) || ticketInfo.length < 13) {
      console.error('🚫 Invalid ticket data structure from contract');
      return res.status(500).json({ error: 'Invalid ticket data from blockchain' });
    }

    // Destructure ticket info
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

    // Fetch event and tier data
    console.log(`📅 Fetching event ${eventId.toString()} and tier ${tierId.toString()} data...`);
    const eventArray = await contract.getEvent(eventId.toString());
    const tierArray = await contract.getTicketTier(eventId.toString(), tierId.toString());
    
    console.log('📄 Raw eventData:', eventArray);
    console.log('💺 Raw tierData:', tierArray);

    // Validate and map event data
    if (!Array.isArray(eventArray) || eventArray.length < 10) {
      console.error('🚫 Invalid event data structure from contract');
      return res.status(500).json({ error: 'Invalid event data from blockchain' });
    }
    
    const eventData = {
      id: eventArray[0],
      organizer: eventArray[1],
      title: eventArray[2],
      description: eventArray[3],
      location: eventArray[4],
      startDate: eventArray[5],
      endDate: eventArray[6],
      metadataURI: eventArray[7],
      isActive: eventArray[8],
      currentTierId: eventArray[9]
    };

    // Validate and map tier data
    if (!Array.isArray(tierArray) || tierArray.length < 6) {
      console.error('🚫 Invalid tier data structure from contract');
      return res.status(500).json({ error: 'Invalid tier data from blockchain' });
    }
    
    const tierData = {
      name: tierArray[0],
      pricePerPerson: tierArray[1],
      maxSupply: tierArray[2],
      eventId: tierArray[3],
      id: tierArray[4],
      isActive: tierArray[5]
    };

    // Prepare verification response
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
      tokenType: ['XFI', 'XUSD', 'MPX'][paymentToken] || 'Unknown',
      purchaseTimestamp: purchaseTimestamp.toNumber(),
      purchaser,
      used,
      valid,
      validationReason: reason,
      eventStatusAtPurchase: ['upcoming', 'live', 'ended'][eventStatusAtPurchase] || 'unknown',
      currentEventStatus: ['upcoming', 'live', 'ended'][currentEventStatus] || 'unknown',
      timestamp: new Date().toISOString(),
      blockchainVerified: true
    };

    console.log('✅ Verification result:', verificationResult);
    res.json(verificationResult);

  } catch (error) {
    console.error('🔥 Error during ticket verification:', error);

    // Handle specific blockchain errors
    if (error.message.includes('Ticket does not exist')) {
      return res.status(404).json({ 
        error: 'Ticket not found',
        valid: false,
        reason: 'Ticket does not exist on blockchain'
      });
    }
    
    if (error.message.includes('Event does not exist')) {
      return res.status(404).json({ 
        error: 'Event not found',
        valid: false,
        reason: 'Associated event does not exist'
      });
    }
    
    // Generic error response
    return res.status(500).json({ 
      error: 'Internal server error during verification',
      details: error.message 
    });
  }
}));

/**
 * @route POST /api/tickets/staff-verify
 * @desc Verify a ticket using staff member credentials (enhanced)
 * @access Public
 */
router.post('/staff-verify', asyncHandler(async (req, res) => {
  const { qrData, staffCode, eventId } = req.body;
  console.log(`📩 [STAFF-VERIFY] Incoming request body: ${JSON.stringify(req.body)}`);

  if (!qrData || !staffCode || !eventId) {
    console.warn('❌ [STAFF-VERIFY] Missing qrData, staffCode or eventId');
    return res.status(400).json({ error: 'QR code data, staff code, and event ID are required' });
  }

  let ticketData;
  try {
    ticketData = extractTicketDataFromQR(qrData);
    console.log(`🔍 [STAFF-VERIFY] Parsed ticketData: ${JSON.stringify(ticketData)}`);
  } catch (parseErr) {
    console.warn('⚠️ [STAFF-VERIFY] QR parse error:', parseErr.message);
    return res.status(400).json({ error: 'Invalid QR code format' });
  }

  if (!ticketData.ticketId) {
    console.warn('⚠️ [STAFF-VERIFY] Missing ticketId in parsed data');
    return res.status(400).json({ error: 'Invalid QR code format' });
  }

  const expectedStaffCode = `STAFF-${eventId}`;
  if (staffCode !== expectedStaffCode) {
    console.warn(`🚫 [STAFF-VERIFY] Invalid staffCode. Expected ${expectedStaffCode}`);
    return res.status(401).json({ error: 'Invalid staff code' });
  }
  console.log('✅ [STAFF-VERIFY] Staff code validated');

  const contract = getEventManagerContract();
  if (!contract) {
    console.error('🚫 [STAFF-VERIFY] Contract not configured');
    return res.status(500).json({ error: 'Contract not configured' });
  }
  console.log(`🔗 [STAFF-VERIFY] Using EventManager at ${contract.address}`);

  try {
    console.log(`🔗 [STAFF-VERIFY] Fetching ticketInfo for ticketId=${ticketData.ticketId}`);
    const ticketInfo = await contract.getTicketInfo(ticketData.ticketId);
    console.log('🎟️ [STAFF-VERIFY] Raw ticketInfo:', ticketInfo);

    // Destructure ticket tuple
    const [
      idBN,
      ticketEventIdBN,
      tierIdBN,
      purchaser,
      attendeeCountBN,
      totalAmountPaidBN,
      purchaseTimestampBN,
      paymentTokenIdx,
      used,
      eventStatusAtPurchaseIdx,
      currentEventStatusIdx,
      valid,
      reason
    ] = ticketInfo;

    const ticketEventId = ticketEventIdBN.toNumber();
    if (ticketEventId !== Number(eventId)) {
      console.warn(`⚠️ [STAFF-VERIFY] ticketEventId(${ticketEventId}) ≠ eventId(${eventId})`);
      return res.status(400).json({
        error: 'Ticket does not belong to this event',
        valid: false,
        reason: 'Invalid event for this ticket'
      });
    }
    console.log('✅ [STAFF-VERIFY] Ticket-event match confirmed');

    console.log(`📅 [STAFF-VERIFY] Fetching event(${ticketEventId}) and tier(${tierIdBN.toNumber()}) data`);
    const eventData = await contract.getEvent(ticketEventId);
    const tierData = await contract.getTicketTier(ticketEventId, tierIdBN.toNumber());
    console.log('📄 [STAFF-VERIFY] Raw eventData:', eventData);
    console.log('💺 [STAFF-VERIFY] Raw tierData:', tierData);

    // Destructure event tuple
    const [
      eventIdDataBN,
      organizerOnChain,
      eventTitle,
      eventDescription,
      eventLocation,
      startDateBN,
      endDateBN,
      metadataURI,
      eventActive,
      tierCountBN
    ] = eventData;

    // Destructure tier tuple
    const [
      tierName,
      pricePerPersonBN,
      maxSupplyBN,
      currentSupplyBN,
      tierPaymentTokenIdx,
      tierActive
    ] = tierData;

    const verificationResult = {
      ticketId: idBN.toNumber(),
      eventId: ticketEventId,
      eventTitle,
      eventLocation,
      eventStartDate: startDateBN.toNumber(),
      eventEndDate: endDateBN.toNumber(),
      tierName,
      attendeeCount: attendeeCountBN.toNumber(),
      totalAmountPaid: ethers.utils.formatEther(totalAmountPaidBN),
      pricePerPerson: ethers.utils.formatEther(pricePerPersonBN),
      tokenType: ['XFI', 'XUSD', 'MPX'][paymentTokenIdx] ?? 'XFI',
      purchaseTimestamp: purchaseTimestampBN.toNumber(),
      purchaser,
      used,
      valid,
      validationReason: reason,
      eventStatusAtPurchase: ['upcoming', 'live', 'ended'][eventStatusAtPurchaseIdx] ?? 'upcoming',
      currentEventStatus: ['upcoming', 'live', 'ended'][currentEventStatusIdx] ?? 'upcoming',
      qrData,
      timestamp: new Date().toISOString(),
      staffVerified: true,
      blockchainVerified: true
    };

    console.log('✅ [STAFF-VERIFY] verificationResult:', verificationResult);
    return res.json(verificationResult);

  } catch (error) {
    console.error('🔥 [STAFF-VERIFY] Error during staff verification:', error.message);
    if (error.message.includes('Ticket does not exist')) {
      return res.status(404).json({
        error: 'Ticket not found',
        valid: false,
        reason: 'Ticket does not exist on blockchain'
      });
    }
    return res.status(500).json({ error: 'Failed to verify ticket', details: error.message });
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
