const express = require('express');
const Project = require('../models/Project');
const EmailService = require('../services/email');

const router = express.Router();

// Handle form submissions (public endpoint)
router.post('/submit/:projectId/:formName', async (req, res) => {
  try {
    const { projectId, formName } = req.params;
    const formData = req.body;

    // Find project and form configuration
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const form = project.forms.find(f => f.name === formName);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Validate required fields (basic validation)
    if (!formData.email && !formData.name) {
      return res.status(400).json({ error: 'Email or name is required' });
    }

    // Store form submission (in real implementation, save to database)
    const submission = {
      projectId,
      formName,
      data: formData,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    console.log('Form submission received:', submission);

    // Send notification emails
    if (form.notifications && form.notifications.length > 0) {
      try {
        await EmailService.sendFormSubmission(
          form.notifications,
          formData,
          project.name
        );
      } catch (emailError) {
        console.error('Failed to send form notification:', emailError);
      }
    }

    // Send auto-response if email provided
    if (formData.email) {
      try {
        await EmailService.sendAutoResponse(formData.email, project.name);
      } catch (emailError) {
        console.error('Failed to send auto-response:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Form submitted successfully'
    });

  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({ error: 'Form submission failed' });
  }
});

// Get form submissions (authenticated)
router.get('/:projectId/submissions', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // In real implementation, fetch from database
    // For now, return mock data
    const submissions = [
      {
        id: '1',
        formName: 'contact',
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          message: 'Hello, I love your website!'
        },
        timestamp: new Date(Date.now() - 86400000),
        ip: '192.168.1.1'
      },
      {
        id: '2',
        formName: 'newsletter',
        data: {
          email: 'jane@example.com'
        },
        timestamp: new Date(Date.now() - 172800000),
        ip: '192.168.1.2'
      }
    ];

    res.json(submissions);

  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Configure form settings (authenticated)
router.put('/:projectId/forms/:formName', async (req, res) => {
  try {
    const { projectId, formName } = req.params;
    const { notifications, settings } = req.body;

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Find or create form configuration
    let form = project.forms.find(f => f.name === formName);
    
    if (form) {
      // Update existing form
      form.notifications = notifications || form.notifications;
      form.settings = { ...form.settings, ...settings };
    } else {
      // Create new form
      project.forms.push({
        name: formName,
        endpoint: `/api/forms/submit/${projectId}/${formName}`,
        notifications: notifications || [],
        settings: settings || {}
      });
    }

    await project.save();

    res.json({
      message: 'Form configuration updated',
      form: project.forms.find(f => f.name === formName)
    });

  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ error: 'Failed to update form configuration' });
  }
});

module.exports = router;