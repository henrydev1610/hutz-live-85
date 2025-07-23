const express = require('express');
const { AccessToken } = require('twilio').jwt;
const { VideoGrant } = AccessToken;

const router = express.Router();

// Twilio credentials - estas devem estar nas variáveis de ambiente
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;

/**
 * Generate Access Token for Twilio Video
 */
router.post('/token', (req, res) => {
  const { identity, roomName } = req.body;

  if (!identity || !roomName) {
    return res.status(400).json({ 
      error: 'Identity and roomName are required' 
    });
  }

  if (!accountSid || !apiKey || !apiSecret) {
    console.error('Missing Twilio credentials');
    return res.status(500).json({ 
      error: 'Server configuration error' 
    });
  }

  try {
    // Create an access token
    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: identity,
      ttl: 3600 // 1 hour
    });

    // Create a Video grant
    const videoGrant = new VideoGrant({
      room: roomName
    });

    // Add the Video grant to the token
    token.addGrant(videoGrant);

    console.log(`🎫 Generated Twilio token for ${identity} in room ${roomName}`);

    res.json({
      token: token.toJwt(),
      identity: identity,
      roomName: roomName
    });

  } catch (error) {
    console.error('Error generating Twilio token:', error);
    res.status(500).json({ 
      error: 'Failed to generate access token' 
    });
  }
});

/**
 * Get room information
 */
router.get('/room/:roomName', async (req, res) => {
  const { roomName } = req.params;

  if (!roomName) {
    return res.status(400).json({ 
      error: 'Room name is required' 
    });
  }

  try {
    // This would typically fetch room info from Twilio API
    // For now, we'll return basic info
    res.json({
      roomName: roomName,
      status: 'active',
      participants: []
    });

  } catch (error) {
    console.error('Error fetching room info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch room information' 
    });
  }
});

/**
 * Create a new room
 */
router.post('/room', async (req, res) => {
  const { roomName, roomType = 'group' } = req.body;

  if (!roomName) {
    return res.status(400).json({ 
      error: 'Room name is required' 
    });
  }

  try {
    // This would typically create a room via Twilio API
    // For now, we'll return success
    console.log(`🏠 Created Twilio room: ${roomName}`);

    res.json({
      roomName: roomName,
      roomType: roomType,
      status: 'created'
    });

  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ 
      error: 'Failed to create room' 
    });
  }
});

module.exports = router;