import { ethers } from 'ethers';

// Mock user tickets data - in production this would come from blockchain/database
const mockUserTickets = {
  '0x1f9031A2beA086a591e9872FE3A26F01570A8B2A': [
    {
      id: 1,
      eventId: 1,
      eventTitle: 'CrossFi Developer Conference 2024',
      eventLocation: 'San Francisco, CA',
      eventStartDate: Math.floor(Date.now() / 1000) + 86400 * 7,
      eventEndDate: Math.floor(Date.now() / 1000) + 86400 * 8,
      tierName: 'VIP',
      price: '0.5',
      tokenType: 'XFI',
      purchaseTime: Math.floor(Date.now() / 1000) - 86400,
      used: false,
      valid: true,
      status: 'upcoming'
    },
    {
      id: 2,
      eventId: 2,
      eventTitle: 'DeFi Summit 2024',
      eventLocation: 'New York, NY',
      eventStartDate: Math.floor(Date.now() / 1000) + 86400 * 14,
      eventEndDate: Math.floor(Date.now() / 1000) + 86400 * 15,
      tierName: 'Standard',
      price: '0.2',
      tokenType: 'XUSD',
      purchaseTime: Math.floor(Date.now() / 1000) - 86400 * 2,
      used: false,
      valid: true,
      status: 'upcoming'
    }
  ]
};

function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

async function generateTicketQR(ticketId, eventId) {
  try {
    const qrData = JSON.stringify({
      ticketId: parseInt(ticketId),
      eventId: eventId ? parseInt(eventId) : null,
      platform: 'CrossFi-Tickets',
      timestamp: Math.floor(Date.now() / 1000)
    });

    // In a real implementation, you'd use a QR code library
    // For now, return a data URL that represents the QR code
    return `data:image/svg+xml;base64,${Buffer.from(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="white"/>
        <rect x="20" y="20" width="160" height="160" fill="black"/>
        <rect x="40" y="40" width="120" height="120" fill="white"/>
        <text x="100" y="105" text-anchor="middle" font-family="Arial" font-size="12" fill="black">
          Ticket #${ticketId}
        </text>
      </svg>
    `).toString('base64')}`;
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
      const { address } = req.query;

      if (!address) {
        return res.status(400).json({ error: 'User address is required' });
      }

      if (!ethers.utils.isAddress(address)) {
        return res.status(400).json({ error: 'Invalid user address' });
      }

      console.log(`Fetching tickets for user: ${address}`);

      // Get user tickets (mock data for now)
      const userTickets = mockUserTickets[address] || [];

      // Generate QR codes for tickets
      const ticketsWithQR = await Promise.all(
        userTickets.map(async (ticket) => {
          const qrCode = await generateTicketQR(ticket.id, ticket.eventId);
          return {
            ...ticket,
            qrCode,
            status: getEventStatus(ticket.eventStartDate, ticket.eventEndDate)
          };
        })
      );

      console.log(`Found ${ticketsWithQR.length} tickets for user ${address}`);

      return res.status(200).json({
        tickets: ticketsWithQR,
        totalTickets: ticketsWithQR.length,
        userAddress: address
      });

    } catch (error) {
      console.error('Error fetching user tickets:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch user tickets',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}