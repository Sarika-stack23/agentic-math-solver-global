import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { BookOpen, Lightbulb, CheckCircle, HelpCircle, Copy, RefreshCw, Sparkles } from 'lucide-react';
import { t } from '../../i18n';

interface QuizState {
  quizTree: any;
  selectedClass: string;
  selectedChapter: string;
  selectedExercise: string;
  selectedQuestionIndex: number;
  currentQuestionRaw: string;
  feedback: string;
  showStuckMenu: boolean;
}

type PracticeMode = 'curriculum' | 'topic' | 'daily';

export const GlobalPracticePanel: React.FC = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<PracticeMode>('curriculum');
  const [state, setState] = useState<QuizState>({
    quizTree: {},
    selectedClass: '',
    selectedChapter: '',
    selectedExercise: '',
    selectedQuestionIndex: 0,
    currentQuestionRaw: '',
    feedback: '',
    showStuckMenu: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  // Topic-based practice state
  const [selectedTopic, setSelectedTopic] = useState('algebra');
  const [topicProblems, setTopicProblems] = useState<any[]>([]);
  const [topicProblemIndex, setTopicProblemIndex] = useState(0);

  const getCleanText = (content: string) => {
    let text = content;

    // 1. Strip markdown bold/italic/headers
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');
    text = text.replace(/\*(.*?)\*/g, '$1');
    text = text.replace(/#+\s?(.*?)\n/g, '$1\n');

    // 2. Strip \( \) and \[ \] math delimiters FIRST (keep inner content)
    text = text.replace(/\\\([\s\S]*?\\\)/g, (m) => m.slice(2, -2));
    text = text.replace(/\\\[[\s\S]*?\\\]/g, (m) => m.slice(2, -2));

    // 3. Strip $$ ... $$ and $ ... $ (keep inner content)
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
    text = text.replace(/\$([^$\n]+)\$/g, '$1');

    // 4. Convert known LaTeX commands to readable text/unicode
    text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
    text = text.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
    text = text.replace(/\\boxed\{([^{}]+)\}/g, '[ $1 ]');
    text = text.replace(/\\text\{([^{}]+)\}/g, '$1');
    text = text.replace(/\\pi/g, 'π');
    text = text.replace(/\\infty/g, '∞');
    text = text.replace(/\\pm/g, '±');
    text = text.replace(/\\mp/g, '∓');
    text = text.replace(/\\cdot/g, '·');
    text = text.replace(/\\times/g, '×');
    text = text.replace(/\\div/g, '÷');
    text = text.replace(/\\leq/g, '≤');
    text = text.replace(/\\geq/g, '≥');
    text = text.replace(/\\neq/g, '≠');
    text = text.replace(/\\approx/g, '≈');
    text = text.replace(/\\Rightarrow/g, ' ⟹ ');
    text = text.replace(/\\rightarrow/g, ' → ');
    text = text.replace(/\\Leftarrow/g, ' ⟸ ');
    text = text.replace(/\\leftarrow/g, ' ← ');
    text = text.replace(/\\sin/g, 'sin');
    text = text.replace(/\\cos/g, 'cos');
    text = text.replace(/\\tan/g, 'tan');
    text = text.replace(/\\cot/g, 'cot');
    text = text.replace(/\\sec/g, 'sec');
    text = text.replace(/\\csc/g, 'csc');
    text = text.replace(/\\ln/g, 'ln');
    text = text.replace(/\\log/g, 'log');
    text = text.replace(/\\exp/g, 'exp');
    text = text.replace(/\\alpha/g, 'α');
    text = text.replace(/\\beta/g, 'β');
    text = text.replace(/\\gamma/g, 'γ');
    text = text.replace(/\\delta/g, 'δ');
    text = text.replace(/\\theta/g, 'θ');
    text = text.replace(/\\lambda/g, 'λ');
    text = text.replace(/\\mu/g, 'μ');
    text = text.replace(/\\sigma/g, 'σ');
    text = text.replace(/\\omega/g, 'ω');
    text = text.replace(/\\varepsilon/g, 'ε');
    text = text.replace(/\\left\(/g, '(');
    text = text.replace(/\\right\)/g, ')');
    text = text.replace(/\\left\[/g, '[');
    text = text.replace(/\\right\]/g, ']');
    text = text.replace(/\\left\|/g, '|');
    text = text.replace(/\\right\|/g, '|');
    text = text.replace(/\^\{([^{}]+)\}/g, '^($1)');
    text = text.replace(/_\{([^{}]+)\}/g, '_($1)');
    text = text.replace(/\\,/g, ' ');
    text = text.replace(/\\ /g, ' ');
    text = text.replace(/\\quad/g, '  ');
    text = text.replace(/\\qquad/g, '    ');

    // 5. Remove any remaining raw LaTeX commands and bare braces
    text = text.replace(/\\[a-zA-Z]+/g, '');
    text = text.replace(/[{}]/g, '');

    // 6. Clean up excessive newlines
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  };


  const handleCopy = () => {
    const textToCopy = getCleanText(state.feedback);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.error("Clipboard copy failed", err));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      textArea.remove();
    }
  };

  useEffect(() => {
    setIsLoadingCurriculum(true);
    fetch(`${apiUrl}/api/v1/quiz/structure`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch curriculum structure');
        return r.json();
      })
      .then(data => {
        if (!data || data.detail) {
          throw new Error('Invalid curriculum data');
        }
        setState(prev => {
          const classes = Object.keys(data).sort();
          const firstClass = classes[0] || '';
          const chaps = firstClass ? Object.keys(data[firstClass]).sort((a,b) => parseInt(a.replace('ch','')) - parseInt(b.replace('ch',''))) : [];
          const firstChap = chaps[0] || '';
          const exs = firstChap ? Object.keys(data[firstClass][firstChap]).sort() : [];
          const firstEx = exs[0] || '';
          const qs = firstEx ? data[firstClass][firstChap][firstEx] : [];
          return { ...prev, quizTree: data, selectedClass: firstClass, selectedChapter: firstChap, selectedExercise: firstEx, selectedQuestionIndex: 0, currentQuestionRaw: qs.length > 0 ? qs[0] : '' };
        });
      })
      .catch(() => setFetchFailed(true))
      .finally(() => setIsLoadingCurriculum(false));
  }, [apiUrl]);

  const generateTopicPractice = async () => {
    if (!user) return;
    setIsLoading(true);
    setFetchFailed(false);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/api/v1/practice/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTopic, difficulty: 'same', count: 5, education_level: localStorage.getItem('education_level') || 'high_school' })
      });
      if (response.ok) {
        const data = await response.json();
        setTopicProblems(data.problems || []);
        setTopicProblemIndex(0);
        setState(prev => ({ ...prev, feedback: '', currentQuestionRaw: '' }));
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e) {
      console.error(e);
      setFetchFailed(true);
    }
    finally { setIsLoading(false); }
  };

  const handleAction = async (action: string) => {
    if (!user) return;
    setIsLoading(true);

    const token = await user.getIdToken();
    const trackWeakness = async () => {
      try { await fetch(`${apiUrl}/api/v1/progress/weakness`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: state.selectedChapter || selectedTopic }) }); } catch {}
    };
    const incrementProgress = async () => {
      try { await fetch(`${apiUrl}/api/v1/progress/increment`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }); } catch {}
    };

    // Map 'Show me the full answer for this' to the AI solving it step-by-step
    if (action.includes('Show me the full answer') || action.includes('Show me the full step-by-step answer')) {
      incrementProgress();
      action = 'Solve this problem step-by-step and show the final answer';
    }

    if (action.toLowerCase().includes('hint') || action.toLowerCase().includes('step') || action.includes("I don't understand") || action.includes('explain the underlying concept') || action.includes('break down the formula')) {
      trackWeakness();
    }

    if (action === 'I understood it, thanks!') {
      incrementProgress();
      setState(prev => ({ ...prev, feedback: "Great job! Keep up the good work. 💪", showStuckMenu: false }));
      setIsLoading(false);
      return;
    } else if (action === 'I still have a doubt, can you explain further?') {
      trackWeakness();
    }

    try {
      let questionText = '';
      if (mode === 'curriculum') {
        questionText = state.currentQuestionRaw.split(/Answer:/i)[0].trim();
      } else if (mode === 'topic' && topicProblems[topicProblemIndex]) {
        questionText = topicProblems[topicProblemIndex].problem;
      }

      const response = await fetch(`${apiUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          query: `${action}\nQuestion: ${questionText}`,
          session_id: 'quiz-' + Date.now(),
          action: action.toLowerCase().includes('hint') ? 'hint'
            : action.toLowerCase().includes('step') ? 'steps'
            : action.toLowerCase().includes('concept') || action.toLowerCase().includes('teach') || action.toLowerCase().includes('understand') ? 'teach'
            : action.toLowerCase().includes('full answer') ? 'answer'
            : action.toLowerCase().includes('solve') ? 'solve'
            : action.toLowerCase().includes('similar') || action.toLowerCase().includes('example') ? 'similar'
            : 'ask_ai'
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr.trim() === "[DONE]") continue;
            let parsedContent = dataStr;
            try { const parsed = JSON.parse(dataStr); if (parsed.content) parsedContent = parsed.content; } catch {}
            fullResponse += parsedContent;
            setState(prev => ({ ...prev, feedback: fullResponse, showStuckMenu: false }));
          }
        }
      }
    } catch (e) {
      console.error(e);
      setState(prev => ({ ...prev, feedback: "Failed to fetch response from AI." }));
    } finally {
      setIsLoading(false);
    }
  };

  const formatKey = (k: string) => {
    if (k.startsWith('class_')) return `Class ${k.split('_')[1]}`;
    if (k.startsWith('ch')) return `Chapter ${k.replace('ch', '')}`;
    if (k.startsWith('ex')) return `Exercise ${k.replace('ex', '')}`;
    return k;
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const c = e.target.value;
    const chaps = Object.keys(state.quizTree[c] || {}).sort((a,b) => parseInt(a.replace('ch','')) - parseInt(b.replace('ch','')));
    const firstChap = chaps[0] || '';
    const exs = firstChap ? Object.keys(state.quizTree[c][firstChap] || {}).sort() : [];
    const firstEx = exs[0] || '';
    const qs = firstEx ? state.quizTree[c][firstChap][firstEx] : [];
    setState(prev => ({ ...prev, selectedClass: c, selectedChapter: firstChap, selectedExercise: firstEx, selectedQuestionIndex: 0, currentQuestionRaw: qs.length > 0 ? qs[0] : '', feedback: '' }));
  };

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ch = e.target.value;
    const exs = Object.keys(state.quizTree[state.selectedClass]?.[ch] || {}).sort();
    const firstEx = exs[0] || '';
    const qs = firstEx ? state.quizTree[state.selectedClass][ch][firstEx] : [];
    setState(prev => ({ ...prev, selectedChapter: ch, selectedExercise: firstEx, selectedQuestionIndex: 0, currentQuestionRaw: qs.length > 0 ? qs[0] : '', feedback: '' }));
  };

  const handleExerciseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ex = e.target.value;
    const qs = state.quizTree[state.selectedClass]?.[state.selectedChapter]?.[ex] || [];
    setState(prev => ({ ...prev, selectedExercise: ex, selectedQuestionIndex: 0, currentQuestionRaw: qs.length > 0 ? qs[0] : '', feedback: '' }));
  };

  const handleQuestionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const qIdx = parseInt(e.target.value);
    const qs = state.quizTree[state.selectedClass]?.[state.selectedChapter]?.[state.selectedExercise] || [];
    setState(prev => ({ ...prev, selectedQuestionIndex: qIdx, currentQuestionRaw: qs[qIdx] || '', feedback: '' }));
  };

  const displayQuestion = mode === 'curriculum'
    ? state.currentQuestionRaw.split(/Answer:/i)[0].trim()
    : (topicProblems[topicProblemIndex]?.problem || '');

  const topics = ['arithmetic', 'algebra', 'geometry', 'trigonometry', 'calculus', 'probability', 'statistics', 'linear_algebra', 'coordinate_geometry', 'number_theory'];

  return (
    <div className="page-container content-wrapper" style={{ overflowY: 'auto', flex: 1 }}>
      <div className="page-header">
        <h2>{t('practice.title')}</h2>
        <p style={{ fontSize: 'var(--text-sm)' }}>Choose a practice mode below.</p>
      </div>

      {/* Mode Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-lg)' }}>
        <button className={`btn ${mode === 'topic' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setMode('topic'); setState(prev => ({ ...prev, feedback: '' })); }}>
          <Sparkles size={16} /> {t('practice.topics.title')}
        </button>
        <button className={`btn ${mode === 'curriculum' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setMode('curriculum'); setState(prev => ({ ...prev, feedback: '' })); }}>
          <BookOpen size={16} /> Global Curriculum
        </button>
      </div>

      {/* Topic-Based Practice */}
      {mode === 'topic' && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} style={{ maxWidth: '250px' }} aria-label="Select topic">
              {topics.map(tp => (
                <option key={tp} value={tp}>{t(`practice.topics.${tp}`) || tp.replace('_', ' ')}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={generateTopicPractice} disabled={isLoading}>
              {isLoading ? 'Generating...' : t('practice.generateSet')}
            </button>
          </div>
          {fetchFailed && (
            <div style={{ marginTop: 'var(--space-md)', color: 'var(--warning)', fontSize: 'var(--text-sm)' }}>
              Failed to generate practice questions. Please try again.
            </div>
          )}
          {topicProblems.length > 0 && !isLoading && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
              {topicProblems.map((_, idx) => (
                <button key={idx} className={`btn ${idx === topicProblemIndex ? 'btn-primary' : 'btn-outline'}`} style={{ minWidth: '40px' }}
                  onClick={() => { setTopicProblemIndex(idx); setState(prev => ({ ...prev, feedback: '' })); }}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Curriculum Selectors */}
      {mode === 'curriculum' && (
        fetchFailed ? (
          <div className="card" style={{ marginBottom: 'var(--space-lg)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)', opacity: 0.3 }}>⚠️</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-base)' }}>
              Unable to load curriculum.
            </p>
            <button className="btn btn-outline" onClick={() => {
              setFetchFailed(false);
              // Trigger a re-render to run the useEffect fetch again by remounting or re-fetching
              window.location.reload();
            }}>
              <RefreshCw size={14} style={{ marginRight: '6px' }} /> Retry
            </button>
          </div>
        ) : isLoadingCurriculum ? (
          <div className="card" style={{ marginBottom: 'var(--space-lg)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)', opacity: 0.3 }}>📚</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-base)' }}>
              Loading Global Curriculum question bank...
            </p>
          </div>
        ) : Object.keys(state.quizTree).length === 0 ? (
          <div className="card" style={{ marginBottom: 'var(--space-lg)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)', opacity: 0.3 }}>📚</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-base)' }}>
              No curriculum questions available.
            </p>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }}>
            <select value={state.selectedClass} onChange={handleClassChange} className="input" style={{ flex: '1 1 140px' }} aria-label="Select class">
              {Object.keys(state.quizTree).sort().map(c => <option key={c} value={c}>{formatKey(c)}</option>)}
            </select>
            <select value={state.selectedChapter} onChange={handleChapterChange} className="input" style={{ flex: '1 1 140px' }} aria-label="Select chapter">
              {Object.keys(state.quizTree[state.selectedClass] || {}).sort((a,b) => parseInt(a.replace('ch','')) - parseInt(b.replace('ch',''))).map(ch => <option key={ch} value={ch}>{formatKey(ch)}</option>)}
            </select>
            <select value={state.selectedExercise} onChange={handleExerciseChange} className="input" style={{ flex: '1 1 140px' }} aria-label="Select exercise">
              {Object.keys(state.quizTree[state.selectedClass]?.[state.selectedChapter] || {}).sort().map(ex => <option key={ex} value={ex}>{formatKey(ex)}</option>)}
            </select>
            <select value={state.selectedQuestionIndex} onChange={handleQuestionChange} className="input" style={{ flex: '1 1 140px' }} aria-label="Select question">
              {(state.quizTree[state.selectedClass]?.[state.selectedChapter]?.[state.selectedExercise] || []).map((q: string, idx: number) => {
                const qNumMatch = q.match(/Q\d+/);
                return <option key={idx} value={idx}>{qNumMatch ? qNumMatch[0] : `Question ${idx + 1}`}</option>;
              })}
            </select>
          </div>
        )
      )}

      {/* Question Display */}
      {!(mode === 'curriculum' && (fetchFailed || isLoadingCurriculum || Object.keys(state.quizTree).length === 0)) && !(mode === 'topic' && isLoading && topicProblems.length === 0) && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '1.25rem', lineHeight: '1.8', width: '100%', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', padding: 'var(--space-lg)' }}>
            {displayQuestion ? (
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}>{displayQuestion}</ReactMarkdown>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }}>{mode === 'topic' ? '✨' : '📖'}</div>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem' }}>{mode === 'topic' ? 'Select a topic and click Generate to get started.' : 'Select a question from the dropdowns above.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn-secondary" onClick={() => handleAction('Give me a small hint to start solving this')} disabled={isLoading || !displayQuestion}>
          <Lightbulb size={16} /> Hint
        </button>
        <button className="btn btn-secondary" onClick={() => handleAction('Show me the first step to solve this')} disabled={isLoading || !displayQuestion}>
          Steps
        </button>
        <button className="btn btn-primary" onClick={() => handleAction('Show me the full answer for this')} disabled={isLoading || !displayQuestion}>
          <CheckCircle size={16} /> Answer
        </button>
        <button className="btn btn-secondary" onClick={() => setState(prev => ({ ...prev, showStuckMenu: !prev.showStuckMenu }))} disabled={isLoading || !displayQuestion}>
          <HelpCircle size={16} /> Ask AI
        </button>
      </div>

      {/* Stuck Menu */}
      {state.showStuckMenu && (
        <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-lg)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>I'm stuck because...</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={() => handleAction('explain the underlying concept')} style={{ justifyContent: 'flex-start' }}>I don't understand the underlying concept.</button>
            <button className="btn btn-outline" onClick={() => handleAction('show me a similar solved example')} style={{ justifyContent: 'flex-start' }}>Can you show me a similar solved example?</button>
            <button className="btn btn-outline" onClick={() => handleAction('simplify the wording of the question')} style={{ justifyContent: 'flex-start' }}>Can you simplify the wording of the question?</button>
            <button className="btn btn-outline" onClick={() => handleAction('break down the formula needed for this')} style={{ justifyContent: 'flex-start' }}>Break down the formula needed for this.</button>
          </div>
        </div>
      )}

      {/* Feedback / AI Response */}
      {state.feedback && (
        <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-2xl)', border: '1px solid var(--border-glow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h4>AI Response</h4>
            <button title="Copy" onClick={handleCopy} className="btn btn-ghost" aria-label="Copy solution">
              {copied ? <span style={{ fontSize: '0.75rem' }}>{t('common.copied')}</span> : <Copy size={14} />}
            </button>
          </div>
          <div className="handwritten-math">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}>
              {state.feedback.replace(/\\\([\s\S]*?\\\)/g, (match) => '$' + match.slice(2, -2) + '$').replace(/\\\[[\s\S]*?\\\]/g, (match) => '$$$' + match.slice(2, -2) + '$$$')}
            </ReactMarkdown>
          </div>

          {!isLoading && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--space-md)', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-md)' }}>
              <button className="btn btn-secondary" onClick={() => handleAction("I understood it, thanks!")} style={{ fontSize: '0.85rem' }}>
                <CheckCircle size={14} /> Got it!
              </button>
              <button className="btn btn-outline" onClick={() => handleAction("I still have a doubt, can you explain further?")} style={{ fontSize: '0.85rem' }}>
                <HelpCircle size={14} /> I have a doubt
              </button>
              <button className="btn btn-outline" onClick={() => handleAction("Can you explain this differently?")} style={{ fontSize: '0.85rem' }}>
                <RefreshCw size={14} /> Explain differently
              </button>
              <button className="btn btn-outline" onClick={() => handleAction("Show me the full step-by-step answer")} style={{ fontSize: '0.85rem' }}>
                Full Answer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
