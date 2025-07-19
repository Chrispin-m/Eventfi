import { ethers } from 'ethers';

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

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { qrData, organizerAddress } = req.body;

      if (!qrData) {
        return res.status(400).json({ error: 'QR code data is required' });
      }

      // Parse QR code data to extract ticket ID
      const ticketId = extractTicketIdFromQR(qrData);
      
      if (!ticketId) {
        return res.status(400).json({ error: 'Invalid QR code format' });
      }

      // Mock verification for testing
      const verification = {
        valid: true,
        reason: 'Valid ticket'
      };

      return res.status(200).json({
        ticketId,
        valid: verification.valid,
        reason: verification.reason,
        qrData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error verifying ticket:', error);
      return res.status(500).json({ 
        error: 'Failed to verify ticket',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}