// Simple static page renderer for /privacy and /terms.
// Handles the markdown subset used in both docs: headings, bold, tables, lists, <hr>, paragraphs.

const PRIVACY = `# Privacy Policy

**Unpack**
Last updated: March 2026

---

## 1. Who we are

Unpack is an educational tool built for Singapore upper-secondary Geography students. This policy explains how we handle your personal data in accordance with the Singapore Personal Data Protection Act 2012 (PDPA).

---

## 2. What data we collect

We collect only what is necessary to provide the service:

**Account data**
- Email address (for login)
- Account tier (Free, Basic, or Plus)

**Usage data**
- Exam answers you submit
- Diagnostic feedback generated for your answers
- Your progress across attempts on each question

**Technical data**
- Session tokens (for keeping you logged in)
- Basic error logs (for fixing bugs)

We do not collect your name, school, age, location, or any demographic information.

---

## 3. Why we collect it

| Data | Purpose |
|------|---------|
| Email | Account login and account recovery |
| Tier | Gating access to paid features |
| Answers and feedback | Showing you your progress over time |
| Error logs | Fixing technical issues |

We do not sell your data. We do not use your data for advertising.

---

## 4. How your data is stored

Your data is stored securely using Supabase, a cloud database provider. Data is encrypted in transit and at rest. We retain your data for as long as your account is active. If you delete your account, your data is deleted within 30 days.

---

## 5. Students and minors

Unpack is intended for students aged 13 and above. If you are under 18, you should have your parent or guardian's permission before creating an account. We do not knowingly collect data from children under 13. If you believe a child under 13 has created an account, contact us and we will delete it promptly.

---

## 6. Your rights under PDPA

You have the right to:
- Access the personal data we hold about you
- Correct inaccurate data
- Withdraw consent and request deletion of your data

To exercise any of these rights, email us at the address below.

---

## 7. Third-party services

We use the following third-party services:

| Service | Purpose |
|---------|---------|
| Supabase | Database and authentication |
| Anthropic | AI feedback generation |
| Stripe | Payment processing (paid tiers) |

Each provider has their own privacy policy. We share only the minimum data required for each service to function.

---

## 8. Changes to this policy

We may update this policy as the product evolves. We will notify you of significant changes by email or in-app notice. Continued use of Unpack after changes constitutes acceptance.

---

## 9. Contact

For any privacy-related questions or requests:
**Email:** privacy@unpack.sg

---

*This is a stub document. Before monetising or onboarding real student users, have this reviewed by a Singapore-qualified lawyer familiar with PDPA and education data.*`;

const TERMS = `# Terms of Use

**Unpack**
Last updated: March 2026

---

## 1. Acceptance of terms

By creating an account or using Unpack, you agree to these Terms of Use. If you do not agree, do not use the service. If you are under 18, your parent or guardian must agree on your behalf.

---

## 2. What Unpack is

Unpack is an exam reasoning trainer for Singapore upper-secondary Geography students. It provides diagnostic feedback on exam-style answers to help students improve their reasoning. It is not a tutoring service, a marking service, or a substitute for your school teacher.

---

## 3. Your account

- You are responsible for keeping your login credentials secure.
- One account per person. You may not share accounts.
- You must provide a valid email address.
- You must be at least 13 years old to create an account.

---

## 4. Acceptable use

You agree not to:
- Submit content that is offensive, abusive, or harmful
- Attempt to reverse-engineer or copy the diagnostic system
- Use Unpack to cheat in actual school assessments
- Share your account with others
- Use automated tools to submit answers or scrape content

We reserve the right to suspend or terminate accounts that violate these terms without notice.

---

## 5. Content you submit

When you submit an answer, you grant Unpack a limited licence to process that answer for the purpose of generating feedback. We do not use your answers to train AI models. We do not share your answers with third parties except as required to generate feedback (via Anthropic's API).

---

## 6. Intellectual property

All question content, feedback logic, and design in Unpack is owned by Unpack or its licensors. You may not reproduce, copy, or distribute any part of the service without written permission.

Questions sourced from school preliminary examination papers remain the intellectual property of their respective schools. Their inclusion in Unpack does not transfer ownership.

---

## 7. Subscriptions and payments

- Free tier access requires no payment.
- Basic and Plus tiers are billed monthly. You may cancel at any time.
- A 7-day free trial is available on Basic and Plus. You will not be charged until the trial ends.
- Refunds are handled on a case-by-case basis. Contact us within 7 days of a charge if you believe it was in error.
- Payments are processed by Stripe. We do not store your payment details.

---

## 8. Disclaimer

Unpack provides diagnostic feedback to support learning. It does not guarantee any particular exam result. Feedback is AI-generated and may occasionally be inaccurate. Always verify important information with your teacher.

---

## 9. Limitation of liability

To the fullest extent permitted by Singapore law, Unpack is not liable for any indirect, incidental, or consequential damages arising from your use of the service.

---

## 10. Changes to these terms

We may update these terms as the product evolves. Continued use after changes constitutes acceptance. We will notify users of significant changes by email.

---

## 11. Governing law

These terms are governed by the laws of Singapore. Any disputes shall be subject to the exclusive jurisdiction of the Singapore courts.

---

## 12. Contact

For any questions about these terms:
**Email:** hello@unpack.sg

---

*This is a stub document. Before monetising or onboarding real student users, have this reviewed by a Singapore-qualified lawyer.*`;

