import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { UploadCloud, FileCode2, Settings, RefreshCw, X, Activity, Brain, ChevronRight, ChevronLeft, Zap, Clock, Sparkles, ArrowRight, ArrowUp, ArrowDown, Coffee, Briefcase, Flame, Leaf, Check, AlertCircle, Trash2, Search, Command, Calendar as CalendarIcon, BarChart3, Repeat, Bot, MessageSquare } from 'lucide-react';
import logoImg from './assets/logo.jpg';
import './App.css';

/* ═══════════════════════════════════════════
   COMPONENT: Mini Calendar with Skip Days
   ═══════════════════════════════════════════ */
function SkipCalendar({ skipDates, setSkipDates, repeatWeekly, setRepeatWeekly }) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = new Date();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const toggleDate = (dateStr) => {
    if (skipDates.includes(dateStr)) {
      setSkipDates(skipDates.filter(d => d !== dateStr));
    } else {
      setSkipDates([...skipDates, dateStr]);
    }
  };

  const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const cells = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, current: false, dateStr: null });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    cells.push({ day: d, current: true, dateStr, isToday });
  }
  // Next month leading days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false, dateStr: null });
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button className="calendar-nav" onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <span className="calendar-month">{monthName} {year}</span>
        <button className="calendar-nav" onClick={nextMonth} aria-label="Next month"><ChevronRight size={16} /></button>
      </div>
      <div className="calendar-grid">
        {dayHeaders.map(d => <div key={d} className="calendar-day-header">{d}</div>)}
        {cells.map((cell, i) => (
          <button
            key={i}
            className={`calendar-day ${!cell.current ? 'other-month' : ''} ${cell.isToday ? 'today' : ''} ${cell.dateStr && skipDates.includes(cell.dateStr) ? 'skipped' : ''}`}
            onClick={() => cell.dateStr && toggleDate(cell.dateStr)}
            disabled={!cell.current}
            aria-label={cell.dateStr ? `Toggle skip for ${cell.dateStr}` : undefined}
          >
            {cell.day}
          </button>
        ))}
      </div>
      <label className="repeat-weekly-toggle">
        <input type="checkbox" checked={repeatWeekly} onChange={e => setRepeatWeekly(e.target.checked)} />
        <Repeat size={14} />
        <span>Repeat skipped weekdays every week</span>
      </label>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: GitHub Heatmap Preview
   ═══════════════════════════════════════════ */
