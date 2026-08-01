const path = require('path');
const fs = require('fs');

/**
 * Builds the HTML document used by Puppeteer to render a user's resume PDF.
 * Pure presentation logic extracted from the user controller/service.
 */
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 0;
          padding: 24px;
          background: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .header-content {
          flex: 1;
          min-width: 0;
        }
        .name {
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
          text-transform: uppercase;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .title {
          font-size: 14px;
          font-weight: 700;
          color: #4f46e5;
          margin: 0 0 14px 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .contact-info {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 12px;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
        }
        .contact-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 5px 10px;
          border-radius: 8px;
          white-space: nowrap;
          text-decoration: none;
          color: #334155;
        }
        .contact-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .profile-pic {
          width: 88px;
          height: 88px;
          border-radius: 16px;
          object-fit: cover;
          border: 2px solid #e2e8f0;
          flex-shrink: 0;
          margin-left: 20px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04);
        }
        .section {
          margin-bottom: 30px;
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
          font-size: 13.5px;
          color: #334155;
          text-align: justify;
          line-height: 1.6;
        }
        .exp-item {
          margin-bottom: 18px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .exp-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
        }
        .exp-role {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }
        .exp-company {
          font-size: 13px;
          font-weight: 600;
          color: #4f46e5;
          margin-bottom: 6px;
        }
        .exp-date {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
        }
        .exp-desc {
          font-size: 12.5px;
          color: #475569;
          line-height: 1.5;
        }
        .skills-container {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .skill-tag {
          padding: 5px 10px;
          background: #f1f5f9;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .ach-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }
        .ach-item {
          width: 100%;
          background: #f8fafc;
          padding: 16px 20px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .ach-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 3px;
        }
        .ach-meta {
          font-size: 11px;
          font-weight: 700;
          color: #4f46e5;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .ach-desc {
          font-size: 12.5px;
          color: #475569;
          line-height: 1.55;
        }
        a {
          color: inherit;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-content">
          <h1 class="name">${user.name}</h1>
          <p class="title">${profile.title || ''}</p>
          <div class="contact-info">
            <span class="contact-item">
              <span class="contact-icon">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="#4f46e5" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </span>
              ${user.email}
            </span>
            ${profile.phone ? `
            <span class="contact-item">
              <span class="contact-icon">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="#4f46e5" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              ${profile.phone}
            </span>` : ''}
            ${(profile.address || profile.location) ? `
            <span class="contact-item">
              <span class="contact-icon">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="#4f46e5" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </span>
              ${profile.address || profile.location}
            </span>` : ''}
            ${profile.linkedin ? `
            <a href="${profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}" target="_blank" class="contact-item">
              <span class="contact-icon">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="#4f46e5" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </span>
              LinkedIn Profile
            </a>` : ''}
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

      ${profile.projects && profile.projects.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Technical Projects</h2>
        ${profile.projects.map(proj => `
          <div class="exp-item">
            <div class="exp-header">
              <div class="exp-role" style="font-size: 15px;">${proj.name}</div>
              ${(proj.startDate || proj.endDate) ? `<div class="exp-date">${formatDate(proj.startDate)} — ${formatDate(proj.endDate)}</div>` : ''}
            </div>
            ${proj.url ? `<div class="exp-company" style="font-size: 12px; margin-bottom: 6px;"><a href="${proj.url.startsWith('http') ? proj.url : `https://${proj.url}`}" target="_blank" style="color: #4f46e5; text-decoration: underline;">${proj.url}</a></div>` : ''}
            <div class="exp-desc">${proj.description}</div>
          </div>
        `).join('')}
      </div>` : ''}

      ${profile.education && profile.education.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Credentials & Education</h2>
        ${profile.education.map(edu => {
          const meta = [edu.level, edu.stream, edu.field].filter(Boolean).join(' · ');
          return `
          <div class="exp-item">
            <div class="exp-header">
              <div class="exp-role" style="font-size: 15px;">${edu.degree || ''}</div>
              <div class="exp-date">${formatDate(edu.startDate)} — ${edu.current ? 'ONGOING' : formatDate(edu.endDate)}</div>
            </div>
            <div class="exp-company">${edu.institution || ''}</div>
            ${meta ? `<div class="exp-desc" style="font-size: 12px; color: #64748b; margin-bottom: 2px;">${meta}</div>` : ''}
            ${edu.result ? `<div class="exp-desc" style="font-size: 12px; font-weight: 600;">Result: ${edu.result}</div>` : ''}
          </div>
        `;
        }).join('')}
      </div>` : ''}

      ${profile.achievements && profile.achievements.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Achievements & Certifications</h2>
        <div class="ach-list">
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

module.exports = generateResumeHTML;