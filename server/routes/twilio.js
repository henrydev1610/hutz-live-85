import { AccessToken } from 'twilio';
const { VideoGrant } = AccessToken;

// Configurações do Twilio (usar variáveis de ambiente em produção)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'your_account_sid';
const TWILIO_API_KEY = process.env.TWILIO_API_KEY || 'your_api_key';
const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET || 'your_api_secret';

export const generateToken = (req, res) => {
  try {
    const { room, identity } = req.body;

    if (!room || !identity) {
      return res.status(400).json({ 
        error: 'Room and identity are required' 
      });
    }

    // Criar Access Token
    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity }
    );

    // Criar Video Grant
    const videoGrant = new VideoGrant({
      room: room
    });

    // Adicionar grant ao token
    token.addGrant(videoGrant);

    // Retornar token JWT
    res.json({
      token: token.toJwt(),
      identity,
      room
    });

  } catch (error) {
    console.error('Error generating Twilio token:', error);
    res.status(500).json({ 
      error: 'Failed to generate access token' 
    });
  }
};