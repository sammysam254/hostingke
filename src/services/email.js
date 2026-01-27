const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendVerificationEmail(email, token) {
    const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/verify/${token}`;
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@yourplatform.com',
      to: email,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Your Hosting Platform!</h2>
          <p>Please click the button below to verify your email address:</p>
          <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email
          </a>
          <p>Or copy and paste this link in your browser:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent to:', email);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw error;
    }
  }

  async sendDeploymentNotification(email, project, deployment) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@yourplatform.com',
      to: email,
      subject: `Deployment ${deployment.status} - ${project.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Deployment Update</h2>
          <p>Your deployment for <strong>${project.name}</strong> is now <strong>${deployment.status}</strong>.</p>
          ${deployment.status === 'ready' ? `
            <p>🎉 Your site is live at: <a href="${deployment.url}">${deployment.url}</a></p>
            <p>Build time: ${deployment.buildTime}s</p>
          ` : ''}
          ${deployment.status === 'error' ? `
            <p>❌ Deployment failed with error: ${deployment.error?.message}</p>
          ` : ''}
          <p>View full details in your <a href="${process.env.BASE_URL}/dashboard">dashboard</a>.</p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send deployment notification:', error);
    }
  }

  async sendFormSubmission(emails, formData, projectName) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@yourplatform.com',
      to: emails.join(', '),
      subject: `New form submission - ${projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Form Submission</h2>
          <p>You received a new form submission from <strong>${projectName}</strong>:</p>
          <table style="border-collapse: collapse; width: 100%;">
            ${Object.entries(formData).map(([key, value]) => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${key}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${value}</td>
              </tr>
            `).join('')}
          </table>
          <p>Submitted at: ${new Date().toLocaleString()}</p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send form submission notification:', error);
    }
  }
}

module.exports = new EmailService();