const acme = require('acme-client');
const fs = require('fs').promises;
const path = require('path');

class SSLService {
  constructor() {
    this.client = null;
    this.accountKey = null;
    this.certificatesPath = path.join(process.cwd(), 'certificates');
  }

  async initialize() {
    try {
      // Ensure certificates directory exists
      await fs.mkdir(this.certificatesPath, { recursive: true });

      // Create or load account key
      const accountKeyPath = path.join(this.certificatesPath, 'account.key');
      
      try {
        const accountKeyPem = await fs.readFile(accountKeyPath, 'utf8');
        this.accountKey = accountKeyPem;
      } catch {
        // Generate new account key
        this.accountKey = await acme.crypto.createPrivateKey();
        await fs.writeFile(accountKeyPath, this.accountKey);
      }

      // Initialize ACME client
      this.client = new acme.Client({
        directoryUrl: process.env.ACME_DIRECTORY_URL || acme.directory.letsencrypt.production,
        accountKey: this.accountKey
      });

      console.log('✅ SSL Service initialized');
    } catch (error) {
      console.error('❌ SSL Service initialization failed:', error);
      throw error;
    }
  }

  async provisionCertificate(domain) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      console.log(`🔒 Provisioning SSL certificate for ${domain}...`);

      // Create certificate signing request
      const [key, csr] = await acme.crypto.createCsr({
        commonName: domain,
        altNames: [`www.${domain}`]
      });

      // Request certificate
      const cert = await this.client.auto({
        csr,
        email: process.env.ACME_EMAIL,
        termsOfServiceAgreed: true,
        challengeCreateFn: this.createChallenge.bind(this),
        challengeRemoveFn: this.removeChallenge.bind(this)
      });

      // Save certificate and key
      const certPath = path.join(this.certificatesPath, `${domain}.crt`);
      const keyPath = path.join(this.certificatesPath, `${domain}.key`);
      
      await fs.writeFile(certPath, cert);
      await fs.writeFile(keyPath, key);

      console.log(`✅ SSL certificate provisioned for ${domain}`);

      return {
        certificate: cert,
        privateKey: key,
        certPath,
        keyPath
      };

    } catch (error) {
      console.error(`❌ SSL certificate provisioning failed for ${domain}:`, error);
      throw error;
    }
  }

  async createChallenge(authz, challenge, keyAuthorization) {
    console.log(`Creating challenge for ${authz.identifier.value}`);
    
    if (challenge.type === 'http-01') {
      // HTTP challenge - create file in .well-known/acme-challenge/
      const challengePath = path.join(
        process.cwd(), 
        'deployed-sites', 
        '.well-known', 
        'acme-challenge'
      );
      
      await fs.mkdir(challengePath, { recursive: true });
      await fs.writeFile(
        path.join(challengePath, challenge.token),
        keyAuthorization
      );
    } else if (challenge.type === 'dns-01') {
      // DNS challenge - would need to create TXT record
      console.log(`DNS challenge: Create TXT record _acme-challenge.${authz.identifier.value} with value ${keyAuthorization}`);
      
      // In real implementation, use DNS provider API to create record
      // For now, just log the required record
    }
  }

  async removeChallenge(authz, challenge, keyAuthorization) {
    console.log(`Removing challenge for ${authz.identifier.value}`);
    
    if (challenge.type === 'http-01') {
      // Remove challenge file
      const challengeFile = path.join(
        process.cwd(),
        'deployed-sites',
        '.well-known',
        'acme-challenge',
        challenge.token
      );
      
      try {
        await fs.unlink(challengeFile);
      } catch (error) {
        console.error('Failed to remove challenge file:', error);
      }
    }
  }

  async revokeCertificate(domain) {
    try {
      const certPath = path.join(this.certificatesPath, `${domain}.crt`);
      const keyPath = path.join(this.certificatesPath, `${domain}.key`);

      // Read certificate
      const cert = await fs.readFile(certPath, 'utf8');

      // Revoke certificate
      await this.client.revokeCertificate(cert);

      // Remove certificate files
      await fs.unlink(certPath);
      await fs.unlink(keyPath);

      console.log(`✅ SSL certificate revoked for ${domain}`);

    } catch (error) {
      console.error(`❌ SSL certificate revocation failed for ${domain}:`, error);
      throw error;
    }
  }

  async getCertificate(domain) {
    try {
      const certPath = path.join(this.certificatesPath, `${domain}.crt`);
      const keyPath = path.join(this.certificatesPath, `${domain}.key`);

      const [cert, key] = await Promise.all([
        fs.readFile(certPath, 'utf8'),
        fs.readFile(keyPath, 'utf8')
      ]);

      return { certificate: cert, privateKey: key };

    } catch (error) {
      console.error(`Failed to read certificate for ${domain}:`, error);
      return null;
    }
  }

  async renewCertificate(domain) {
    try {
      // Check if certificate needs renewal (expires in < 30 days)
      const cert = await this.getCertificate(domain);
      if (!cert) {
        throw new Error('Certificate not found');
      }

      const certInfo = await acme.crypto.readCertificateInfo(cert.certificate);
      const expiryDate = new Date(certInfo.notAfter);
      const renewalDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now

      if (expiryDate > renewalDate) {
        console.log(`Certificate for ${domain} does not need renewal yet`);
        return cert;
      }

      console.log(`🔄 Renewing SSL certificate for ${domain}...`);

      // Provision new certificate
      const newCert = await this.provisionCertificate(domain);

      console.log(`✅ SSL certificate renewed for ${domain}`);
      return newCert;

    } catch (error) {
      console.error(`❌ SSL certificate renewal failed for ${domain}:`, error);
      throw error;
    }
  }

  async listCertificates() {
    try {
      const files = await fs.readdir(this.certificatesPath);
      const certificates = [];

      for (const file of files) {
        if (file.endsWith('.crt')) {
          const domain = file.replace('.crt', '');
          const certPath = path.join(this.certificatesPath, file);
          
          try {
            const cert = await fs.readFile(certPath, 'utf8');
            const certInfo = await acme.crypto.readCertificateInfo(cert);
            
            certificates.push({
              domain,
              issuer: certInfo.issuer.CN,
              subject: certInfo.subject.CN,
              validFrom: certInfo.notBefore,
              validTo: certInfo.notAfter,
              daysUntilExpiry: Math.ceil((new Date(certInfo.notAfter) - new Date()) / (1000 * 60 * 60 * 24))
            });
          } catch (error) {
            console.error(`Failed to read certificate info for ${domain}:`, error);
          }
        }
      }

      return certificates;

    } catch (error) {
      console.error('Failed to list certificates:', error);
      return [];
    }
  }
}

module.exports = new SSLService();