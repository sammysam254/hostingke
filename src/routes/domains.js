const express = require('express');
const Project = require('../models/Project');
const SSLService = require('../services/ssl');

const router = express.Router();

// Get all domains for user's projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user.id });
    
    const allDomains = [];
    projects.forEach(project => {
      project.domains.forEach(domain => {
        allDomains.push({
          ...domain.toObject(),
          projectId: project._id,
          projectName: project.name
        });
      });
    });

    res.json(allDomains);
  } catch (error) {
    console.error('Get domains error:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// Add custom domain to project
router.post('/', async (req, res) => {
  try {
    const { projectId, domain } = req.body;

    if (!domain || !projectId) {
      return res.status(400).json({ error: 'Project ID and domain are required' });
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if domain already exists
    const existingDomain = project.domains.find(d => d.domain === domain);
    if (existingDomain) {
      return res.status(400).json({ error: 'Domain already added to this project' });
    }

    // Check if domain exists in other projects
    const domainExists = await Project.findOne({
      'domains.domain': domain,
      _id: { $ne: projectId }
    });

    if (domainExists) {
      return res.status(400).json({ error: 'Domain is already used by another project' });
    }

    // Add domain to project
    project.domains.push({
      domain,
      isCustom: true,
      sslEnabled: false,
      verified: false
    });

    await project.save();

    res.json({
      message: 'Domain added successfully',
      domain: project.domains[project.domains.length - 1],
      verificationInstructions: {
        type: 'DNS',
        records: [
          {
            type: 'CNAME',
            name: domain,
            value: `${project.slug}.yourplatform.com`,
            ttl: 300
          }
        ]
      }
    });

  } catch (error) {
    console.error('Add domain error:', error);
    res.status(500).json({ error: 'Failed to add domain' });
  }
});

// Verify domain ownership
router.post('/:domainId/verify', async (req, res) => {
  try {
    const { domainId } = req.params;

    const project = await Project.findOne({
      owner: req.user.id,
      'domains._id': domainId
    });

    if (!project) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const domain = project.domains.id(domainId);
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Verify DNS configuration
    const isVerified = await verifyDNSConfiguration(domain.domain, project.slug);

    if (isVerified) {
      domain.verified = true;
      await project.save();

      // Start SSL certificate provisioning
      try {
        await SSLService.provisionCertificate(domain.domain);
        domain.sslEnabled = true;
        await project.save();
      } catch (sslError) {
        console.error('SSL provisioning failed:', sslError);
      }

      res.json({
        message: 'Domain verified successfully',
        domain: domain.toObject()
      });
    } else {
      res.status(400).json({
        error: 'Domain verification failed',
        message: 'Please ensure DNS records are properly configured'
      });
    }

  } catch (error) {
    console.error('Verify domain error:', error);
    res.status(500).json({ error: 'Domain verification failed' });
  }
});

// Remove domain
router.delete('/:domainId', async (req, res) => {
  try {
    const { domainId } = req.params;

    const project = await Project.findOne({
      owner: req.user.id,
      'domains._id': domainId
    });

    if (!project) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const domain = project.domains.id(domainId);
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Don't allow removal of default domain
    if (!domain.isCustom) {
      return res.status(400).json({ error: 'Cannot remove default domain' });
    }

    // Remove SSL certificate
    if (domain.sslEnabled) {
      try {
        await SSLService.revokeCertificate(domain.domain);
      } catch (sslError) {
        console.error('SSL revocation failed:', sslError);
      }
    }

    // Remove domain from project
    project.domains.pull(domainId);
    await project.save();

    res.json({ message: 'Domain removed successfully' });

  } catch (error) {
    console.error('Remove domain error:', error);
    res.status(500).json({ error: 'Failed to remove domain' });
  }
});

// Get domain configuration
router.get('/:domainId/config', async (req, res) => {
  try {
    const { domainId } = req.params;

    const project = await Project.findOne({
      owner: req.user.id,
      'domains._id': domainId
    });

    if (!project) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const domain = project.domains.id(domainId);
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const config = {
      domain: domain.toObject(),
      dnsRecords: [
        {
          type: 'CNAME',
          name: domain.domain,
          value: `${project.slug}.yourplatform.com`,
          ttl: 300
        }
      ],
      sslStatus: domain.sslEnabled ? 'active' : 'pending',
      verificationStatus: domain.verified ? 'verified' : 'pending'
    };

    res.json(config);

  } catch (error) {
    console.error('Get domain config error:', error);
    res.status(500).json({ error: 'Failed to get domain configuration' });
  }
});

// Helper function to verify DNS configuration
async function verifyDNSConfiguration(domain, expectedTarget) {
  const dns = require('dns').promises;
  
  try {
    const records = await dns.resolveCname(domain);
    return records.some(record => 
      record.includes(expectedTarget) || 
      record.includes('yourplatform.com')
    );
  } catch (error) {
    // Try A record lookup as fallback
    try {
      const aRecords = await dns.resolve4(domain);
      // In real implementation, check if A record points to your server IP
      return aRecords.length > 0;
    } catch (aError) {
      console.error('DNS verification failed:', error);
      return false;
    }
  }
}

module.exports = router;