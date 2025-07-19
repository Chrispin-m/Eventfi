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
      const { qrData, staffCode, eventId } = req.body;

      if (!qrData || !staffCode || !eventId) {
        return res.status(400).json({ error: 'QR code data, staff code, and event ID are required' });
      }

      // Parse QR code data to extract ticket ID
      const ticketId = extractTicketIdFromQR(qrData);
      
      if (!ticketId) {
        return res.status(400).json({ error: 'Invalid QR code format' });
      }

      // Verify staff code (simple implementation)
      const validStaffCode = `STAFF-${eventId}`;
      if (staffCode !== validStaffCode) {
        return res.status(401).json({ error: 'Invalid staff code' });
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
        timestamp: new Date().toISOString(),
        staffVerified: true
      });

    } catch (error) {
      console.error('Error verifying ticket with staff code:', error);
      return res.status(500).json({ 
        error: 'Failed to verify ticket',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}