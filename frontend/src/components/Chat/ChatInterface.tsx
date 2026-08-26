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
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        {copied ? <span style={{ fontSize: '0.75rem' }}>{t('common.copied')}</span> : <Copy size={14} />}
      </button>
      <button title="Share" onClick={() => { navigator.clipboard.writeText(window.location.origin + '/solve?q=' + encodeURIComponent(content.substring(0, 200))); }} className="btn btn-ghost" style={{ opacity: 0.6 }} aria-label="Share solution">
        <Share2 size={14} />
      </button>
    </div>
  );
};

/* ── Solution Action Chips ──────────────────────────────────────────── */
const SolutionActions: React.FC<{ problem: string; onAction: (query: string) => void }> = ({ problem, onAction }) => {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
      <button className="action-chip" onClick={() => onAction(`Check my work for: ${problem}`)}>
        <CheckCircle size={14} /> {t('solve.actions.checkMyWork')}
      </button>
      <button className="action-chip" onClick={() => onAction(`Something looks wrong? Check Again and verify step-by-step for: ${problem}`)}>
        <RefreshCw size={14} /> {t('solve.actions.checkAgain')}
      </button>
      <button className="action-chip" onClick={() => onAction(`Explain WHY each step works in this solution for: ${problem}`)}>
        <HelpCircle size={14} /> {t('solve.actions.why')}
      </button>
      <button className="action-chip" onClick={() => onAction(`Show me a DIFFERENT METHOD to solve: ${problem}`)}>
        <RefreshCw size={14} /> {t('solve.actions.anotherMethod')}
      </button>
      <button className="action-chip" onClick={() => onAction(`Give me a hint for solving: ${problem}`)}>
        <Lightbulb size={14} /> {t('solve.actions.hint')}
      </button>
      <button className="action-chip" onClick={() => onAction(`Teach me how to solve this without giving the answer: ${problem}`)}>
        <BookOpen size={14} /> {t('solve.actions.teachMe')}
      </button>
      <button className="action-chip" onClick={() => onAction(`Generate a similar practice problem to: ${problem}`)}>
        <Sparkles size={14} /> {t('solve.actions.similarProblem')}
      </button>
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

  const sendMessage = async (query: string) => {
    if (!query.trim() || !user) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query };
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
        body: JSON.stringify({ query: query, session_id: sessionId })
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
            id: sessionId,
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'var(--space-lg)', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' }}>
        {messages.length === 0 && (
          <div className="empty-state animate-fade-in" style={{ flex: 1 }}>
            <h2 className="text-gradient" style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>
              {t('home.headline')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px' }}>
              {t('home.subheadline')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '600px' }}>
              {tArray('home.suggestions').map(q => (
                <button key={q} className="action-chip" onClick={() => { setInput(q); }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-in" style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', width: msg.role === 'assistant' ? '100%' : undefined }}>
            <div className={`message ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}>
              {/* Edit button for user messages */}
              {msg.role === 'user' && (
                <button title="Edit"
                  onClick={() => setInput(msg.content)}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
                  aria-label="Edit message"
                >
                  <Edit2 size={12} />
                </button>
              )}

              {/* Verification badge */}
              {msg.role === 'assistant' && (
                <>
                {msg.verificationStatus === 'verified' && (
                  <div className="badge-verified" style={{ marginBottom: '0.75rem' }}>
                    <CheckCircle size={14} /> ✓ Symbolically verified
                  </div>
                )}
                {msg.verificationStatus === 'unverified' && (
                  <div className="badge-unverified" style={{ marginBottom: '0.75rem', opacity: 0.8 }}>
                    <HelpCircle size={14} /> Verification unavailable
                  </div>
                )}
                </>
              )}

              {/* Image */}
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="Uploaded" style={{ maxWidth: '100%', borderRadius: 'var(--radius)', marginBottom: '0.5rem' }} />
              )}

              {/* Content */}
              {msg.content && (
                <div className={msg.role === 'assistant' ? 'handwritten-math' : ''}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Action buttons for assistant messages */}
              {msg.role === 'assistant' && !isLoading && msg.content && (
                <>
                  <MessageActionButtons content={msg.content} />
                  <SolutionActions problem={lastUserQuery} onAction={sendMessage} />
                </>
              )}
            </div>
          </div>
        ))}

        {/* Camera scanner */}
        {isScanning && (
          <div className="card animate-fade-in" style={{ alignSelf: 'center', width: '100%', maxWidth: '400px' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 'var(--radius)' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button className="btn btn-danger" onClick={stopCamera}><X size={18} /> {t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={captureImage}><Camera size={18} /> Capture</button>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && <LoadingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form id="solve-form" onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageUpload} />
        <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} ref={pdfInputRef} onChange={handlePdfUpload} />

        <div style={{ position: 'relative' }}>
          <button type="button" className="btn btn-outline" title="Add Attachment" onClick={() => setShowAttachments(!showAttachments)} disabled={isLoading || isScanning} aria-label="Add attachment">
            <Plus size={20} />
          </button>
          {showAttachments && (
            <div className="card animate-fade-in" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px', padding: '0.5rem', minWidth: '180px', zIndex: 10 }}>
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
        </div>

        <input
          type="text"
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('solve.placeholder')}
          disabled={isLoading}
          aria-label={t('solve.placeholder')}
        />
        <button type="submit" className="btn btn-primary" disabled={isLoading || !input.trim()} aria-label={t('solve.send')}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};
