import QRCode from 'qrcode';
import { ethers } from 'ethers';

const mockTickets = {
  1: {
    id: 1,
    valid: true,
    status: 'Valid ticket',
    verification: {
      valid: true,
      reason: 'Valid ticket'
    },
    owner: '0xdeAFa17D50dBa6224177FFA396395A7E096f250E' 
  },
  2: {
    id: 2,
    valid: true,
    status: 'Valid ticket',
    verification: {
      valid: true,
      reason: 'Valid ticket'
    },
    owner: '0xdeAFa17D50dBa6224177FFA396395A7E096f250E'
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { id } = req.query;
      const { address } = req.query; // Get address from query params

      if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ticket ID' });
      }

      const ticketId = parseInt(id);
      const ticket = mockTickets[ticketId];

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      if (!address) {
        return res.status(401).json({ error: 'Wallet address required' });
      }

      if (ticket.owner.toLowerCase() !== address.toLowerCase()) {
        return res.status(403).json({ 
          error: 'Access denied',
          details: 'You are not the owner of this ticket'
        });
      }

      const qrCode = await generateTicketQR(ticketId);

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
