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

type PracticeMode = 'ncert' | 'topic' | 'daily';

export const NCERTQuizPanel: React.FC = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<PracticeMode>('ncert');
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
  const [copied, setCopied] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  // Topic-based practice state
  const [selectedTopic, setSelectedTopic] = useState('algebra');
  const [topicProblems, setTopicProblems] = useState<any[]>([]);
  const [topicProblemIndex, setTopicProblemIndex] = useState(0);

  const handleCopy = () => {
    navigator.clipboard.writeText(state.feedback);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/quiz/structure`)
      .then(r => r.json())
      .then(data => {
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
      .catch(console.error);
  }, [apiUrl]);

  const generateTopicPractice = async () => {
    if (!user) return;
    setIsLoading(true);
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
        setState(prev => ({ ...prev, feedback: '' }));
      }
    } catch (e) { console.error(e); }
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

    // Direct answer lookup
    if (action.includes('Show me the full answer') || action.includes('Show me the full step-by-step answer')) {
      const parts = state.currentQuestionRaw.split(/Answer:/i);
      incrementProgress();
      if (parts.length > 1) {
        setState(prev => ({ ...prev, feedback: "**Answer:** " + parts[1].trim(), showStuckMenu: false }));
        setIsLoading(false);
        return;
      }
      action = 'Solve this problem and show the final answer';
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
      if (mode === 'ncert') {
        questionText = state.currentQuestionRaw.split(/Answer:/i)[0].trim();
      } else if (mode === 'topic' && topicProblems[topicProblemIndex]) {
        questionText = topicProblems[topicProblemIndex].problem;
      }

      const customKey = localStorage.getItem('custom_gemini_api_key') || "";
      const response = await fetch(`${apiUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Gemini-API-Key': customKey },
        body: JSON.stringify({ query: `Action: ${action}\nQuestion: ${questionText}`, session_id: 'quiz-' + Date.now() })
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

  const displayQuestion = mode === 'ncert'
    ? state.currentQuestionRaw.split(/Answer:/i)[0].trim()
    : (topicProblems[topicProblemIndex]?.problem || '');

  const topics = ['arithmetic', 'algebra', 'geometry', 'trigonometry', 'calculus', 'probability', 'statistics', 'linear_algebra', 'coordinate_geometry', 'number_theory'];

  return (
    <div className="page-container" style={{ overflowY: 'auto', flex: 1 }}>
      <div className="page-header">
        <h2>{t('practice.title')}</h2>
        <p style={{ fontSize: 'var(--text-sm)' }}>Choose a practice mode below.</p>
      </div>

      {/* Mode Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-lg)' }}>
        <button className={`btn ${mode === 'topic' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setMode('topic'); setState(prev => ({ ...prev, feedback: '' })); }}>
          <Sparkles size={16} /> {t('practice.topics.title')}
        </button>
        <button className={`btn ${mode === 'ncert' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setMode('ncert'); setState(prev => ({ ...prev, feedback: '' })); }}>
          <BookOpen size={16} /> {t('practice.ncert.title')}
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
              {t('practice.generateSet')}
            </button>
          </div>
          {topicProblems.length > 0 && (
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

      {/* NCERT Selectors */}
      {mode === 'ncert' && (
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
      )}

      {/* Question Display */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)', minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', lineHeight: '1.7', width: '100%' }}>
          {displayQuestion ? (
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{displayQuestion}</ReactMarkdown>
          ) : (
            <span style={{ color: 'hsl(var(--text-muted))' }}>
              {mode === 'topic' ? 'Generate practice problems to get started.' : 'Loading questions...'}
            </span>
          )}
        </div>
      </div>

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
        <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-2xl)', border: '1px solid hsla(var(--accent-primary), 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h4>AI Response</h4>
            <button title="Copy" onClick={handleCopy} className="btn btn-ghost" aria-label="Copy solution">
              {copied ? <span style={{ fontSize: '0.75rem' }}>{t('common.copied')}</span> : <Copy size={14} />}
            </button>
          </div>
          <div className="handwritten-math">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{state.feedback}</ReactMarkdown>
          </div>

          {!isLoading && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--space-md)', flexWrap: 'wrap', borderTop: '1px solid hsl(var(--border))', paddingTop: 'var(--space-md)' }}>
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
