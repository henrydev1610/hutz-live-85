// Script para gerar certificado self-signed
const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Gerar certificado self-signed
  execSync(`openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=BR/ST=State/L=City/O=Organization/OU=OrgUnit/CN=172.26.204.230"`, { stdio: 'inherit' });
  
  console.log('✅ Certificado SSL gerado!');
  console.log('📁 Arquivos: cert.pem e key.pem');
  console.log('⚠️  No mobile, aceite o certificado quando solicitado');
} catch (error) {
  console.error('❌ Erro ao gerar certificado:', error.message);
  console.log('💡 Alternativa: Use mkcert ou ngrok para HTTPS');
}