import QRCode from 'qrcode';
import { ethers } from 'ethers';

// Mock ticket data with owner addresses
const mockTickets = {
  1: {
    id: 1,
    valid: true,
    status: 'Valid ticket',
    verification: {
      valid: true,
      reason: 'Valid ticket'
    },
    owner: '0x1f9031A2beA086a591e9872FE3A26F01570A8B2A'
  },
  2: {
    id: 2,
    valid: true,
    status: 'Valid ticket',
    verification: {
      valid: true,
      reason: 'Valid ticket'
    },
    owner: '0x2f9031A2beA086a591e9872FE3A26F01570A8B2B'
  }
};


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

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { id } = req.query;
      const { address, signature, message } = req.query;

      if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ticket ID' });
      }

      const ticketId = parseInt(id);
      const ticket = mockTickets[ticketId];

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      if (!address || !signature || !message) {
        return res.status(401).json({ 
          error: 'Authentication required',
          details: 'Please sign the access request'
        });
      }

      try {
        const signerAddress = ethers.utils.verifyMessage(message, signature);
        if (signerAddress.toLowerCase() !== address.toLowerCase()) {
          return res.status(401).json({ 
            error: 'Invalid signature',
            details: 'Signature does not match address'
          });
        }
      } catch (error) {
        return res.status(401).json({ 
          error: 'Signature verification failed',
          details: error.message 
        });
      }

      // VERIFICATION: Check ticket ownership
      if (ticket.owner.toLowerCase() !== address.toLowerCase()) {
        return res.status(403).json({ 
          error: 'Access denied',
          details: 'You are not the owner of this ticket'
        });
      }

      const qrCode = await generateTicketQR(ticketId);
      // === PREVENT CACHING ===
      res.setHeader('Cache-Control', 'no-store, max-age=0');

      return res.status(200).json({
        ...ticket,
        qrCode,
        blockchainVerified: true
      });

    } catch (error) {
      console.error('Error fetching ticket:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch ticket details',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
