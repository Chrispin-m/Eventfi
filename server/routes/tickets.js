import express from 'express';
import QRCode from 'qrcode';
import { ethers } from 'ethers';
import { getEventManagerContract } from '../config/blockchain.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

/**
 * @route GET /api/tickets/:id
 * @desc Get ticket details and QR code
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket ID' });
  }

  try {
    const contract = getEventManagerContract();
    
    // Get ticket verification status
    const verification = await contract.verifyTicket(id);
    
    // In a real implementation, you'd fetch ticket details from the contract
    // For MVP, we'll generate basic ticket info
    const ticketData = {
      id: parseInt(id),
      valid: verification[0],
      status: verification[1],
      qrCode: await generateTicketQR(id),
      verification: {
        valid: verification[0],
        reason: verification[1]
      }
    };

    res.json(ticketData);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket details' });
  }
}));

/**
 * @route POST /api/tickets/staff-verify
 * @desc Verify a ticket using staff member credentials
 * @access Public
 */
router.post('/staff-verify', asyncHandler(async (req, res) => {
  const { qrData, staffCode, eventId } = req.body;

  if (!qrData || !staffCode || !eventId) {
    return res.status(400).json({ error: 'QR code data, staff code, and event ID are required' });
  }

  try {
    // Parse QR code data to extract ticket ID
    const ticketId = extractTicketIdFromQR(qrData);
    
    if (!ticketId) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    // Verify staff code (simple implementation - in production use proper authentication)
    const validStaffCode = `STAFF-${eventId}`;
    if (staffCode !== validStaffCode) {
      return res.status(401).json({ error: 'Invalid staff code' });
    }

    const contract = getEventManagerContract();
    const verification = await contract.verifyTicket(ticketId);

    res.json({
      ticketId,
      valid: verification[0],
      reason: verification[1],
      qrData,
      timestamp: new Date().toISOString(),
      staffVerified: true
    });

  } catch (error) {
    console.error('Error verifying ticket with staff code:', error);
    res.status(500).json({ error: 'Failed to verify ticket' });
  }
}));

/**
 * @route POST /api/tickets/verify
 * @desc Verify a ticket using QR code data
 * @access Public
 */
router.post('/verify', asyncHandler(async (req, res) => {
  const { qrData, organizerAddress } = req.body;

  if (!qrData) {
    return res.status(400).json({ error: 'QR code data is required' });
  }

  try {
    // Parse QR code data to extract ticket ID
    const ticketId = extractTicketIdFromQR(qrData);
    
    if (!ticketId) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    const contract = getEventManagerContract();
    const verification = await contract.verifyTicket(ticketId);

    res.json({
      ticketId,
      valid: verification[0],
      reason: verification[1],
      qrData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error verifying ticket:', error);
    res.status(500).json({ error: 'Failed to verify ticket' });
  }
}));

/**
 * @route POST /api/tickets/:id/use
 * @desc Mark a ticket as used (entry)
 * @access Private (organizer only)
 */
router.post('/:id/use', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { organizerAddress, signature } = req.body;

  if (!organizerAddress || !signature) {
    return res.status(400).json({ error: 'Organizer address and signature required' });
  }

  try {
    // Verify organizer signature
    const message = `Use ticket ${id}`;
    const signerAddress = ethers.utils.verifyMessage(message, signature);
    
    if (signerAddress.toLowerCase() !== organizerAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid organizer signature' });
    }

    const contract = getEventManagerContract();
    
    // Return transaction data for the organizer to execute
    res.json({
      success: true,
      ticketId: id,
      organizerAddress,
      transactionData: {
        contractAddress: process.env.EVENT_MANAGER_CONTRACT,
        method: 'verifyAndUseTicket',
        params: [id]
      },
      message: 'Ready to mark ticket as used - confirm transaction in your wallet'
    });

  } catch (error) {
    console.error('Error preparing ticket usage:', error);
    res.status(500).json({ error: 'Failed to prepare ticket usage' });
  }
}));

/**
 * @route GET /api/tickets/generate-qr/:ticketId
 * @desc Generate QR code for a ticket
 * @access Public
 */
router.get('/generate-qr/:ticketId', asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { eventId, tierId } = req.query;

  try {
    const qrData = JSON.stringify({
      ticketId: parseInt(ticketId),
      eventId: eventId ? parseInt(eventId) : null,
      tierId: tierId ? parseInt(tierId) : null,
      timestamp: Math.floor(Date.now() / 1000),
      platform: 'CrossFi-Tickets'
    });

    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });

    res.json({
      qrCode: qrCodeDataURL,
      qrData: qrData,
      ticketId: parseInt(ticketId)
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
}));

// Helper functions
async function generateTicketQR(ticketId) {
  try {
    const qrData = JSON.stringify({
      ticketId: parseInt(ticketId),
      platform: 'CrossFi-Tickets',
      timestamp: Math.floor(Date.now() / 1000)
    });

    return await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 256
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

function extractTicketIdFromQR(qrData) {
  try {
    const data = JSON.parse(qrData);
    return data.ticketId || null;
  } catch (error) {
    // Try to extract ticket ID from simple format
    const match = qrData.match(/ticketId[:\s]*(\d+)/i);
    return match ? parseInt(match[1]) : null;
  }
}

export default router;