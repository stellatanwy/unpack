import { useState } from "react";

const FAQS = [
  {
    q: "Why only 3 questions a week?",
    a: "Three questions a week is on every plan. It is a deliberate choice, not a limitation. The idea is to build a consistent practice routine rather than a cramming session. Doing 3 questions properly, reading the feedback carefully, and sitting with what you got wrong is more useful than doing 10 questions at once and moving on. Once you finish your 3 questions, there are bonus questions available if you want more practice. As exams get closer, the weekly question count increases and the format shifts to mirror actual exam conditions more closely.",
  },
  {
    q: "Is this for O-Level or N-Level students?",
    a: "Unpack covers Geography syllabuses for both O-Level and N-Level students. From 2027, the O and N levels will be replaced by the Singapore-Cambridge Secondary Education Certificate (SEC), where students sit subjects at G1, G2, or G3. The Geography syllabuses Unpack covers align to G2 and G3 under the new system. The content and exam reasoning skills stay the same, just the qualification name changes. If you are sitting exams before 2027, the current syllabus codes apply. If you are on the new system, G3 corresponds to O-Level Geography and G2 to N-Level Geography.",
  },
  {
    q: "How is this different from the Ten-Year Series or assessment books?",
    a: "Assessment books give you questions and answers. Unpack is more interested in why your answer lost marks and what the gap in your reasoning was. Most students can read a model answer and think they understand it. The problem is that in the exam, they still write the same way they did before. Unpack makes you work through the gap yourself, which is what actually changes how you write.",
  },
  {
    q: "How is this different from having a tutor?",
    a: "A tutor covers a lot of ground in one session: new content, exam technique, homework review. Unpack does one thing. It diagnoses reasoning gaps in exam answers and trains students to fix them. It is not a replacement for a tutor. But for the specific skill of writing exam answers that actually score marks, it is more focused practice than most tutor sessions have time for.",
  },
  {
    q: "Will it just give my child the model answer?",
    a: "No. That is a deliberate choice. Reading a model answer does not change how you think. It just shows you what you should have written. Unpack does not reveal the full answer. It identifies the one gap in your reasoning and asks you to fix it. You have to do the thinking.",
  },
  {
    q: "What if my child disagrees with the marking or feedback?",
    a: "It happens, and it is worth taking seriously when it does. The marking is based on MOE mark schemes, but Geography answers are not always black and white, especially for evaluate questions. If the feedback feels off, your child can flag it directly using the disagree option. We review every one of those. They can also resubmit with a revised answer and see if the reasoning holds up. The goal is better thinking, not a definitive score.",
  },
  {
    q: "Who made this?",
    a: "Unpack was made by a Singapore Geography graduate and ex-MOE teacher who spent years tutoring upper-secondary students and watching the same reasoning gaps come up again and again. The product came out of a masters thesis on interaction design, and a lot of frustration with how exam skills are usually taught.",
  },
  {
    q: "How long before we see improvement?",
    a: "It depends on where the gap is and how consistently your child practises. Students who engage with the feedback, not just resubmit until they get marks, tend to notice a difference within a few weeks. The goal is not a quick fix. It is building a way of thinking about exam questions that holds up under pressure.",
  },
  {
    q: "Is my child's data safe?",
    a: "Unpack only collects what is needed to run the product: email, submitted answers, and progress data. Nothing is sold or shared with third parties. The product is built to be PDPA compliant from the start.",
  },
];

function AccordionItem({ question, answer, open, onToggle }) {
  return (
    <div style={{
      borderBottom: "1px solid var(--border-cream)",
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          padding: "20px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 17,
          fontWeight: 600,
          color: "var(--text-dark)",
          lineHeight: 1.35,
        }}>
          {question}
        </span>
        <span style={{
          flexShrink: 0,
          fontSize: 18,
          color: "var(--text-muted)",
          lineHeight: 1,
          transform: open ? "rotate(45deg)" : "none",
          transition: "transform 0.2s ease",
          fontWeight: 300,
        }}>
          +
        </span>
      </button>

      {open && (
        <div className="fade" style={{
          paddingBottom: 20,
        }}>
          <p style={{
            fontSize: 15,
            lineHeight: 1.75,
            color: "var(--text-muted)",
            margin: 0,
          }}>
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (i) => setOpenIdx(prev => prev === i ? null : i);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--cream)", minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border-cream)",
        background: "#ffffff",
        padding: "13px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <a href="/" style={{
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "-0.5px",
          color: "var(--text-dark)",
          textDecoration: "none",
          fontFamily: "'Fraunces', serif",
        }}>
          Un<span style={{ color: "#ff6b35" }}>pack</span>
        </a>
        <div style={{ width: 1, height: 16, background: "var(--border-cream)" }} />
        <a href="/faq" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>FAQ</a>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 96px" }}>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 36,
          fontWeight: 700,
          color: "var(--text-dark)",
          marginBottom: 48,
          letterSpacing: "-0.5px",
          lineHeight: 1.2,
        }}>
          Frequently asked questions
        </h1>

        <div style={{ borderTop: "1px solid var(--border-cream)" }}>
          {FAQS.map((item, i) => (
            <AccordionItem
              key={i}
              question={item.q}
              answer={item.a}
              open={openIdx === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border-cream)",
        padding: "20px 24px",
        textAlign: "center",
        fontSize: 12,
        color: "var(--text-muted)",
      }}>
        <a href="/privacy" style={{ color: "var(--text-muted)", textDecoration: "none", marginRight: 16 }}>Privacy Policy</a>
        <a href="/terms" style={{ color: "var(--text-muted)", textDecoration: "none", marginRight: 16 }}>Terms of Use</a>
        <a href="/faq" style={{ color: "var(--text-muted)", textDecoration: "none" }}>FAQ</a>
      </footer>
    </div>
  );
}
