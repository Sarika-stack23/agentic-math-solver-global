import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Send, Image as ImageIcon, ThumbsUp, ThumbsDown, Copy, FileText, Camera, X, Plus, Edit2, Lightbulb, RefreshCw, CheckCircle, HelpCircle, BookOpen, Sparkles, Share2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { t, tArray } from '../../i18n';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  verificationStatus?: 'verified' | 'unverified' | '';
}

/* ── Descriptive Loading States ─────────────────────────────────────── */
const loadingStages = [
  'solve.loading.reading',
  'solve.loading.planning',
  'solve.loading.solving',
  'solve.loading.checking',
  'solve.loading.preparing',
];

const LoadingIndicator: React.FC = () => {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, loadingStages.length - 1));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="loading-indicator animate-fade-in" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', alignSelf: 'flex-start' }}>
      <div className="loading-spinner" />
      <span>{t(loadingStages[stageIndex])}</span>
    </div>
  );
};

/* ── Message Action Buttons ─────────────────────────────────────────── */
export const MessageActionButtons: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const getCleanText = () => {
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
    const textToCopy = getCleanText();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.error("Clipboard copy failed", err));
    } else {
      // Fallback for insecure contexts (e.g. non-localhost network IPs)
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

  const handleShare = async () => {
    const cleanText = getCleanText();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Math Solution',
          text: cleanText
        });
      } else {
        await navigator.clipboard.writeText(cleanText);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch (e) {
      console.log('Share cancelled or failed', e);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', justifyContent: 'flex-end', alignItems: 'center' }}>
      <button title={t('common.helpful')} onClick={() => setFeedback('up')} className="btn btn-ghost" style={{ color: feedback === 'up' ? 'var(--success)' : undefined, opacity: feedback === 'up' ? 1 : 0.6 }} aria-label={t('common.helpful')}>
        <ThumbsUp size={14} />
      </button>
      <button title={t('common.notHelpful')} onClick={() => setFeedback('down')} className="btn btn-ghost" style={{ color: feedback === 'down' ? 'var(--danger)' : undefined, opacity: feedback === 'down' ? 1 : 0.6 }} aria-label={t('common.notHelpful')}>
        <ThumbsDown size={14} />
      </button>
      <button title={t('common.copy')} onClick={handleCopy} className="btn btn-ghost" style={{ color: copied ? 'var(--success)' : undefined, opacity: copied ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: '4px' }} aria-label={t('common.copy')}>
        {copied ? <span style={{ fontSize: '0.75rem' }}>{t('common.copied')}</span> : <Copy size={14} /> }
      </button>
      <button title={t('share.share') || "Share"} onClick={handleShare} className="btn btn-ghost" style={{ color: shared ? 'var(--success)' : undefined, opacity: shared ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: '4px' }} aria-label="Share solution">
        {shared ? <span style={{ fontSize: '0.75rem' }}>{t('share.copied') || "Copied!"}</span> : <Share2 size={14} />}
      </button>
    </div>
  );
};

