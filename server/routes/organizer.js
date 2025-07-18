import express from 'express';
import { ethers } from 'ethers';
import { getEventManagerContract } from '../config/blockchain.js';
import { validateSignature } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

/**
 * @route POST /api/organizer/events
 * @desc Create a new event
 * @access Private (requires signature)
 */
router.post('/events', validateSignature, asyncHandler(async (req, res) => {
  const {
    title,
    description,
    location,
    startDate,
    endDate,
    metadataURI,
    feeTokenType,
    tiers,
    organizerAddress
  } = req.body;

  // Validation
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

  try {
    const contract = getEventManagerContract();

    // In a real implementation, this would return transaction data for the frontend to execute
    // For the MVP, we'll return the structured data needed for the transaction
    
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
      feeTokenType: feeTokenType || 0, // Default to XFI
      organizer: organizerAddress
    };

    // Validate tiers
    const validatedTiers = tiers.map((tier, index) => {
      if (!tier.name || !tier.price || !tier.maxSupply) {
        throw new Error(`Invalid tier ${index}: missing name, price, or maxSupply`);
      }
      
      return {
        name: tier.name,
        price: ethers.parseEther(tier.price.toString()),
        maxSupply: parseInt(tier.maxSupply),
        tokenType: tier.tokenType || 0 // Default to XFI
      };
    });

    // Generate a unique event ID for frontend reference (temporary)
    const tempEventId = Date.now();
    
    // Calculate total listing fee
    const listingFee = ethers.parseEther('0'); // 0 for testing

    res.json({
      success: true,
      eventData,
      tiers: validatedTiers,
      transactionInfo: {
        contractAddress: process.env.EVENT_MANAGER_CONTRACT,
        listingFee: ethers.formatEther(listingFee),
        feeTokenType: eventData.feeTokenType,
        tempEventId,
        publicURL: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/event/${tempEventId}`
      },
      message: 'Event ready to create - confirm transaction in your wallet'
    });

  } catch (error) {
    console.error('Error preparing event creation:', error);
    res.status(500).json({ error: error.message || 'Failed to prepare event creation' });
  }
}));

/**
 * @route GET /api/organizer/events
 * @desc Get events for a specific organizer
 * @access Public
 */
router.get('/events', asyncHandler(async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Organizer address is required' });
  }

  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid organizer address' });
  }

  try {
    // Get events for this organizer by calling the main events endpoint
    const eventsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/events?organizer=${address}`);
    const eventsData = await eventsResponse.json();

    res.json(eventsData);
  } catch (error) {
    console.error('Error fetching organizer events:', error);
    res.status(500).json({ error: 'Failed to fetch organizer events' });
  }
}));

/**
 * @route POST /api/organizer/events/:id/tiers
 * @desc Add a ticket tier to an existing event
 * @access Private (requires signature)
 */
router.post('/events/:id/tiers', validateSignature, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, price, maxSupply, tokenType, organizerAddress } = req.body;

  if (!name || !price || !maxSupply) {
    return res.status(400).json({ 
      error: 'Missing required fields: name, price, maxSupply' 
    });
  }

  try {
    const contract = getEventManagerContract();
    
    // Verify the organizer owns this event
    const eventData = await contract.getEvent(id);
    if (eventData[1].toLowerCase() !== organizerAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Only the event organizer can add tiers' });
    }

    const tierData = {
      eventId: id,
      name,
      price: ethers.parseEther(price.toString()),
      maxSupply: parseInt(maxSupply),
      tokenType: tokenType || 0
    };

    res.json({
      success: true,
      tierData,
      message: 'Tier ready to add - confirm transaction in your wallet'
    });

  } catch (error) {
    console.error('Error preparing tier addition:', error);
    res.status(500).json({ error: 'Failed to prepare tier addition' });
  }
}));

export default router;