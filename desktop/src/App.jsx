import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { UploadCloud, FileCode2, Settings, RefreshCw, X, Activity, Brain, ChevronRight, ChevronLeft, Zap, Clock, Sparkles, ArrowRight, ArrowUp, ArrowDown, Coffee, Briefcase, Flame, Leaf, Check, AlertCircle, Trash2, Search, Command, Calendar as CalendarIcon, BarChart3, Repeat, Bot, MessageSquare, Plus } from 'lucide-react';
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
function DashboardPage({ schedules, activeSchedule, setActiveSchedule, queue, onRefreshQueue, onNavigate, activePreset, skipDates, onSelectQueueItem, onAddRepo, onRemoveRepo }) {
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
        <aside className="sidebar sidebar-left" aria-label="Schedules and Heatmap">
          <div className="glass-panel" style={{flex: 1, overflowY: 'auto', minHeight: '200px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <h2 className="panel-title" style={{marginBottom:0}}><Zap size={18} aria-hidden="true" /> Schedules</h2>
              <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:'0.8rem'}} onClick={onAddRepo}>
                <Plus size={14} /> Add Repo
              </button>
            </div>
            <div className="schedule-list" role="listbox">
              {schedules.map(s => (
                <div key={s.id} className={`schedule-card ${activeSchedule === s.id ? 'active' : ''}`}
                  onClick={() => setActiveSchedule(s.id)} onKeyDown={e => e.key === 'Enter' && setActiveSchedule(s.id)}
                  role="option" aria-selected={activeSchedule === s.id} tabIndex={0}>
                  <div className="schedule-header">
                    <span className="schedule-id">{s.id}</span>
                    <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                      <span className={`schedule-badge badge-${s.mode}`}>{s.mode}</span>
                      <button className="btn-icon" style={{padding:2}} onClick={(e) => { e.stopPropagation(); onRemoveRepo(s.id); }} aria-label={`Remove ${s.id}`}>
                        <Trash2 size={14} style={{color:'var(--text-muted)'}} />
                      </button>
                    </div>
                  </div>
                  <div className="schedule-meta">
                    <span className="schedule-repo">{s.repo}</span>
                    <span className="schedule-branch"><ChevronRight size={12} /> {s.branch}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{flexShrink: 0, marginTop: '16px'}}>
            <HeatmapPreview preset={activePreset} skipDates={skipDates} />
          </div>
        </aside>

        {/* CENTER */}
        <section className="center-content" aria-label="Drop zone and Insights">
          <div className="glass-panel drop-zone-container" style={{flex: 1, minHeight: '200px'}}>
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

          <div className="center-insights-row" style={{display: 'flex', gap: '16px', height: '220px', flexShrink: 0, marginTop: '16px'}}>
            <div className="glass-panel" style={{flex: 1, overflowY: 'auto'}}>
              <CommitTimeline />
            </div>
            <div className="glass-panel" style={{flex: 1, overflowY: 'auto'}}>
              <AIAssistantWidget latestDrop={latestDrop} />
            </div>
          </div>
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className="sidebar sidebar-right" aria-label="Pending queue and Novelty">
          <div className="glass-panel" style={{flex: 1, overflowY: 'auto', minHeight: '200px'}}>
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
                  <div key={`p-${idx}`} className="queue-item" role="listitem" onClick={() => onSelectQueueItem(q)} style={{cursor: 'pointer'}}>
                    <span className="status-dot dot-pending"></span>
                    <span className="queue-name" style={{flex:1}}>{q.name}</span>
                    {q.depends_on && <span className="queue-type" style={{color:'var(--warning)'}}>wait</span>}
                    {q.held && <span className="queue-type" style={{color:'var(--danger)'}}>held</span>}
                    <div className="reorder-btns" onClick={e => e.stopPropagation()}>
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

          <div className="glass-panel" style={{flexShrink: 0, marginTop: '16px'}}>
            <h2 className="panel-title" style={{marginBottom: '12px'}}><Brain size={18} /> AI & Habits</h2>
            <div className="novelty-toggles">
              <label className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Auto-Split Large Files</span>
                  <span className="toggle-desc">Automatically use Gemini AI to split files</span>
                </div>
                <input type="checkbox" className="switch-input" />
              </label>
              <label className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Strict Habit Nudges</span>
                  <span className="toggle-desc">Send mobile alerts if I miss my Habit Goal</span>
                </div>
                <input type="checkbox" className="switch-input" defaultChecked />
              </label>
            </div>
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
function SettingsPage({ onNavigate, settings, setSettings, onSaveSettings }) {
  const handleChange = (k, v) => setSettings(prev => ({ ...prev, [k]: v }));

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
              <input id="gh-pat" type="password" placeholder="ghp_xxxxxxxxxxxx" className="input-field" value={settings.ghPat || ''} onChange={e => handleChange('ghPat', e.target.value)} />
            </div>
          </div>
          <div className="settings-group">
            <h3 className="settings-label">AI Engine (Gemini)</h3>
            <div className="settings-row">
              <label htmlFor="ai-key">Gemini API Key</label>
              <input id="ai-key" type="password" placeholder="AIzaSy..." className="input-field" value={settings.geminiApiKey || ''} onChange={e => handleChange('geminiApiKey', e.target.value)} />
            </div>
          </div>
          <div className="settings-group">
            <h3 className="settings-label">Alert Notifications</h3>
            <div className="settings-row" style={{marginBottom:'8px'}}>
              <label htmlFor="alert-provider">Provider</label>
              <select id="alert-provider" className="input-field" style={{appearance:'auto', background:'rgba(255,255,255,0.05)'}} value={settings.alertProvider || 'discord'} onChange={e => handleChange('alertProvider', e.target.value)}>
                <option value="discord">Discord Webhook</option>
                <option value="ntfy">Ntfy.sh</option>
              </select>
            </div>
            <div className="settings-row">
              <label htmlFor="webhook-url">Target URL / Topic</label>
              <input id="webhook-url" type="url" placeholder="https://discord.com/... OR ntfy.sh/topic" className="input-field" value={settings.webhookUrl || ''} onChange={e => handleChange('webhookUrl', e.target.value)} />
            </div>
          </div>
          <div className="settings-group">
            <h3 className="settings-label">Commit Messages (Summary)</h3>
            <div className="settings-row">
              <label htmlFor="commit-pool">Message Pool (one per line) - AI will fall back to these if needed</label>
              <textarea id="commit-pool" rows={4} className="input-field" placeholder="tweak\nhousekeeping\ncleanup\nrefactor\nminor update" value={settings.commitPool || ''} onChange={e => handleChange('commitPool', e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" style={{marginTop:'16px',width:'100%',justifyContent:'center'}} onClick={onSaveSettings}><Check size={16} /> Save Settings</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: Queue Item Modal
   ═══════════════════════════════════════════ */
function QueueItemModal({ item, allItems, onClose, onRefreshQueue }) {
  if (!item) return null;
  const [dependsOn, setDependsOn] = useState(item.dependsOn || '');
  const [notEligibleUntil, setNotEligibleUntil] = useState(item.notEligibleUntil || '');
  const [priority, setPriority] = useState(item.priority || 'normal');
  const [held, setHeld] = useState(item.held || false);

  const handleSave = async () => {
    try {
      await invoke('update_item_meta', { 
        fileName: item.name, 
        dependsOn: dependsOn, 
        notEligibleUntil: notEligibleUntil, 
        priority: priority, 
        held: held 
      });
      onRefreshQueue();
    } catch (err) { console.error(err); }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '480px'}}>
        <div className="modal-header">
          <h2>Item Details: {item.name}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
        
        <div className="modal-section">
          <div className="form-row" style={{marginBottom:'12px'}}>
            <div className="form-group" style={{flex:1}}>
              <label>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="input-field" style={{appearance:'auto', background:'rgba(255,255,255,0.05)'}}>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{marginBottom:'12px'}}>
            <label>Must Wait For (Dependency)</label>
            <select value={dependsOn} onChange={e => setDependsOn(e.target.value)} className="input-field" style={{appearance:'auto', background:'rgba(255,255,255,0.05)'}}>
              <option value="">-- None --</option>
              {allItems.filter(i => i.name !== item.name && i.status === 'pending').map(i => (
                <option key={i.name} value={i.name}>{i.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{marginBottom:'12px'}}>
            <label>Do Not Push Before (Date)</label>
            <input type="datetime-local" value={notEligibleUntil} onChange={e => setNotEligibleUntil(e.target.value)} className="input-field" />
          </div>

          <label className="toggle-row" style={{background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border-subtle)'}}>
            <div className="toggle-info">
              <span className="toggle-label" style={{color: held ? 'var(--danger)' : 'var(--text-primary)'}}>Hold (Suspend Push)</span>
            </div>
            <input type="checkbox" className="switch-input" checked={held} onChange={e => setHeld(e.target.checked)} />
          </label>
        </div>

        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:'16px'}} onClick={handleSave}>
          <Check size={16} /> Save Item Meta
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: Add Repo Modal
   ═══════════════════════════════════════════ */
function AddRepoModal({ isOpen, onClose, settings, onAdd }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (!settings.ghPat) {
        setError("Please set your GitHub PAT in Settings first.");
        return;
      }
      setLoading(true);
      invoke('fetch_github_repos', { pat: settings.ghPat })
        .then(res => { setRepos(res); setError(null); })
        .catch(err => setError(String(err)))
        .finally(() => setLoading(false));
    }
  }, [isOpen, settings.ghPat]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '600px'}}>
        <div className="modal-header">
          <h2><Zap size={22} style={{verticalAlign:'middle',marginRight:8}} /> Add Repository</h2>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        
        {error && <div className="error-banner" style={{background:'var(--danger)',padding:12,borderRadius:8,marginBottom:16}}>{error}</div>}
        {loading && <div style={{textAlign:'center',padding:40}}><RefreshCw size={24} className="spin" /><p>Fetching your repositories...</p></div>}
        
        {!loading && !error && (
          <div style={{maxHeight:'400px',overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
            {repos.length === 0 && <p style={{color:'var(--text-muted)'}}>No repositories found.</p>}
            {repos.map(r => (
              <div key={r.id} className="preset-card" onClick={() => { onAdd(r.full_name, r.default_branch); onClose(); }} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <strong>{r.name}</strong>
                  <div style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>{r.full_name}</div>
                </div>
                <div style={{fontSize:'0.8rem',background:'rgba(255,255,255,0.1)',padding:'2px 8px',borderRadius:4}}>{r.private ? 'Private' : 'Public'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: Setup Wizard
   ═══════════════════════════════════════════ */
function SetupWizard({ onComplete, settings, setSettings }) {
  const [step, setStep] = useState(1);

  const next = () => setStep(s => Math.min(s + 1, 4));
  const prev = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="modal-overlay" style={{zIndex: 9999, backdropFilter:'blur(8px)'}}>
      <div className="modal-content" style={{maxWidth: '700px', border:'1px solid var(--accent)'}}>
        <div className="modal-header" style={{borderBottom:'1px solid var(--border-subtle)', paddingBottom:16}}>
          <h2 style={{display:'flex',alignItems:'center',gap:8}}><Sparkles size={24} color="var(--accent)" /> Welcome to Commit Chrono</h2>
          <span style={{color:'var(--text-muted)'}}>Step {step} of 4</span>
        </div>
        
        <div style={{minHeight: 300, paddingTop: 24}}>
          {step === 1 && (
            <div>
              <h3 style={{fontSize:'1.2rem', marginBottom:16}}>1. Connect your GitHub</h3>
              <p style={{color:'var(--text-secondary)', marginBottom:16}}>To securely push code directly from your machine without any central servers, we need a Personal Access Token (PAT).</p>
              <ol style={{color:'var(--text-secondary)', marginBottom:24, paddingLeft:24, lineHeight:1.8}}>
                <li>Go to GitHub.com &gt; Settings &gt; Developer Settings &gt; Personal Access Tokens (Classic).</li>
                <li>Click <strong>Generate new token (classic)</strong>.</li>
                <li>Check the <strong>repo</strong> scope (full control of private repositories).</li>
                <li>Paste the generated token below:</li>
              </ol>
              <input type="password" placeholder="ghp_..." className="input-field" style={{width:'100%'}} 
                value={settings.ghPat || ''} onChange={e => setSettings(p => ({...p, ghPat: e.target.value}))} />
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={{fontSize:'1.2rem', marginBottom:16}}>2. Set up Notifications</h3>
              <p style={{color:'var(--text-secondary)', marginBottom:16}}>Get mobile alerts before the bot makes a push, giving you time to hit [ABORT].</p>
              <div className="form-group" style={{marginBottom:16}}>
                <label>Provider</label>
                <select className="input-field" value={settings.alertProvider || 'discord'} onChange={e => setSettings(p => ({...p, alertProvider: e.target.value}))}>
                  <option value="discord">Discord Webhook</option>
                  <option value="ntfy">Ntfy.sh (Recommended for privacy)</option>
                </select>
              </div>
              <div className="form-group">
                <label>URL or Topic</label>
                <input type="url" placeholder={settings.alertProvider === 'ntfy' ? "https://ntfy.sh/my_secret_topic" : "https://discord.com/api/webhooks/..."} 
                  className="input-field" value={settings.webhookUrl || ''} onChange={e => setSettings(p => ({...p, webhookUrl: e.target.value}))} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{fontSize:'1.2rem', marginBottom:16}}>3. AI Engine & Habit Goals</h3>
              <p style={{color:'var(--text-secondary)', marginBottom:24}}>Commit Chrono uses Google's Gemini AI to automatically split your monolithic files into iterative commits. It also helps you build real coding habits.</p>
              
              <div className="form-group" style={{marginBottom:24}}>
                <label>Gemini API Key (Optional)</label>
                <input type="password" placeholder="AIzaSy..." className="input-field" style={{width:'100%'}} 
                  value={settings.geminiApiKey || ''} onChange={e => setSettings(p => ({...p, geminiApiKey: e.target.value}))} />
              </div>

              <div style={{display:'flex', gap:16}}>
                <div className="glass-panel" style={{flex:1, padding:16}}>
                  <h4 style={{color:'var(--accent)', marginBottom:8}}><Brain size={16} /> AI Code Splitter</h4>
                  <p style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>The AI will analyze large files you drop into the queue and automatically break them down into smaller, logical commits for a pristine git history.</p>
                </div>
                <div className="glass-panel" style={{flex:1, padding:16}}>
                  <h4 style={{color:'var(--warning)', marginBottom:8}}><Flame size={16} /> Streak Protector</h4>
                  <p style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>Select a Habit Goal (like "Weekend Warrior" or "Daily Grind") in the config menu, and the bot will send you push notifications if you forget to commit real work.</p>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{textAlign:'center', paddingTop:24}}>
              <Check size={64} style={{color:'var(--success)', marginBottom:16}} />
              <h3 style={{fontSize:'1.5rem', marginBottom:16}}>You're Ready to Roll!</h3>
              <p style={{color:'var(--text-secondary)', marginBottom:24}}>
                <strong>How to start:</strong><br/><br/>
                1. Click <strong>+ Add Repo</strong> to fetch your GitHub projects.<br/>
                2. Drag and drop code files into the <strong>Drop Zone</strong>.<br/>
                3. Click a file in the <strong>Queue</strong> to set dependencies and date locks.<br/>
                4. Let the Python engine do the rest!
              </p>
            </div>
          )}
        </div>

        <div style={{display:'flex', justifyContent:'space-between', marginTop:32, paddingTop:16, borderTop:'1px solid var(--border-subtle)'}}>
          <button className="btn btn-ghost" onClick={prev} disabled={step === 1} style={{opacity: step === 1 ? 0.3 : 1}}>Back</button>
          {step < 4 ? (
            <button className="btn btn-primary" onClick={next}>Continue <ArrowRight size={16} /></button>
          ) : (
            <button className="btn btn-primary" onClick={onComplete} style={{background:'var(--success)'}}><Check size={16} /> Finish Setup</button>
          )}
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
  const [abortBehavior, setAbortBehavior] = useState(currentSchedule?.abortBehavior || 'auto-retry');
  const [dryRun, setDryRun] = useState(currentSchedule?.dryRun || false);
  const [notifyBefore, setNotifyBefore] = useState(currentSchedule?.notifyBeforeMinutes || 10);

  const presets = [
    { id: 'organic', title: 'Daily Grind', icon: <Leaf size={20} />, desc: 'Gentle daily nudges to keep your streak alive.' },
    { id: 'weekend', title: 'Weekend Warrior', icon: <Coffee size={20} />, desc: 'Only prompts you on Saturdays and Sundays.' },
    { id: 'corporate', title: 'The 9-to-5', icon: <Briefcase size={20} />, desc: 'Strictly prompts you during weekday business hours.' },
    { id: 'burnout', title: 'The Sprinter', icon: <Flame size={20} />, desc: 'Prompts you for massive coding sessions every few days.' },
  ];

  const handleSave = async () => {
    if (currentSchedule) {
      currentSchedule.times = [timeStart];
      currentSchedule.jitterMinutes = parseInt(jitter) || 120;
      currentSchedule.skipDates = skipDates;
      currentSchedule.abortBehavior = abortBehavior;
      currentSchedule.dryRun = dryRun;
      currentSchedule.notifyBeforeMinutes = parseInt(notifyBefore) || 10;
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
          <h3 className="modal-section-title"><Activity size={16} /> Habit Goal / Reminder Profile</h3>
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

        <div className="modal-section" style={{borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '8px'}}>
          <h3 className="modal-section-title"><Settings size={16} /> Advanced Engine Rules</h3>
          
          <div className="form-row" style={{marginBottom: '12px'}}>
            <div className="form-group" style={{flex: 2}}>
              <label htmlFor="cfg-abort">Push Failure Behavior</label>
              <select id="cfg-abort" value={abortBehavior} onChange={e => setAbortBehavior(e.target.value)} className="input-field" style={{appearance: 'auto', background: 'rgba(255,255,255,0.05)'}}>
                <option value="auto-retry">Auto-Retry (wait 10m)</option>
                <option value="skip-day">Skip for the day</option>
                <option value="pause-schedule">Pause schedule entirely</option>
              </select>
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label htmlFor="cfg-notify">Notify Before (min)</label>
              <input id="cfg-notify" type="number" value={notifyBefore} onChange={e => setNotifyBefore(e.target.value)} className="input-field" />
            </div>
          </div>

          <label className="toggle-row" style={{background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border-subtle)'}}>
            <div className="toggle-info">
              <span className="toggle-label" style={{color: dryRun ? 'var(--warning)' : 'var(--text-primary)'}}>Dry Run Mode</span>
              <span className="toggle-desc">Test schedule without actually pushing to GitHub</span>
            </div>
            <input type="checkbox" className="switch-input" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
          </label>
        </div>

        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:'16px'}} onClick={handleSave}>
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
   COMPONENT: Live Push Banner
   ═══════════════════════════════════════════ */
function LivePushBanner({ pendingPushes, onAbort }) {
  if (!pendingPushes || pendingPushes.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid var(--danger)',
      padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'relative', zIndex: 50
    }}>
      <div style={{display:'flex', alignItems:'center', gap:'8px', color:'var(--text-primary)'}}>
        <AlertCircle size={20} style={{color:'var(--danger)'}} className="ai-pulse" />
        <span><strong>Active Push Alert:</strong> The bot is arming to push in less than 10 minutes.</span>
      </div>
      <div style={{display:'flex', gap:'12px'}}>
        {pendingPushes.map((p, idx) => (
          <button key={idx} className="btn btn-primary" style={{background:'var(--danger)', borderColor:'transparent'}} onClick={() => onAbort(p.scheduleId, p.slotId)}>
            <X size={16} /> Abort Push ({p.scheduleId})
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT: Bouncing DVD Logo (Watermark)
   ═══════════════════════════════════════════ */
function BouncingLogo() {
  const logoRef = useRef(null);
  const pos = useRef({ x: Math.random() * 300, y: Math.random() * 300 });
  const vel = useRef({ dx: 1.5, dy: 1.5 });
  const logoSize = 150; // Size of the watermark

  useEffect(() => {
    let animationId;
    const update = () => {
      if (logoRef.current) {
        let { x, y } = pos.current;
        let { dx, dy } = vel.current;

        x += dx;
        y += dy;

        if (x <= 0 || x + logoSize >= window.innerWidth) {
          dx = -dx;
          x = x <= 0 ? 0 : window.innerWidth - logoSize;
        }
        if (y <= 0 || y + logoSize >= window.innerHeight) {
          dy = -dy;
          y = y <= 0 ? 0 : window.innerHeight - logoSize;
        }

        pos.current = { x, y };
        vel.current = { dx, dy };
        
        // Use transform for 60fps hardware acceleration with no React re-renders
        logoRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      animationId = requestAnimationFrame(update);
    };
    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <img 
      ref={logoRef}
      src={logoImg} 
      alt="Bouncing Watermark" 
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${logoSize}px`,
        height: `${logoSize}px`,
        opacity: 0.04, // Extremely faint watermark
        zIndex: 0, // Behind the glass panels
        pointerEvents: 'none',
        borderRadius: '30px',
        willChange: 'transform' // Optimize for animation
      }} 
    />
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
  const [settings, setSettings] = useState({ alertProvider: 'discord', webhookUrl: '', ghPat: '', commitPool: 'tweak\nhousekeeping\ncleanup\nrefactor\nminor update' });
  const [queue, setQueue] = useState([]);
  const [skipDates, setSkipDates] = useState([]);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState(null);
  const [pendingPushes, setPendingPushes] = useState([]);
  const [isAddRepoOpen, setIsAddRepoOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const loadData = useCallback(async () => {
    try {
      const config = await invoke('read_config');
      setSchedules(config.schedules);
      if (config.settings) setSettings({ ...settings, ...config.settings });
      if (config.schedules.length > 0 && !activeSchedule) setActiveSchedule(config.schedules[0].id);
      const current = config.schedules.find(s => s.id === activeSchedule);
      if (current?.skipDates) setSkipDates(current.skipDates);
    } catch (err) { console.error('Config load error:', err); }
    try { const q = await invoke('read_queue'); setQueue(q); } catch (err) { console.error('Queue load error:', err); }
  }, [activeSchedule]);

  useEffect(() => {
    if (currentPage !== 'welcome') loadData();
  }, [currentPage, loadData]);

  // Poll for T-n alerts
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await invoke('read_pending_pushes');
        if (data && data.armedSlots) setPendingPushes(data.armedSlots);
      } catch (err) {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAbort = async (scheduleId, slotId) => {
    try {
      await invoke('abort_push', { scheduleId, slotId });
      showToast(`Abort flag set for ${scheduleId}. Push halted.`, 'success');
      // Optimistically hide from banner
      setPendingPushes(prev => prev.filter(p => p.slotId !== slotId));
    } catch (err) {
      showToast(String(err), 'error');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await invoke('write_config', { config: { schedules, settings } });
      showToast("Settings saved successfully.", "success");
      setCurrentPage('dashboard');
    } catch (err) {
      showToast(String(err), "error");
    }
  };
  
  const handleWizardComplete = async () => {
    const updatedSettings = { ...settings, hasCompletedSetup: true };
    setSettings(updatedSettings);
    setShowWizard(false);
    try {
      await invoke('write_config', { config: { schedules, settings: updatedSettings } });
    } catch (err) { console.error(err); }
  };
  
  const handleRemoveRepo = async (scheduleId) => {
    const newSchedules = schedules.filter(s => s.id !== scheduleId);
    setSchedules(newSchedules);
    if (activeSchedule === scheduleId) setActiveSchedule(newSchedules[0]?.id || '');
    try {
      await invoke('write_config', { config: { schedules: newSchedules, settings } });
      showToast("Repository removed", "success");
    } catch (err) { showToast(String(err), "error"); }
  };
  
  const handleAddRepo = async (repoName, branch) => {
    const newSchedule = {
      id: repoName.split('/').pop() || 'new-repo',
      repo: repoName,
      branch: branch || 'main',
      mode: 'self',
      targetPath: '.',
      startDate: new Date().toISOString().split('T')[0],
      spanDays: 30,
      times: ["09:00"],
      timezone: "UTC",
      jitterMinutes: 120,
      notifyBeforeMinutes: 10,
      abortBehavior: "auto-retry",
      dryRun: false,
      skipDates: [],
      intensity: {}
    };
    const newSchedules = [...schedules, newSchedule];
    setSchedules(newSchedules);
    setActiveSchedule(newSchedule.id);
    try {
      await invoke('write_config', { config: { schedules: newSchedules, settings } });
      showToast("Repository added", "success");
    } catch (err) { showToast(String(err), "error"); }
  };

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
      {/* 60fps Bouncing DVD-style background watermark */}
      {currentPage === 'dashboard' && <BouncingLogo />}
      
      <LivePushBanner pendingPushes={pendingPushes} onAbort={handleAbort} />

      <AppHeader currentPage={currentPage} onNavigate={navigate} onOpenConfig={() => setIsConfigOpen(true)}
        syncState={syncState} onSyncClick={handleSync} onOpenCmdPalette={() => setIsCmdOpen(true)} />

      {currentPage === 'dashboard' && (
        <DashboardPage schedules={schedules} activeSchedule={activeSchedule} setActiveSchedule={setActiveSchedule}
          queue={queue} onRefreshQueue={loadData} onNavigate={navigate} activePreset={activePreset} skipDates={skipDates} onSelectQueueItem={setSelectedQueueItem} onAddRepo={() => setIsAddRepoOpen(true)} onRemoveRepo={handleRemoveRepo} />
      )}
      {currentPage === 'ai' && <AIPage onNavigate={navigate} />}
      {currentPage === 'settings' && <SettingsPage onNavigate={navigate} settings={settings} setSettings={setSettings} onSaveSettings={handleSaveSettings} />}

      {selectedQueueItem && (
        <QueueItemModal item={selectedQueueItem} allItems={queue} onClose={() => setSelectedQueueItem(null)} onRefreshQueue={loadData} />
      )}

      <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} activeSchedule={activeSchedule}
        activePreset={activePreset} setActivePreset={setActivePreset} schedules={schedules}
        skipDates={skipDates} setSkipDates={setSkipDates} repeatWeekly={repeatWeekly} setRepeatWeekly={setRepeatWeekly} />
        
      <AddRepoModal isOpen={isAddRepoOpen} onClose={() => setIsAddRepoOpen(false)} settings={settings} onAdd={handleAddRepo} />
      
      {(!settings.hasCompletedSetup || showWizard) && (
        <SetupWizard onComplete={handleWizardComplete} settings={settings} setSettings={setSettings} />
      )}

      <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} onAction={handleCmdAction} />

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default App;
