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

module.exports = generateResumeHTML;