const User = require('../models/User');
const { validationResult } = require('express-validator');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

exports.getUsers = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.query.companyId;
    let query = {};

    if (companyId && companyId !== 'personal') {
      try {
        // Filter users by company
        const Company = require('../models/Company');
        const company = await Company.findById(companyId);

        if (!company) {
          console.log('Company not found:', companyId);
          return res.status(404).json({ error: 'Company not found' });
        }

        // Check if user has access to this company
        const hasCompanyAccess = company.owner.toString() === req.user._id.toString() ||
          company.members.some(member => member.user.toString() === req.user._id.toString());

        if (!hasCompanyAccess) {
          console.log('Access denied to company:', companyId, 'for user:', req.user._id);
          return res.status(403).json({ error: 'Access denied to this company' });
        }

        // Get company owner and members
        const companyUserIds = [
          company.owner,
          ...company.members.map(member => member.user)
        ];

        // Debug logging
        console.log('User Controller Debug:', {
          companyId,
          companyName: company.name,
          companyOwner: company.owner,
          companyMembers: company.members.length,
          companyUserIds: companyUserIds.length,
          requestingUser: req.user._id
        });

        query = { _id: { $in: companyUserIds } };
      } catch (error) {
        console.error('Error filtering users by company:', error);
        return res.status(500).json({ error: 'Error filtering users by company: ' + error.message });
      }
    } else {
      // Personal mode - return all users (for backward compatibility)
      // In a real app, you might want to restrict this further
      query = {};
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get company employees (simplified endpoint)
exports.getCompanyEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const Company = require('../models/Company');
    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user has access to this company
    const hasCompanyAccess = company.owner.toString() === req.user._id.toString() ||
      company.members.some(member => member.user.toString() === req.user._id.toString());

    if (!hasCompanyAccess) {
      return res.status(403).json({ error: 'Access denied to this company' });
    }

    // Get all company user IDs (owner + members)
    const companyUserIds = [
      company.owner,
      ...company.members.map(member => member.user)
    ];

    // Get user details
    const users = await User.find({ _id: { $in: companyUserIds } }).select('-password');

    console.log('Company Employees Debug:', {
      companyId,
      companyName: company.name,
      totalEmployees: users.length,
      employees: users.map(u => ({ id: u._id, name: u.name, email: u.email }))
    });

    res.json(users);
  } catch (error) {
    console.error('Error getting company employees:', error);
    res.status(500).json({ error: 'Error getting company employees: ' + error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, profile } = req.body;

    // Remove base64 images from profile data - don't save them to database
    const cleanProfile = { ...profile };
    if (cleanProfile.profilePicture && cleanProfile.profilePicture.startsWith('data:')) {
      delete cleanProfile.profilePicture;
    }
    if (cleanProfile.coverPhoto && cleanProfile.coverPhoto.startsWith('data:')) {
      delete cleanProfile.coverPhoto;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, profile: cleanProfile },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};

    if (req.files.profilePicture) {
      const file = req.files.profilePicture[0];
      updateData['profile.profilePicture'] = `/uploads/profile-pictures/${file.filename}`;
    }

    if (req.files.coverPhoto) {
      const file = req.files.coverPhoto[0];
      updateData['profile.coverPhoto'] = `/uploads/cover-photos/${file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update user password (superadmin only)
exports.updateUserPassword = async (req, res) => {
  try {
    // Check if the requesting user is a superadmin
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied. Only superadmin can change user passwords.' });
    }

    const { id } = req.params;
    const { password } = req.body;

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Updating password for user:', user.email);
    console.log('Password before update:', user.password.substring(0, 20) + '...');

    // Update password - the pre-save hook will hash it automatically
    user.password = password;
    // Explicitly mark password as modified to ensure pre-save hook runs
    user.markModified('password');
    await user.save();

    console.log('Password after update:', user.password.substring(0, 20) + '...');
    console.log('Password updated successfully for user:', user.email);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.exportResumePDF = async (req, res) => {
  const logFile = '/tmp/pdf-debug.log';
  fs.appendFileSync(logFile, `Export requested for user ID: ${req.params.id}\n`);
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    fs.appendFileSync(logFile, `Launching browser...\n`);
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    fs.appendFileSync(logFile, `Page creation...\n`);
    const page = await browser.newPage();

    const profile = user.profile || {};
    const htmlContent = generateResumeHTML(user);
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 60000 });

    fs.appendFileSync(logFile, `Generating buffer...\n`);
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    fs.appendFileSync(logFile, `Success. Closing browser...\n`);
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${user.name.replace(/\s+/g, '_')}_Resume.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Export Error:', error);
    fs.appendFileSync(logFile, `Error: ${error.message}\n`);
    res.status(500).json({ error: 'Error generating PDF: ' + error.message });
  }
};

const generateResumeHTML = (user) => {
  const profile = user.profile || {};
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (e) { return dateStr; }
  };

  const getFullImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http')) return url;
    // For Puppeteer, use local file system path
    const absolutePath = path.join(__dirname, '..', url.startsWith('/') ? url.substring(1) : url);
    fs.appendFileSync('/tmp/pdf-debug.log', `Checking image at: ${absolutePath}\n`);
    if (fs.existsSync(absolutePath)) {
      return `file://${absolutePath}`;
    }
    return `${baseUrl}${url}`;
  };

  const profilePic = getFullImageUrl(profile.profilePicture);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 0;
          padding: 20px;
          background: white;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 25px;
          margin-bottom: 30px;
        }
        .name {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 5px 0;
          text-transform: uppercase;
        }
        .title {
          font-size: 18px;
          font-weight: 700;
          color: #4f46e5;
          margin: 0 0 15px 0;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        .contact-info {
          display: flex;
          gap: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }
        .contact-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .profile-pic {
          width: 100px;
          height: 100px;
          border-radius: 20px;
          object-fit: cover;
          border: 1px solid #e2e8f0;
        }
        .section {
          margin-bottom: 35px;
        }
        .section-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #94a3b8;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 8px;
          margin-bottom: 15px;
        }
        .summary {
          font-size: 14px;
          color: #334155;
          text-align: justify;
        }
        .exp-item {
          margin-bottom: 20px;
        }
        .exp-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
        }
        .exp-role {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }
        .exp-company {
          font-size: 14px;
          font-weight: 600;
          color: #4f46e5;
          margin-bottom: 8px;
        }
        .exp-date {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
        }
        .exp-desc {
          font-size: 13px;
          color: #475569;
        }
        .skills-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .skill-tag {
          padding: 6px 12px;
          background: #f1f5f9;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }
        .ach-item {
          background: #f8fafc;
          padding: 15px;
          border-radius: 15px;
          border: 1px solid #f1f5f9;
          margin-bottom: 15px;
        }
        .ach-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 2px;
        }
        .ach-meta {
          font-size: 11px;
          font-weight: 700;
          color: #4f46e5;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .ach-desc {
          font-size: 12px;
          color: #475569;
        }
        a {
          color: inherit;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="name">${user.name}</h1>
          <p class="title">${profile.title || ''}</p>
          <div class="contact-info">
            <span class="contact-item">📧 ${user.email}</span>
            ${profile.phone ? `<span class="contact-item">📱 ${profile.phone}</span>` : ''}
            ${profile.location ? `<span class="contact-item">📍 ${profile.location}</span>` : ''}
            ${profile.linkedin ? `<a href="${profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}" target="_blank" class="contact-item" style="color: #64748b; font-weight: bold; text-decoration: underline;">🔗 LINKEDIN</a>` : ''}
          </div>
        </div>
        ${profilePic ? `<img src="${profilePic}" class="profile-pic" />` : ''}
      </div>

      ${profile.summary ? `
      <div class="section">
        <h2 class="section-title">Professional Narrative</h2>
        <div class="summary">${profile.summary}</div>
      </div>` : ''}

      ${profile.experience && profile.experience.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Operational Experience</h2>
        ${profile.experience.map(exp => `
          <div class="exp-item">
            <div class="exp-header">
              <div class="exp-role">${exp.position}</div>
              <div class="exp-date">${formatDate(exp.startDate)} — ${exp.current ? 'PRESENT' : formatDate(exp.endDate)}</div>
            </div>
            <div class="exp-company">${exp.company}</div>
            <div class="exp-desc">${exp.description}</div>
          </div>
        `).join('')}
      </div>` : ''}

      ${profile.skills && profile.skills.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Technical Assets</h2>
        <div class="skills-container">
          ${profile.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
        </div>
      </div>` : ''}

      <div class="grid-2">
        ${profile.education && profile.education.length > 0 ? `
        <div>
          <h2 class="section-title">Credentials</h2>
          ${profile.education.map(edu => {
            const meta = [edu.level, edu.stream, edu.field].filter(Boolean).join(' · ');
            return `
            <div class="exp-item">
              <div class="exp-header">
                <div class="exp-role" style="font-size: 14px;">${edu.degree || ''}</div>
              </div>
              <div class="exp-company" style="font-size: 12px; margin-bottom: 2px;">${edu.institution || ''}</div>
              ${meta ? `<div class="exp-desc" style="font-size: 11px; color: #64748b;">${meta}</div>` : ''}
              ${edu.result ? `<div class="exp-desc" style="font-size: 11px;">Result: ${edu.result}</div>` : ''}
              <div class="exp-date">${formatDate(edu.startDate)} — ${edu.current ? 'ONGOING' : formatDate(edu.endDate)}</div>
            </div>
          `;
          }).join('')}
        </div>` : ''}
        
        ${profile.projects && profile.projects.length > 0 ? `
        <div>
          <h2 class="section-title">Technical Projects</h2>
          ${profile.projects.map(proj => `
            <div class="exp-item">
              <div class="exp-header">
                <div class="exp-role" style="font-size: 14px;">${proj.name}</div>
              </div>
              <div class="exp-desc" style="font-size: 12px;">${proj.description}</div>
              <div class="exp-date" style="margin-top: 4px;">${formatDate(proj.startDate)} — ${formatDate(proj.endDate)}</div>
            </div>
          `).join('')}
        </div>` : ''}
      </div>

      ${profile.achievements && profile.achievements.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Achievements & Certifications</h2>
        <div class="grid-2">
          ${profile.achievements.map(ach => `
            <div class="ach-item">
              <div class="ach-title">${ach.title}</div>
              <div class="ach-meta">${ach.issuer} ${ach.date ? `• ${formatDate(ach.date)}` : ''}</div>
              <div class="ach-desc">${ach.description}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

    </body>
    </html>
  `;
};