// ── Mini markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(md) {
  const lines = md.split('\n');
  const nodes = [];
  let i = 0;

  const inlineRender = (text) => {
    // Bold and italic
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g);
    return parts.map((p, j) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={j}>{p.slice(2, -2)}</strong>;
      if ((p.startsWith('*') && p.endsWith('*')) || (p.startsWith('_') && p.endsWith('_'))) return <em key={j}>{p.slice(1, -1)}</em>;
      return p;
    });
  };

  while (i < lines.length) {
    const line = lines[i];

    // H1
    if (line.startsWith('# ')) {
      nodes.push(<h1 key={i} style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 }}>{line.slice(2)}</h1>);
      i++; continue;
    }
    // H2
    if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 700, marginTop: 32, marginBottom: 10, color: '#1a1a2e' }}>{line.slice(3)}</h2>);
      i++; continue;
    }
    // HR
    if (line.trim() === '---') {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #e8e6e0', margin: '24px 0' }} />);
      i++; continue;
    }
    // Table — collect all table lines
    if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      // Filter out separator rows (|---|)
      const rows = tableLines.filter(l => !l.match(/^\|[\s|:-]+\|$/));
      nodes.push(
        <table key={`table-${i}`} style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16, fontSize: 14 }}>
          <tbody>
            {rows.map((row, ri) => {
              const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1);
              const isHeader = ri === 0;
              return (
                <tr key={ri} style={{ borderBottom: '1px solid #e8e6e0' }}>
                  {cells.map((cell, ci) => {
                    const Tag = isHeader ? 'th' : 'td';
                    return <Tag key={ci} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: isHeader ? 700 : 400, color: isHeader ? '#4a4a6a' : '#1a1a2e', background: isHeader ? '#f5f4f0' : 'transparent' }}>{inlineRender(cell.trim())}</Tag>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      );
      continue;
    }
    // Unordered list — collect all list items
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: 20, marginBottom: 12 }}>
          {items.map((it, j) => <li key={j} style={{ fontSize: 15, lineHeight: 1.7, color: '#4a4a6a', marginBottom: 3 }}>{inlineRender(it)}</li>)}
        </ul>
      );
      continue;
    }
    // Italic/note lines starting with *
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      nodes.push(<p key={i} style={{ fontSize: 13, color: '#8a8aaa', fontStyle: 'italic', marginBottom: 8 }}>{line.slice(1, -1)}</p>);
      i++; continue;
    }
    // Empty line
    if (!line.trim()) {
      i++; continue;
    }
    // Paragraph
    nodes.push(<p key={i} style={{ fontSize: 15, lineHeight: 1.75, color: '#4a4a6a', marginBottom: 10 }}>{inlineRender(line)}</p>);
    i++;
  }
  return nodes;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function StaticPage({ page }) {
  const content = page === 'privacy' ? PRIVACY : TERMS;
  const otherHref = page === 'privacy' ? '/terms' : '/privacy';
  const otherLabel = page === 'privacy' ? 'Terms of Use' : 'Privacy Policy';

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#faf9f6', minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid #e8e6e0', background: '#ffffff', padding: '13px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.5px', color: '#1a1a2e', textDecoration: 'none' }}>
          Un<span style={{ color: '#ff6b35' }}>pack</span>
        </a>
        <div style={{ width: 1, height: 16, background: '#e8e6e0' }} />
        <a href={otherHref} style={{ fontSize: 12, color: '#8a8aaa', textDecoration: 'none' }}>{otherLabel}</a>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        {renderMarkdown(content)}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e8e6e0', padding: '20px 24px', textAlign: 'center', fontSize: 12, color: '#8a8aaa' }}>
        <a href="/faq" style={{ color: '#8a8aaa', textDecoration: 'none', marginRight: 16 }}>FAQ</a>
        <a href="/privacy" style={{ color: '#8a8aaa', textDecoration: 'none', marginRight: 16 }}>Privacy Policy</a>
        <a href="/terms" style={{ color: '#8a8aaa', textDecoration: 'none' }}>Terms of Use</a>
      </footer>
    </div>
  );
}
