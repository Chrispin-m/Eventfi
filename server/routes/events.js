import express from 'express';
import { ethers } from 'ethers';

const router = express.Router();

// Mock event data
const mockEvents = [
  {
    id: 1,
    organizer: '0x1f9031A2beA086a591e9872FE3A26F01570A8B2A',
    title: 'CrossFi Developer Conference 2024',
    description: 'Join us for the biggest blockchain developer conference of the year.',
    location: 'San Francisco, CA',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 7,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 8,
    active: true,
    status: 'upcoming'
  }
];

function getEventStatus(startDate, endDate) {
  const now = Math.floor(Date.now() / 1000);
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'live';
  return 'ended';
}

router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// POST /api/events
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      startDate,
      endDate,
      metadataURI,
      feeTokenType,
      tiers,
      organizerAddress,
      signature,
      message
    } = req.body;

    // Validate signature
    if (!signature || !message || !organizerAddress) {
      return res.status(400).json({ 
        error: 'Missing required authentication fields: signature, message, organizerAddress' 
      });
    }

    try {
      const signerAddress = ethers.utils.verifyMessage(message, signature);
      if (signerAddress.toLowerCase() !== organizerAddress.toLowerCase()) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Signature validation failed' });
    }

    // Basic event validation
    if (!title || !description || !location || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, description, location, startDate, endDate' 
      });
    }

    if (new Date(startDate * 1000) <= new Date()) {
      return res.status(400).json({ error: 'Start date must be in the future' });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return res.status(400).json({ error: 'At least one ticket tier is required' });
    }

    // Event metadata
    const eventData = {
      title,
      description,
      location,
      startDate,
      endDate,
      metadataURI: metadataURI || `data:application/json;base64,${Buffer.from(JSON.stringify({
        title,
        description,
        location,
        image: 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg'
      })).toString('base64')}`,
      feeTokenType: feeTokenType || 0,
      organizer: organizerAddress
    };

    // Validate tiers
    const validatedTiers = tiers.map((tier, index) => {
      const pricePerPerson = tier.pricePerPerson || tier.price;

      if (!tier.name || !tier.name.trim()) {
        throw new Error(`Invalid tier ${index}: missing name`);
      }

      if (!pricePerPerson || Number(pricePerPerson) <= 0) {
        throw new Error(`Invalid tier ${index}: missing or invalid price`);
      }

      if (!tier.maxSupply || Number(tier.maxSupply) <= 0) {
        throw new Error(`Invalid tier ${index}: missing name, price, or maxSupply`);
      }

      return {
        name: tier.name,
        pricePerPerson: ethers.utils.parseEther(pricePerPerson.toString()),
        maxSupply: parseInt(tier.maxSupply),
        tokenType: tier.tokenType || 0
      };
    });

    // Simulated listing fee and event ID
    const listingFee = ethers.utils.parseEther('1');
    const tempEventId = Date.now();

    return res.status(200).json({
      success: true,
      eventData,
      tiers: validatedTiers,
      transactionInfo: {
        contractAddress: process.env.EVENT_MANAGER_CONTRACT,
        listingFee: ethers.utils.formatEther(listingFee),
        feeTokenType: eventData.feeTokenType,
        tempEventId,
        publicURL: `${process.env.VERCEL_URL || 'http://localhost:3000'}/event/${tempEventId}`
      },
      message: 'Event ready to create - confirm transaction in your wallet'
    });

  } catch (error) {
    console.error('Error preparing event creation:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to prepare event creation',
      details: error.message 
    });
  }
});

// GET /api/events
router.get('/', (req, res) => {
  const eventsWithStatus = mockEvents.map(event => ({
    ...event,
    status: getEventStatus(event.startDate, event.endDate)
  }));

  res.json(eventsWithStatus);
});

export default router;