/* ── Solution Action Chips ──────────────────────────────────────────── */
const SolutionActions: React.FC<{ problem: string; onAction: (query: string, action?: string, studentWork?: string) => void }> = ({ problem, onAction }) => {
  const [showCheckWork, setShowCheckWork] = useState(false);
  const [studentWork, setStudentWork] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="action-chip" onClick={() => onAction(problem, 'solve')}>
          <CheckCircle size={14} /> {t('solve.actions.solve') || 'Solve'}
        </button>
        <button className="action-chip" onClick={() => onAction(problem, 'hint')}>
          <Lightbulb size={14} /> {t('solve.actions.hint') || 'Hint'}
        </button>
        <button className="action-chip" onClick={() => onAction(problem, 'steps')}>
          <HelpCircle size={14} /> {t('solve.actions.why') || 'Steps'}
        </button>
        <button className="action-chip" onClick={() => onAction(problem, 'answer')}>
          <CheckCircle size={14} /> {t('solve.actions.answer') || 'Answer'}
        </button>
        <button className="action-chip" onClick={() => setShowCheckWork(!showCheckWork)}>
          <RefreshCw size={14} /> {t('solve.actions.checkMyWork') || 'Check My Work'}
        </button>
        <button className="action-chip" onClick={() => onAction(problem, 'teach')}>
          <BookOpen size={14} /> {t('solve.actions.teachMe') || 'Teach Me'}
        </button>
        <button className="action-chip" onClick={() => onAction(problem, 'another')}>
          <RefreshCw size={14} /> {t('solve.actions.anotherMethod') || 'Another Method'}
        </button>
        <button className="action-chip" onClick={() => onAction(problem, 'similar')}>
          <Sparkles size={14} /> {t('solve.actions.similarProblem') || 'Similar Problem'}
        </button>
        <button className="action-chip" onClick={() => onAction(problem, 'practice')}>
          <BookOpen size={14} /> {t('solve.actions.practice') || 'Practice'}
        </button>
        <button className="action-chip" onClick={() => onAction(problem, 'ask_ai')}>
          <HelpCircle size={14} /> {t('solve.actions.askAi') || 'Ask AI'}
        </button>
      </div>

      {showCheckWork && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Your Attempt</label>
          <textarea
            value={studentWork}
            onChange={(e) => setStudentWork(e.target.value)}
            placeholder="Type your steps here..."
            style={{ width: '100%', minHeight: '60px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => setShowCheckWork(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => { onAction(problem, 'check', studentWork); setShowCheckWork(false); setStudentWork(''); }}>Verify Work</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Main Chat Interface ────────────────────────────────────────────── */
export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId] = useState(() => 'session-' + Date.now().toString());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const location = useLocation();
  const initialQueryHandled = useRef(false);

  // Camera state
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Handle initial query from navigation (e.g., from HomePage)
  useEffect(() => {
    const state = location.state as { initialQuery?: string; openCamera?: boolean; openImage?: boolean; openPdf?: boolean } | null;
    if (state && !initialQueryHandled.current) {
      initialQueryHandled.current = true;
      if (state.initialQuery) {
        setInput(state.initialQuery);
        // Auto-submit after a brief delay
        setTimeout(() => {
          const form = document.getElementById('solve-form') as HTMLFormElement;
          if (form) form.requestSubmit();
        }, 100);
      }
      if (state.openCamera) startCamera();
      if (state.openImage) fileInputRef.current?.click();
      if (state.openPdf) pdfInputRef.current?.click();
      // Clear the state so refresh doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  const incrementProgress = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch(`${apiUrl}/api/v1/progress/increment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) { console.error("Progress increment failed", e); }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async (query: string, action?: string, studentWork?: string) => {
    if (!query.trim() || !user) return;

    let displayQuery = query;
    if (action === 'check') {
        displayQuery = `Check my work for: ${query}`;
        if (studentWork) displayQuery += `\n\nMy Attempt:\n${studentWork}`;
    }
    else if (action === 'steps') displayQuery = `Explain steps for: ${query}`;
    else if (action === 'another') displayQuery = `Another method for: ${query}`;
    else if (action === 'hint') displayQuery = `Hint for: ${query}`;
    else if (action === 'teach') displayQuery = `Teach me: ${query}`;
    else if (action === 'similar') displayQuery = `Similar problem to: ${query}`;
    else if (action === 'solve') displayQuery = `Solve: ${query}`;
    else if (action === 'answer') displayQuery = `Final answer for: ${query}`;
    else if (action === 'practice') displayQuery = `Practice problem for: ${query}`;
    else if (action === 'ask_ai') displayQuery = `Ask AI about: ${query}`;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: displayQuery };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const token = await user.getIdToken();
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', verificationStatus: '' }]);

    try {
      const response = await fetch(`${apiUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: query, session_id: sessionId, action: action, student_work: studentWork })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error("No readable stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value);
          const lines = chunkValue.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') { done = true; break; }
              try {
                let parsedContent = data;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) parsedContent = parsed.content;
                } catch {}
                setMessages(prev => prev.map(m =>
                  m.id === assistantMsgId ? { ...m, content: m.content + parsedContent, verificationStatus: 'verified' } : m
                ));
              } catch (e) { console.error("SSE parse error", e); }
            }
          }
        }
      }

      // Save to local history
      try {
        const history = JSON.parse(localStorage.getItem('math_tutor_history') || '[]');
        if (!history.find((h: any) => h.problem === query)) {
          history.unshift({
            id: sessionId + '-' + Date.now(),
            problem: query.substring(0, 100),
            topic: 'Math Problem',
            date: new Date().toLocaleDateString(),
            result: 'Solved'
          });
          localStorage.setItem('math_tutor_history', JSON.stringify(history.slice(0, 50)));
        }
      } catch (e) {}

      await incrementProgress();
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, content: t('solve.errors.connectionFailed') } : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    const objectUrl = URL.createObjectURL(file);
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: 'Uploaded an image', imageUrl: objectUrl }]);

    setIsLoading(true);
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('solve', 'true');

      const response = await fetch(`${apiUrl}/api/v1/vision/extract`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      const solutionContent = data.solution
        ? `**Extracted Math:**\n\n${data.extracted_math}\n\n**Solution:**\n\n${data.solution}`
        : `**Extracted Math:**\n\n${data.extracted_math}`;

      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: solutionContent, verificationStatus: 'verified' } : m));
      await incrementProgress();
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: t('solve.errors.imageUnreadable') } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: `Uploaded PDF: ${file.name}` }]);

    setIsLoading(true);
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiUrl}/api/v1/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, content: `Successfully indexed ${data.chunks_added} chunks from ${file.name}. You can now ask questions about it!` } : m
      ));
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: 'Failed to process PDF.' } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert("Could not access camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob && user) {
            stopCamera();
            const file = new File([blob], "scan.jpg", { type: "image/jpeg" });
            const objectUrl = URL.createObjectURL(file);
            const userMsgId = Date.now().toString();
            setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: 'Scanned an image', imageUrl: objectUrl }]);

            setIsLoading(true);
            const assistantMsgId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

            try {
              const token = await user.getIdToken();
              const formData = new FormData();
              formData.append('file', file);
              formData.append('solve', 'true');
              const response = await fetch(`${apiUrl}/api/v1/vision/extract`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
              });
              if (!response.ok) throw new Error("Upload failed");
              const data = await response.json();
              const solutionContent = data.solution
                ? `**Extracted Math:**\n\n${data.extracted_math}\n\n**Solution:**\n\n${data.solution}`
                : `**Extracted Math:**\n\n${data.extracted_math}`;
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: solutionContent, verificationStatus: 'verified' } : m));
              await incrementProgress();
            } catch {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: t('solve.errors.imageUnreadable') } : m));
            } finally {
              setIsLoading(false);
            }
          }
        }, 'image/jpeg');
      }
    }
  };

  // Get last user query for action buttons
  const lastUserQuery = [...messages].reverse().find(m => m.role === 'user')?.content || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '100%', margin: '0 auto' }}>

      {/* Messages area (Document Flow) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && (
          <div className="empty-state animate-fade-in" style={{ flex: 1 }}>
            <h2 className="text-gradient" style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>
              {t('home.headline')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '600px' }}>
              Get verified solutions, step-by-step explanations,
              and personalized practice.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxWidth: '800px', justifyContent: 'center' }}>
              {tArray('home.suggestions').map(q => (
                <button key={q} className="action-chip" onClick={() => { setInput(q); }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-in message">
            <div className={msg.role === 'user' ? 'message-user' : 'message-assistant'}>
              {/* Edit button for user messages */}
              {msg.role === 'user' && (
                <button title="Edit"
                  onClick={() => setInput(msg.content)}
                  style={{ float: 'right', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  aria-label="Edit message"
                >
                  <Edit2 size={16} />
                </button>
              )}

              {/* Verification badge */}
              {msg.role === 'assistant' && (
                <>
                {msg.verificationStatus === 'verified' && (
                  <div className="badge-verified" style={{ marginBottom: '1rem' }}>
                    <CheckCircle size={14} /> ✓ Verified
                  </div>
                )}
                {msg.verificationStatus === 'unverified' && (
                  <div className="badge-unverified" style={{ marginBottom: '1rem' }}>
                    <HelpCircle size={14} /> Unverified
                  </div>
                )}
                </>
              )}

              {/* Image */}
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="Uploaded" style={{ maxWidth: '100%', borderRadius: 'var(--radius-lg)', marginBottom: '1rem', border: '1px solid var(--border)' }} />
              )}

              {/* Content */}
              {msg.content && (
                <div className={msg.role === 'assistant' ? 'handwritten-math' : ''}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}>
                    {msg.content.replace(/\\\([\s\S]*?\\\)/g, (match) => '$' + match.slice(2, -2) + '$').replace(/\\\[[\s\S]*?\\\]/g, (match) => '$$$' + match.slice(2, -2) + '$$$')}
                  </ReactMarkdown>
                </div>
              )}

              {/* Action buttons for assistant messages */}
              {msg.role === 'assistant' && !isLoading && msg.content && (
                <div style={{ marginTop: '1.5rem' }}>
                  <SolutionActions problem={lastUserQuery} onAction={sendMessage} />
                  <MessageActionButtons content={msg.content} />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Camera scanner */}
        {isScanning && (
          <div className="card animate-fade-in" style={{ width: '100%', marginTop: '2rem' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 'var(--radius-lg)' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={stopCamera}><X size={18} /> Cancel</button>
              <button className="btn btn-primary" onClick={captureImage}><Camera size={18} /> Capture</button>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
           <div className="message animate-fade-in">
             <div className="message-assistant">
                <LoadingIndicator />
             </div>
           </div>
        )}

        <div ref={messagesEndRef} style={{ paddingBottom: '2rem' }} />
      </div>

      {/* Input area */}
      <form id="solve-form" onSubmit={handleSubmit} style={{ position: 'relative', marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageUpload} />
        <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} ref={pdfInputRef} onChange={handlePdfUpload} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', padding: '4px', paddingLeft: '12px' }}>
          
          <button type="button" className="icon-btn" title="Add Attachment" onClick={() => setShowAttachments(!showAttachments)} disabled={isLoading || isScanning} aria-label="Add attachment" style={{ marginRight: '8px' }}>
            <Plus size={20} />
          </button>
          
          {showAttachments && (
            <div className="card animate-fade-in" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', padding: '0.5rem', minWidth: '200px', zIndex: 10 }}>
              <button type="button" className="nav-link" onClick={() => { startCamera(); setShowAttachments(false); }}>
                <Camera size={16} /> {t('solve.attachments.scanMath')}
              </button>
              <button type="button" className="nav-link" onClick={() => { fileInputRef.current?.click(); setShowAttachments(false); }}>
                <ImageIcon size={16} /> {t('solve.attachments.uploadImage')}
              </button>
              <button type="button" className="nav-link" onClick={() => { pdfInputRef.current?.click(); setShowAttachments(false); }}>
                <FileText size={16} /> {t('solve.attachments.uploadPdf')}
              </button>
            </div>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={messages.length === 0 ? "Enter a math problem..." : "Ask a follow-up question..."}
            disabled={isLoading}
            aria-label={t('solve.placeholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '1rem', color: 'var(--text-primary)', padding: '12px 0' }}
          />
          
          <button type="submit" className="btn btn-primary" disabled={isLoading || !input.trim()} aria-label={t('solve.send')} style={{ borderRadius: 'var(--radius-lg)', padding: '10px 16px', marginLeft: '8px' }}>
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};
