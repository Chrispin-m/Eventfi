import { ethers } from 'ethers';

/**
 * Middleware to validate organizer signatures
 */
export const validateSignature = (req, res, next) => {
  try {
    const { signature, message, address } = req.body;

    if (!signature || !message || !address) {
      return res.status(400).json({ 
        error: 'Missing required authentication fields: signature, message, address' 
      });
    }

    // Verify the signature
    const signerAddress = ethers.verifyMessage(message, signature);
    
    if (signerAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Add verified address to request
    req.verifiedAddress = signerAddress;
    next();
  } catch (error) {
    console.error('Signature validation error:', error);
    res.status(401).json({ error: 'Signature validation failed' });
  }
};

/**
 * Generate a challenge message for signing
 */
export const generateChallengeMessage = (action, timestamp, nonce) => {
  return `CrossFi Ticketing - ${action} - ${timestamp} - ${nonce}`;
};

export default {
  validateSignature,
  generateChallengeMessage
};