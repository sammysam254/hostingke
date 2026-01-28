const express = require('express');
const SupabaseService = require('../services/supabase');
const SSLService = require('../services/ssl');

const router = express.Router();

// Get all domains for user's projects
router.get('/', async (req, res) => {
  try {
    // Get user's projects
    const { data: projects, error: projectsError } = await SupabaseService.getAdminClient()
      .from('projects')
      .select('id, name, domains')
      .eq('owner_id', req.user.id);

    if (projectsError) {
      console.error('Get projects error:', projectsError);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    const allDomains = [];
    projects.forEach(project => {
      const domains = project.domains || [];
      domains.forEach(domain => {
        allDomains.push({
          ...domain,
          project_id: project.id,
          project_name: project.name
        });
      });
    });

    res.json({ domains: allDomains });
  } catch (error) {
    console.error('Get domains error:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// Add custom domain to project
router.post('/', async (req, res) => {
  try {
    const { project_id, domain } = req.body;

    if (!domain || !project_id) {
      return res.status(400).json({ error: 'Project ID and domain are required' });
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    // Get project
    const { data: project, error: projectError } = await SupabaseService.getAdminClient()
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .eq('owner_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if domain already exists
    const existingDomains = project.domains || [];
    const domainExists = existingDomains.some(d => d.domain === domain);
    
    if (domainExists) {
      return res.status(400).json({ error: 'Domain already exists for this project' });
    }

    // Add new domain
    const newDomain = {
      domain,
      is_custom: true,
      ssl_enabled: false,
      verified: false,
      created_at: new Date().toISOString()
    };

    const updatedDomains = [...existingDomains, newDomain];

    // Update project with new domain
    const { error: updateError } = await SupabaseService.getAdminClient()
      .from('projects')
      .update({ domains: updatedDomains })
      .eq('id', project_id);

    if (updateError) {
      console.error('Update project domains error:', updateError);
      return res.status(500).json({ error: 'Failed to add domain' });
    }

    // Start SSL certificate process (async)
    try {
      SSLService.setupSSL(domain, project.slug).catch(err => {
        console.error('SSL setup failed for domain:', domain, err);
      });
    } catch (sslError) {
      console.error('SSL service error:', sslError);
    }

    res.status(201).json({ 
      message: 'Domain added successfully',
      domain: newDomain,
      instructions: {
        dns_records: [
          {
            type: 'CNAME',
            name: domain,
            value: `${project.slug}.hostingke.com`,
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

// Verify domain
router.post('/:domain/verify', async (req, res) => {
  try {
    const { domain } = req.params;

    // Get project with this domain
    const { data: projects, error: projectsError } = await SupabaseService.getAdminClient()
      .from('projects')
      .select('*')
      .eq('owner_id', req.user.id);

    if (projectsError) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    let targetProject = null;
    let domainIndex = -1;

    for (const project of projects) {
      const domains = project.domains || [];
      const index = domains.findIndex(d => d.domain === domain);
      if (index !== -1) {
        targetProject = project;
        domainIndex = index;
        break;
      }
    }

    if (!targetProject) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Verify DNS configuration
    const isVerified = await verifyDNS(domain, `${targetProject.slug}.hostingke.com`);

    if (isVerified) {
      // Update domain as verified
      const updatedDomains = [...targetProject.domains];
      updatedDomains[domainIndex].verified = true;
      updatedDomains[domainIndex].verified_at = new Date().toISOString();

      const { error: updateError } = await SupabaseService.getAdminClient()
        .from('projects')
        .update({ domains: updatedDomains })
        .eq('id', targetProject.id);

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update domain status' });
      }

      // Start SSL certificate process
      try {
        await SSLService.setupSSL(domain, targetProject.slug);
        
        // Update SSL status
        updatedDomains[domainIndex].ssl_enabled = true;
        await SupabaseService.getAdminClient()
          .from('projects')
          .update({ domains: updatedDomains })
          .eq('id', targetProject.id);
      } catch (sslError) {
        console.error('SSL setup failed:', sslError);
      }

      res.json({ 
        message: 'Domain verified successfully',
        verified: true,
        ssl_enabled: updatedDomains[domainIndex].ssl_enabled
      });
    } else {
      res.json({ 
        message: 'Domain verification failed. Please check your DNS configuration.',
        verified: false
      });
    }
  } catch (error) {
    console.error('Verify domain error:', error);
    res.status(500).json({ error: 'Failed to verify domain' });
  }
});

// Helper function to verify DNS
async function verifyDNS(domain, expectedTarget) {
  try {
    const dns = require('dns').promises;
    const records = await dns.resolveCname(domain);
    return records.includes(expectedTarget);
  } catch (error) {
    console.error('DNS verification error:', error);
    return false;
  }
}

module.exports = router;