function HeatmapPreview({ preset, skipDates }) {
  // Generate 15 weeks (105 days) of simulated activity
  const weeks = 15;
  const cells = [];
  const today = new Date();

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + (w * 7 + d));
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      let level = 0;
      const isSkipped = skipDates.includes(dateStr);

      if (!isSkipped) {
        if (preset === 'organic') {
          level = Math.random() > 0.1 ? Math.ceil(Math.random() * 3) : 0;
        } else if (preset === 'weekend') {
          level = (dayOfWeek === 0 || dayOfWeek === 6) ? Math.ceil(Math.random() * 4) : 0;
        } else if (preset === 'corporate') {
          level = (dayOfWeek >= 1 && dayOfWeek <= 5) ? Math.ceil(Math.random() * 3) : 0;
        } else if (preset === 'burnout') {
          level = (w % 3 === 0) ? Math.ceil(Math.random() * 4) : (Math.random() > 0.7 ? 1 : 0);
        }
      }

      cells.push({ level, week: w, day: d });
    }
  }

  return (
    <div className="heatmap-container">
      <h3 className="panel-title" style={{marginBottom: '12px'}}>
        <BarChart3 size={18} aria-hidden="true" /> Graph Preview
      </h3>
      <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {Array.from({ length: weeks }, (_, w) =>
          Array.from({ length: 7 }, (_, d) => {
            const cell = cells[w * 7 + d];
            return <div key={`${w}-${d}`} className={`heatmap-cell level-${cell.level}`} />;
          })
        )}
      </div>
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Less</span>
        {[0, 1, 2, 3, 4].map(l => <div key={l} className={`heatmap-cell level-${l}`} />)}
        <span className="heatmap-legend-label">More</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: Commit Timeline
   ═══════════════════════════════════════════ */
function CommitTimeline() {
  const events = [
    { time: '2 hours ago', file: 'utils.js', label: 'pushed', type: 'past' },
    { time: 'Yesterday, 3:14 PM', file: 'App.css', label: 'pushed', type: 'past' },
    { time: 'Yesterday, 11:02 AM', file: 'index.html', label: 'pushed', type: 'past' },
    { time: 'Today, ~4:30 PM', file: 'App.jsx', label: 'scheduled', type: 'upcoming' },
    { time: 'Tomorrow, ~2:15 PM', file: 'server.js', label: 'scheduled', type: 'upcoming' },
    { time: 'Jul 30, ~11:00 AM', file: 'database.py', label: 'scheduled', type: 'upcoming' },
  ];

  return (
    <div className="timeline-container">
      <h3 className="panel-title"><Clock size={18} /> Commit Timeline</h3>
      <div className="timeline-list">
        {events.map((ev, i) => (
          <div key={i} className="timeline-item">
            <div className="timeline-track">
              <div className={`timeline-dot ${ev.type}`}></div>
              {i < events.length - 1 && <div className="timeline-line"></div>}
            </div>
            <div className="timeline-info">
              <span className="timeline-file">{ev.file}</span>
              <span className="timeline-time">{ev.time}</span>
            </div>
            <span className={`timeline-label label-${ev.type}`}>{ev.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: AI Observer Widget
   ═══════════════════════════════════════════ */
function AIAssistantWidget({ latestDrop }) {
  const [message, setMessage] = useState("I'm analyzing your repo. Drop a code file to see what I think.");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (latestDrop) {
      setIsTyping(true);
      // Simulate AI 'thinking' delay
      const timer = setTimeout(() => {
        setIsTyping(false);
        const ext = latestDrop.split('.').pop().toLowerCase();
        let comment = `Ah, ${latestDrop}. `;
        if (ext === 'jsx' || ext === 'js') comment += "Looks like we're doing some frontend heavy lifting today. Solid components.";
        else if (ext === 'css') comment += "Styling updates! Making the UI pixel-perfect, I see.";
        else if (ext === 'rs') comment += "Rust backend changes. Memory safety FTW!";
        else if (ext === 'py') comment += "Python script. Keep those bot engines running smooth.";
        else comment += "Looks like a solid addition to the codebase. I'll make sure it gets pushed organically.";
        
        setMessage(comment);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [latestDrop]);

  return (
    <div className="ai-widget-container">
      <h3 className="panel-title" style={{marginBottom: '12px'}}>
        <Bot size={18} className="ai-pulse" /> AI Observer
      </h3>
      <div className="ai-chat-layout">
        <div className="ai-avatar">
          <Brain size={16} />
        </div>
        <div className="ai-bubble">
          {isTyping ? (
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          ) : (
            <p>{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: Command Palette (Ctrl+K)
   ═══════════════════════════════════════════ */
function CommandPalette({ isOpen, onClose, onAction }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const commands = [
    { id: 'dashboard', label: 'Go to Dashboard', icon: <Zap size={16} />, shortcut: 'D', action: () => onAction('navigate', 'dashboard') },
    { id: 'ai', label: 'Open AI Splitter', icon: <Brain size={16} />, shortcut: 'A', action: () => onAction('navigate', 'ai') },
    { id: 'settings', label: 'Open Settings', icon: <Settings size={16} />, shortcut: 'S', action: () => onAction('navigate', 'settings') },
    { id: 'config', label: 'Open Config Modal', icon: <Activity size={16} />, shortcut: 'C', action: () => onAction('config') },
    { id: 'sync', label: 'Sync to GitHub', icon: <RefreshCw size={16} />, shortcut: 'G', action: () => onAction('sync') },
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && filtered.length > 0) {
      filtered[0].action();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="cmd-palette" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cmd-search-wrapper">
          <Search size={18} className="cmd-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="cmd-search-input"
            placeholder="Type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search commands"
          />
          <kbd className="cmd-kbd-esc">ESC</kbd>
        </div>
        <div className="cmd-list" role="listbox">
          {filtered.map(cmd => (
            <button
              key={cmd.id}
              className="cmd-item"
              onClick={() => { cmd.action(); onClose(); }}
              role="option"
            >
              <span className="cmd-item-icon">{cmd.icon}</span>
              <span className="cmd-item-label">{cmd.label}</span>
              <kbd className="cmd-kbd">{cmd.shortcut}</kbd>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="cmd-empty">No commands found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: Toast Notification
   ═══════════════════════════════════════════ */
function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!message) return null;

  return (
    <div className="toast-container">
      <div className={`toast toast-${type}`} role="status" aria-live="polite">
        {type === 'success' && <Check size={16} />}
        {type === 'error' && <AlertCircle size={16} />}
        <span>{message}</span>
        <button className="close-btn" onClick={onDismiss} aria-label="Dismiss"><X size={14} /></button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE: Welcome
   ═══════════════════════════════════════════ */
function WelcomePage({ onGetStarted }) {
  return (
    <div className="welcome-page" role="main" aria-label="Welcome to Commit Chrono">
      <div className="bg-orb bg-orb-1" aria-hidden="true"></div>
      <div className="bg-orb bg-orb-2" aria-hidden="true"></div>
      <div className="bg-orb bg-orb-3" aria-hidden="true"></div>
      <div className="welcome-content">
        <img src={logoImg} alt="Commit Chrono Logo" className="welcome-logo" />
        <h1 className="welcome-title">Commit Chrono</h1>
        <p className="welcome-tagline">Your code. Your timeline. Unstoppable.</p>
        <p className="welcome-subtitle">
          Write massive amounts of code in a single session, then drip-feed real,
          granular commits to GitHub over days. No servers. No faking it.
        </p>
        <div className="feature-grid" role="list" aria-label="Key features">
          <div className="feature-card" role="listitem">
            <div className="feature-icon"><UploadCloud size={28} /></div>
            <h3>Drag, Drop & Forget</h3>
            <p>Drop your finished code files into the queue. Commit Chrono handles the rest.</p>
          </div>
          <div className="feature-card" role="listitem">
            <div className="feature-icon"><Clock size={28} /></div>
            <h3>Organic Scheduling</h3>
            <p>Randomized jitter, skip days, and human-like push patterns.</p>
          </div>
          <div className="feature-card" role="listitem">
            <div className="feature-icon"><Brain size={28} /></div>
            <h3>AI Code Splitter</h3>
            <p>Let AI slice your monolithic file into logical, iterative steps.</p>
          </div>
        </div>
        <button className="btn btn-primary btn-lg welcome-cta" onClick={onGetStarted} aria-label="Get started">
          <Sparkles size={20} /> Get Started <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE: Dashboard
   ═══════════════════════════════════════════ */
function DashboardPage({ schedules, activeSchedule, setActiveSchedule, queue, onRefreshQueue, onNavigate, activePreset, skipDates }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dropMessage, setDropMessage] = useState(null);
  const [latestDrop, setLatestDrop] = useState(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    let added = 0;
    let lastFileName = '';
    
    for (let i = 0; i < files.length; i++) {
      try {
        const filePath = files[i].path || files[i].name;
        await invoke('add_to_queue', { sourcePath: filePath, scheduleId: activeSchedule, fileType: 'feature' });
        added++;
        lastFileName = files[i].name;
      } catch (err) { console.error('Add failed:', err); }
    }
    
    if (added > 0) { 
      setDropMessage(`Added ${added} file(s)!`); 
      setLatestDrop(lastFileName);
      setTimeout(() => setDropMessage(null), 3000); 
      onRefreshQueue(); 
    }
  };

  const handleRemove = async (fileName) => {
    try { await invoke('remove_from_queue', { fileName }); onRefreshQueue(); } catch (err) { console.error(err); }
  };

  const moveItem = (index, direction) => {
    // Queue reordering (visual for now; would need backend persistence)
    console.log(`Move item ${index} ${direction}`);
  };

  const pendingItems = queue.filter(q => q.status === 'pending');
  const syncedItems = queue.filter(q => q.status === 'synced');
  const currentSchedule = schedules.find(s => s.id === activeSchedule);

  return (
    <div className="dashboard" role="main" aria-label="Dashboard">
      <div className="main-content">

        {/* LEFT SIDEBAR */}
        <aside className="sidebar sidebar-left" aria-label="Schedules and timeline">
          <div className="glass-panel" style={{flex: 1}}>
            <h2 className="panel-title"><Zap size={18} aria-hidden="true" /> Schedules</h2>
            <div className="schedule-list" role="listbox">
              {schedules.map(s => (
                <div key={s.id} className={`schedule-card ${activeSchedule === s.id ? 'active' : ''}`}
                  onClick={() => setActiveSchedule(s.id)} onKeyDown={e => e.key === 'Enter' && setActiveSchedule(s.id)}
                  role="option" aria-selected={activeSchedule === s.id} tabIndex={0}>
                  <div className="schedule-header">
                    <span className="schedule-id">{s.id}</span>
                    <span className={`schedule-badge badge-${s.mode}`}>{s.mode}</span>
                  </div>
                  <div className="schedule-meta">
                    <span className="schedule-repo">{s.repo}</span>
                    <span className="schedule-branch"><ChevronRight size={12} /> {s.branch}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commit Timeline */}
          <div className="glass-panel">
            <CommitTimeline />
          </div>

          {/* AI Observer Widget */}
          <div className="glass-panel" style={{flex: 1}}>
            <AIAssistantWidget latestDrop={latestDrop} />
          </div>
        </aside>

        {/* CENTER */}
        <section className="center-content" aria-label="Drop zone and heatmap">
          <div className="glass-panel drop-zone-container">
            <h2 className="panel-title">
              Add to Queue {currentSchedule && <span className="panel-title-accent">&mdash; {currentSchedule.id}</span>}
            </h2>
            <div className={`drop-zone ${isDragging ? 'active' : ''}`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              role="button" tabIndex={0} aria-label="Drop code files here">
              {dropMessage ? (
                <><Check size={56} className="drop-icon" style={{color:'var(--success)'}} /><h3 className="drop-title" style={{color:'var(--success)'}}>{dropMessage}</h3></>
              ) : (
                <><UploadCloud size={56} className="drop-icon" /><h3 className="drop-title">Drop code files here</h3>
                <p className="drop-subtitle">Files will be queued for <strong>'{activeSchedule}'</strong></p></>
              )}
              <div className="drop-actions">
                <button className="btn btn-ai" onClick={() => onNavigate('ai')}><Brain size={18} /> Split with AI</button>
              </div>
            </div>
          </div>

          {/* Heatmap Preview */}
          <div className="glass-panel" style={{marginTop: '16px'}}>
            <HeatmapPreview preset={activePreset} skipDates={skipDates} />
          </div>
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className="sidebar sidebar-right" aria-label="Pending queue">
          <div className="glass-panel" style={{flex: 1}}>
            <h2 className="panel-title">
              <FileCode2 size={18} /> Queue <span className="queue-count">{pendingItems.length} pending</span>
            </h2>
            {queue.length === 0 ? (
              <div className="empty-state" role="status">
                <FileCode2 size={32} /><p>No files queued.</p><p className="empty-hint">Drag files to the center to begin.</p>
              </div>
            ) : (
              <div className="queue-list" role="list">
                {pendingItems.map((q, idx) => (
                  <div key={`p-${idx}`} className="queue-item" role="listitem">
                    <span className="status-dot dot-pending"></span>
                    <span className="queue-name">{q.name}</span>
                    <div className="reorder-btns">
                      <button className="reorder-btn" onClick={() => moveItem(idx, 'up')} aria-label="Move up" disabled={idx === 0}><ArrowUp size={12} /></button>
                      <button className="reorder-btn" onClick={() => moveItem(idx, 'down')} aria-label="Move down" disabled={idx === pendingItems.length - 1}><ArrowDown size={12} /></button>
                    </div>
                    <button className="btn-icon" onClick={() => handleRemove(q.name)} aria-label={`Remove ${q.name}`}><Trash2 size={14} /></button>
                  </div>
                ))}
                {syncedItems.map((q, idx) => (
                  <div key={`s-${idx}`} className="queue-item" role="listitem" style={{opacity: 0.5}}>
                    <span className="status-dot dot-synced"></span>
                    <span className="queue-name">{q.name}</span>
                    <span className="queue-type">pushed</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE: AI Splitter
   ═══════════════════════════════════════════ */
function AIPage({ onNavigate }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false); setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setResults([
        { step: 1, name: 'HTML Skeleton', lines: '1-45', desc: 'Base HTML structure and semantic elements' },
        { step: 2, name: 'CSS Foundation', lines: '46-120', desc: 'Core styling, variables, and layout grid' },
        { step: 3, name: 'Component Logic', lines: '121-280', desc: 'React state management and event handlers' },
        { step: 4, name: 'API Integration', lines: '281-380', desc: 'Data fetching, error handling, and caching' },
        { step: 5, name: 'Polish & Animations', lines: '381-500', desc: 'Micro-interactions, transitions, and a11y' },
      ]);
    }, 3000);
  };

  return (
    <div className="ai-page" role="main" aria-label="AI Code Splitter">
      <div className="ai-content">
        <div className="glass-panel ai-panel">
          <div className="ai-header">
            <h2 className="panel-title"><Brain size={22} /> AI Code Splitter</h2>
            <button className="btn btn-ghost" onClick={() => onNavigate('dashboard')}><ArrowRight size={16} style={{transform:'rotate(180deg)'}} /> Back</button>
          </div>
          <p className="ai-desc">Drop a large, monolithic code file below. Commit Chrono's AI will reverse-engineer it into logical, iterative development steps.</p>
          {!results && !isProcessing && (
            <div className={`drop-zone ai-drop ${isDragging ? 'active' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}
              role="button" tabIndex={0}>
              <Brain size={48} className="drop-icon" /><h3 className="drop-title">Drop a monolithic file</h3><p className="drop-subtitle">AI will slice it into logical commit steps</p>
            </div>
          )}
          {isProcessing && (
            <div className="ai-processing" role="status" aria-live="polite">
              <div className="scan-line" aria-hidden="true"></div>
              <Brain size={48} className="ai-pulse" /><h3>Analyzing code structure...</h3><p className="text-muted">Identifying logical boundaries and dependencies</p>
            </div>
          )}
          {results && (
            <div className="ai-results" role="list">
              <h3 className="results-title"><Check size={18} /> Split into {results.length} steps</h3>
              {results.map(r => (
                <div key={r.step} className="result-card" role="listitem">
                  <div className="result-step">Step {r.step}</div>
                  <div className="result-info"><span className="result-name">{r.name}</span><span className="result-desc">{r.desc}</span></div>
                  <span className="result-lines">L{r.lines}</span>
                </div>
              ))}
              <button className="btn btn-primary" style={{marginTop:'16px',width:'100%',justifyContent:'center'}}><Sparkles size={16} /> Add All to Queue</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE: Settings
   ═══════════════════════════════════════════ */
function SettingsPage({ onNavigate }) {
  return (
    <div className="settings-page" role="main" aria-label="Settings">
      <div className="settings-content">
        <div className="glass-panel settings-panel">
          <div className="settings-header">
            <h2 className="panel-title"><Settings size={22} /> Settings</h2>
            <button className="btn btn-ghost" onClick={() => onNavigate('dashboard')}><ArrowRight size={16} style={{transform:'rotate(180deg)'}} /> Back</button>
          </div>
          <div className="settings-group">
            <h3 className="settings-label">GitHub Authentication</h3>
            <div className="settings-row">
              <label htmlFor="gh-pat">Personal Access Token (GH_PAT)</label>
              <input id="gh-pat" type="password" placeholder="ghp_xxxxxxxxxxxx" className="input-field" />
            </div>
          </div>
          <div className="settings-group">
            <h3 className="settings-label">Discord Alerts</h3>
            <div className="settings-row">
              <label htmlFor="webhook-url">Webhook URL</label>
              <input id="webhook-url" type="url" placeholder="https://discord.com/api/webhooks/..." className="input-field" />
            </div>
          </div>
          <div className="settings-group">
            <h3 className="settings-label">Commit Messages</h3>
            <div className="settings-row">
              <label htmlFor="commit-pool">Message Pool (one per line)</label>
              <textarea id="commit-pool" rows={4} className="input-field" defaultValue={"tweak\nhousekeeping\ncleanup\nrefactor\nminor update"} />
            </div>
          </div>
          <button className="btn btn-primary" style={{marginTop:'16px',width:'100%',justifyContent:'center'}}><Check size={16} /> Save Settings</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: Config Modal
   ═══════════════════════════════════════════ */
function ConfigModal({ isOpen, onClose, activeSchedule, activePreset, setActivePreset, schedules, skipDates, setSkipDates, repeatWeekly, setRepeatWeekly }) {
  if (!isOpen) return null;

  const currentSchedule = schedules.find(s => s.id === activeSchedule);
  const [timeStart, setTimeStart] = useState(currentSchedule?.times?.[0] || '09:00');
  const [jitter, setJitter] = useState(currentSchedule?.jitterMinutes || 120);

  const presets = [
    { id: 'organic', title: 'The Organic Human', icon: <Leaf size={20} />, desc: 'Consistent pushes with 10% skip days.' },
    { id: 'weekend', title: 'Weekend Warrior', icon: <Coffee size={20} />, desc: 'Only Saturdays and Sundays.' },
    { id: 'corporate', title: 'The 9-to-5', icon: <Briefcase size={20} />, desc: 'Monday-Friday, 9am-5pm.' },
    { id: 'burnout', title: 'Burnout Spikes', icon: <Flame size={20} />, desc: 'Massive clumps then silences.' },
  ];

  const handleSave = async () => {
    if (currentSchedule) {
      currentSchedule.times = [timeStart];
      currentSchedule.jitterMinutes = parseInt(jitter) || 120;
      currentSchedule.skipDates = skipDates;
      try { await invoke('write_config', { config: { schedules } }); } catch (err) { console.error(err); }
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure: {activeSchedule}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        <div className="modal-section">
          <h3 className="modal-section-title"><Activity size={16} /> Graph Intensity Profile</h3>
          <div className="preset-grid" role="radiogroup">
            {presets.map(p => (
              <div key={p.id} className={`preset-card ${activePreset === p.id ? 'active' : ''}`}
                onClick={() => setActivePreset(p.id)} role="radio" aria-checked={activePreset === p.id} tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActivePreset(p.id)}>
                <div className="preset-icon">{p.icon}</div>
                <div className="preset-title">{p.title}</div>
                <div className="preset-desc">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <h3 className="modal-section-title"><Clock size={16} /> Time & Jitter</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cfg-time">Push Time</label>
              <input id="cfg-time" type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className="input-field" />
            </div>
            <div className="form-group">
              <label htmlFor="cfg-jitter">Jitter (min)</label>
              <input id="cfg-jitter" type="number" value={jitter} onChange={e => setJitter(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3 className="modal-section-title"><CalendarIcon size={16} /> Skip Days Calendar</h3>
          <p className="modal-section-desc">Click dates to mark them as skip days. Commit Chrono will not push on these days.</p>
          <SkipCalendar skipDates={skipDates} setSkipDates={setSkipDates} repeatWeekly={repeatWeekly} setRepeatWeekly={setRepeatWeekly} />
        </div>

        <div className="modal-section">
          <h3 className="modal-section-title"><BarChart3 size={16} /> Live Heatmap Preview</h3>
          <HeatmapPreview preset={activePreset} skipDates={skipDates} />
        </div>

        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:'8px'}} onClick={handleSave}>
          <Check size={16} /> Save Schedule Config
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════ */
function AppHeader({ currentPage, onNavigate, onOpenConfig, syncState, onSyncClick, onOpenCmdPalette }) {
  return (
    <header className="header" role="banner">
      <div className="header-left">
        <img src={logoImg} alt="Commit Chrono" className="header-logo" />
        <h1 className="header-title">Commit Chrono</h1>
      </div>
      <nav className="header-nav" role="navigation" aria-label="Main">
        <button className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}><Zap size={16} /> Dashboard</button>
        <button className={`nav-btn ${currentPage === 'ai' ? 'active' : ''}`} onClick={() => onNavigate('ai')}><Brain size={16} /> AI Splitter</button>
        <button className={`nav-btn ${currentPage === 'settings' ? 'active' : ''}`} onClick={() => onNavigate('settings')}><Settings size={16} /> Settings</button>
      </nav>
      <div className="header-right">
        <button className="btn btn-ghost" onClick={onOpenCmdPalette} aria-label="Command palette (Ctrl+K)" title="Ctrl+K">
          <Command size={16} /> <kbd className="cmd-kbd-sm">Ctrl+K</kbd>
        </button>
        <button className="btn btn-ghost" onClick={onOpenConfig} aria-label="Config"><Activity size={18} /> Config</button>
        <button className={`btn btn-sync ${syncState}`} onClick={onSyncClick} disabled={syncState === 'syncing'}>
          {syncState === 'idle' && <><RefreshCw size={18} /> Sync</>}
          {syncState === 'syncing' && <><RefreshCw size={18} className="spin" /> Syncing...</>}
          {syncState === 'success' && <><Check size={18} /> Synced!</>}
        </button>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════
   ROOT APP
   ═══════════════════════════════════════════ */
function App() {
  const [currentPage, setCurrentPage] = useState('welcome');
  const [activeSchedule, setActiveSchedule] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [activePreset, setActivePreset] = useState('organic');
  const [syncState, setSyncState] = useState('idle');
  const [schedules, setSchedules] = useState([]);
  const [queue, setQueue] = useState([]);
  const [skipDates, setSkipDates] = useState([]);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const loadData = useCallback(async () => {
    try {
      const config = await invoke('read_config');
      setSchedules(config.schedules);
      if (config.schedules.length > 0 && !activeSchedule) setActiveSchedule(config.schedules[0].id);
      const current = config.schedules.find(s => s.id === activeSchedule);
      if (current?.skipDates) setSkipDates(current.skipDates);
    } catch (err) { console.error('Config load error:', err); }
    try { const q = await invoke('read_queue'); setQueue(q); } catch (err) { console.error('Queue load error:', err); }
  }, [activeSchedule]);

  useEffect(() => {
    if (currentPage !== 'welcome') loadData();
  }, [currentPage, loadData]);

  // Ctrl+K listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setIsCmdOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSync = async () => {
    setSyncState('syncing');
    try {
      const result = await invoke('sync_to_github');
      setSyncState('success');
      showToast(result.message, 'success');
      setTimeout(() => setSyncState('idle'), 2500);
    } catch (err) {
      setSyncState('idle');
      showToast(String(err), 'error');
    }
  };

  const handleCmdAction = (type, payload) => {
    if (type === 'navigate') setCurrentPage(payload);
    if (type === 'config') setIsConfigOpen(true);
    if (type === 'sync') handleSync();
  };

  const navigate = (page) => setCurrentPage(page);

  if (currentPage === 'welcome') return <WelcomePage onGetStarted={() => navigate('dashboard')} />;

  return (
    <div className="app-container">
      <AppHeader currentPage={currentPage} onNavigate={navigate} onOpenConfig={() => setIsConfigOpen(true)}
        syncState={syncState} onSyncClick={handleSync} onOpenCmdPalette={() => setIsCmdOpen(true)} />

      {currentPage === 'dashboard' && (
        <DashboardPage schedules={schedules} activeSchedule={activeSchedule} setActiveSchedule={setActiveSchedule}
          queue={queue} onRefreshQueue={loadData} onNavigate={navigate} activePreset={activePreset} skipDates={skipDates} />
      )}
      {currentPage === 'ai' && <AIPage onNavigate={navigate} />}
      {currentPage === 'settings' && <SettingsPage onNavigate={navigate} />}

      <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} activeSchedule={activeSchedule}
        activePreset={activePreset} setActivePreset={setActivePreset} schedules={schedules}
        skipDates={skipDates} setSkipDates={setSkipDates} repeatWeekly={repeatWeekly} setRepeatWeekly={setRepeatWeekly} />

      <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} onAction={handleCmdAction} />

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default App;
