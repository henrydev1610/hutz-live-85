
const QRCode = require('qrcode');

/**
 * Gera um QR Code como Data URL PNG
 * @param {string} data - Os dados para codificar no QR Code
 * @param {Object} options - Opções de configuração
 * @returns {Promise<string>} - Data URL do QR Code
 */
const generateQRCode = async (data, options = {}) => {
  try {
    const defaultOptions = {
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256,
      errorCorrectionLevel: 'M',
      ...options
    };
    
    const qrDataUrl = await QRCode.toDataURL(data, defaultOptions);
    return qrDataUrl;
    
  } catch (error) {
    console.error('Error generating QR Code:', error);
    throw new Error(`Failed to generate QR Code: ${error.message}`);
  }
};

/**
 * Gera um QR Code como buffer PNG
 * @param {string} data - Os dados para codificar no QR Code
 * @param {Object} options - Opções de configuração
 * @returns {Promise<Buffer>} - Buffer do QR Code
 */
const generateQRCodeBuffer = async (data, options = {}) => {
  try {
    const defaultOptions = {
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256,
      errorCorrectionLevel: 'M',
      ...options
    };
    
    const qrBuffer = await QRCode.toBuffer(data, defaultOptions);
    return qrBuffer;
    
  } catch (error) {
    console.error('Error generating QR Code buffer:', error);
    throw new Error(`Failed to generate QR Code buffer: ${error.message}`);
  }
};

/**
 * Gera um QR Code como SVG string
 * @param {string} data - Os dados para codificar no QR Code
 * @param {Object} options - Opções de configuração
 * @returns {Promise<string>} - SVG string do QR Code
 */
const generateQRCodeSVG = async (data, options = {}) => {
  try {
    const defaultOptions = {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256,
      errorCorrectionLevel: 'M',
      ...options
    };
    
    const qrSvg = await QRCode.toString(data, defaultOptions);
    return qrSvg;
    
  } catch (error) {
    console.error('Error generating QR Code SVG:', error);
    throw new Error(`Failed to generate QR Code SVG: ${error.message}`);
  }
};

module.exports = {
  generateQRCode,
  generateQRCodeBuffer,
  generateQRCodeSVG
};
