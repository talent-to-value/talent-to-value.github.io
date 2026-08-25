'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { days, stages, type Day, type Prompt } from './curriculum';

type View = 'home' | 'day' | 'results';
type AnswerMap = Record<string, string>;
type BooleanMap = Record<string, boolean>;

type SavedState = {
  answers: AnswerMap;
  checks: BooleanMap;
  completed: BooleanMap;
  reality: BooleanMap;
  currentDay: number;
};

const STORAGE_KEY = 'talent-to-value-demo-v1';

const pad = (value: number) => String(value).padStart(2, '0');
const answerKey = (day: number, promptId: string) => `${day}:${promptId}`;
const checkKey = (day: number, index: number) => `${day}:${index}`;

const dayOneClarityChecks = [
  { id: 'clarityWho', label: '陌生人能看出你在帮谁吗？' },
  { id: 'clarityProblem', label: '陌生人能看出你解决什么问题吗？' },
  { id: 'clarityTiming', label: '陌生人知道什么时候该来找你吗？' },
];

function lineCount(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function promptIsValid(prompt: Prompt, value: string) {
  const clean = value.trim();
  if (!clean) return false;
  if (prompt.targetCount && lineCount(clean) < prompt.targetCount) return false;
  if (prompt.minChars && clean.length < prompt.minChars) return false;
  if (prompt.maxChars && clean.length > prompt.maxChars) return false;
  return true;
}

function dayStatusLabel(day: Day, completed: BooleanMap, reality: BooleanMap) {
  if (day.externalAction && reality[String(day.day)]) return '已验证';
  if (completed[String(day.day)]) return '已产出';
  return '待完成';
}

export default function Home() {
  const [view, setView] = useState<View>('home');
  const [currentDay, setCurrentDay] = useState(1);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [checks, setChecks] = useState<BooleanMap>({});
  const [completed, setCompleted] = useState<BooleanMap>({});
  const [reality, setReality] = useState<BooleanMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveLabel, setSaveLabel] = useState('正在读取本地进度');
  const [validationMessage, setValidationMessage] = useState('');
  const [copied, setCopied] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDay = days[currentDay - 1];
  const activeStage = stages[activeDay.stage - 1];
  const completedCount = Object.values(completed).filter(Boolean).length;
  const realityCount = Object.values(reality).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / days.length) * 100);
  const nextIncomplete = days.find((day) => !completed[String(day.day)])?.day ?? 30;

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage hydration and save status intentionally update client state */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SavedState>;
        setAnswers(saved.answers ?? {});
        setChecks(saved.checks ?? {});
        setCompleted(saved.completed ?? {});
        setReality(saved.reality ?? {});
        setCurrentDay(saved.currentDay ?? 1);
      }
      setSaveLabel('已从本机恢复');
    } catch {
      setSaveLabel('未能读取旧进度');
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveLabel('正在自动保存…');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const state: SavedState = { answers, checks, completed, reality, currentDay };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSaveLabel('已自动保存到本机');
      } catch {
        setSaveLabel('保存失败，请导出备份');
      }
    }, 280);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, checks, completed, reality, currentDay, hydrated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const navigateToDay = (dayNumber: number) => {
    setCurrentDay(dayNumber);
    setView('day');
    setValidationMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateAnswer = (promptId: string, value: string) => {
    const key = answerKey(activeDay.day, promptId);
    setAnswers((previous) => ({ ...previous, [key]: value }));
    if (completed[String(activeDay.day)]) {
      setCompleted((previous) => ({ ...previous, [String(activeDay.day)]: false }));
      setValidationMessage('内容已修改，请重新完成本日检查。');
    }
  };

  const toggleCheck = (index: number) => {
    const key = checkKey(activeDay.day, index);
    setChecks((previous) => ({ ...previous, [key]: !previous[key] }));
    if (completed[String(activeDay.day)]) {
      setCompleted((previous) => ({ ...previous, [String(activeDay.day)]: false }));
    }
  };

  const completeDay = () => {
    const missingPrompts = activeDay.prompts.filter(
      (prompt) => !promptIsValid(prompt, answers[answerKey(activeDay.day, prompt.id)] ?? ''),
    );
    const missingChecks = activeDay.checks.filter(
      (_, index) => !checks[checkKey(activeDay.day, index)],
    );
    const missingClarityChecks =
      activeDay.day === 1
        ? dayOneClarityChecks.filter(
            (item) => !answers[answerKey(activeDay.day, item.id)]?.trim(),
          )
        : [];

    if (missingPrompts.length || missingChecks.length || missingClarityChecks.length) {
      const parts = [];
      if (missingPrompts.length) parts.push(`${missingPrompts.length} 项内容未达到要求`);
      if (missingClarityChecks.length) parts.push(`${missingClarityChecks.length} 项清晰度尚未判断`);
      if (missingChecks.length) parts.push(`${missingChecks.length} 项完成检查未确认`);
      setValidationMessage(parts.join('；'));
      return;
    }

    setCompleted((previous) => ({ ...previous, [String(activeDay.day)]: true }));
    setValidationMessage(
      activeDay.externalAction
        ? '今日内容已产出。完成现实动作后，再记录“已验证”。'
        : '今日任务已完成，答案已进入你的成果库。',
    );
  };

  const toggleReality = () => {
    setReality((previous) => ({
      ...previous,
      [String(activeDay.day)]: !previous[String(activeDay.day)],
    }));
  };

  const markdownExport = useMemo(() => {
    const output = ['# 把才华变成价值 · 30 天现实测试', ''];
    days.forEach((day) => {
      const dayAnswers = day.prompts
        .filter((prompt) => prompt.id !== 'privateCase')
        .map((prompt) => ({
          label: prompt.label,
          value: answers[answerKey(day.day, prompt.id)]?.trim(),
        }))
        .filter((item) => item.value);
      if (!dayAnswers.length) return;
      output.push(`## Day ${day.day} · ${day.title}`, '');
      dayAnswers.forEach((item) => output.push(`### ${item.label}`, '', item.value ?? '', ''));
    });
    return output.join('\n');
  }, [answers]);

  const downloadFile = (name: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const state: SavedState = { answers, checks, completed, reality, currentDay };
    downloadFile('把才华变成价值-进度备份.json', JSON.stringify(state, null, 2), 'application/json');
  };

  const exportMarkdown = () => {
    downloadFile('把才华变成价值-成果.md', markdownExport, 'text/markdown;charset=utf-8');
  };

  const copyText = async (id: string, text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('复制失败');
      window.setTimeout(() => setCopied(''), 1600);
    }
  };

  const dayOneArtifact =
    answers[answerKey(1, 'currentIntro')]?.trim() || '完成 Day 1 后，你当前使用的介绍会出现在这里。';
  const valueArtifact =
    answers[answerKey(7, 'revisedStatement')]?.trim() ||
    answers[answerKey(6, 'firstStatement')]?.trim() ||
    answers[answerKey(4, 'selectedValue')]?.trim() ||
    answers[answerKey(1, 'currentIntro')]?.trim() ||
    '完成第一阶段后生成。';
  const trustArtifactParts = ['trustProblem', 'trustWorks', 'trustChange', 'trustJudgment', 'trustBoundary']
    .map((id) => answers[answerKey(14, id)]?.trim())
    .filter(Boolean);
  const trustArtifact = trustArtifactParts.join('\n\n') || '完成 Day 14 后生成。';
  const offerArtifactParts = [
    'fitAudience',
    'notFitAudience',
    'offerProblem',
    'deliverables',
    'process',
    'excluded',
    'price',
    'priceRationale',
    'offerEvidence',
    'launchCopy',
  ]
    .map((id) => {
      const ownerDay =
        id === 'fitAudience' || id === 'notFitAudience'
          ? 23
          : id === 'offerProblem' || id === 'deliverables'
            ? 24
            : id === 'process' || id === 'excluded'
              ? 25
              : id === 'price' || id === 'priceRationale'
                ? 26
                : id === 'offerEvidence'
                  ? 27
                  : 30;
      return answers[answerKey(ownerDay, id)]?.trim();
    })
    .filter(Boolean);
  const offerArtifact = offerArtifactParts.join('\n\n') || '完成第四阶段后生成。';

  if (view === 'home') {
    return (
      <main className="site-shell landing-shell">
        <section className="editorial-frame" aria-labelledby="page-title">
          <header className="masthead">
            <span className="mono-label">TALENT TO VALUE · 30 DAYS</span>
            <span className="mono-label">REALITY TEST WORKBOOK</span>
          </header>

          <div className="hero-copy">
            <p className="eyebrow">把已经拥有的价值，说清楚</p>
            <h1 id="page-title">
              把才华
              <br />
              变成可被选择的价值
            </h1>
            <div className="hero-intro-wrap">
              <p className="hero-intro">
                不是读完就忘的练习。用 30 天做出一句能被复述的介绍、一组可信证据、五篇内容，
                以及一个可以被购买的入口。
              </p>
              <button className="primary-action" type="button" onClick={() => navigateToDay(nextIncomplete)}>
                {completedCount ? `继续第 ${nextIncomplete} 天` : '开始第 1 天'}
              </button>
              <span className="save-status" role="status" aria-live="polite">
                {saveLabel}
              </span>
            </div>
          </div>

          <div className="hero-grid">
            <article className="dark-panel">
              <span className="panel-index">{pad(nextIncomplete)}</span>
              <div>
                <p className="panel-kicker">下一步 · DAY {pad(nextIncomplete)}</p>
                <h2>{days[nextIncomplete - 1].title}</h2>
              </div>
              <p>{days[nextIncomplete - 1].output}</p>
            </article>

            <article className="pink-panel">
              <div className="panel-topline">
                <span className="panel-index">30</span>
                <span className="mono-label">DAYS / 04 STAGES</span>
              </div>
              <h2>不是打卡，是现实测试</h2>
              <p className="pink-lead">听懂 → 相信 → 持续理解 → 愿意购买</p>
              <div className="progress-line" aria-label={`已完成 ${completedCount} 天`}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="panel-progress">
                <span>{completedCount} / 30 已产出</span>
                <span>{realityCount} 项现实验证</span>
              </div>
            </article>
          </div>

          <footer className="frame-footer">
            <p>先做出第一版，让真实世界参与修改。</p>
            <span className="mono-label">{pad(completedCount)} / 30</span>
          </footer>
        </section>

        <section className="roadmap-section" aria-labelledby="roadmap-title">
          <div className="section-heading-row">
            <div>
              <span className="mono-label">THE ROUTE · 04 STAGES</span>
              <h2 id="roadmap-title">四个阶段，四件真正留下来的东西</h2>
            </div>
            <button className="text-action" type="button" onClick={() => setView('results')}>
              查看成果中心 →
            </button>
          </div>

          <div className="stage-grid">
            {stages.map((stage) => {
              const stageDays = days.filter((day) => day.stage === stage.id);
              const stageComplete = stageDays.filter((day) => completed[String(day.day)]).length;
              return (
                <button
                  className={`stage-card stage-${stage.id}`}
                  key={stage.id}
                  type="button"
                  onClick={() => navigateToDay(stageDays.find((day) => !completed[String(day.day)])?.day ?? stageDays[0].day)}
                >
                  <span className="panel-index">0{stage.id}</span>
                  <span className="mono-label">DAY {stage.range}</span>
                  <h3>{stage.shortName}</h3>
                  <p>{stage.title}</p>
                  <div className="stage-question">{stage.question}</div>
                  <div className="stage-count">
                    {stageComplete} / {stageDays.length}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="outcome-strip">
            <span>01 · 一句话介绍</span>
            <span>02 · 可信证据页</span>
            <span>03 · 五篇价值内容</span>
            <span>04 · 可购买入口</span>
          </div>
        </section>

        <section className="day-map-section" aria-labelledby="day-map-title">
          <div className="section-heading-row compact">
            <div>
              <span className="mono-label">ALL TASKS · SOURCE-BASED</span>
              <h2 id="day-map-title">30 天任务地图</h2>
            </div>
            <p>内容以原书逐日附录为主；回答只保存在当前浏览器。</p>
          </div>
          <div className="day-map">
            {days.map((day) => (
              <button
                type="button"
                key={day.day}
                className={completed[String(day.day)] ? 'day-map-item is-complete' : 'day-map-item'}
                onClick={() => navigateToDay(day.day)}
              >
                <span>{pad(day.day)}</span>
                <strong>{day.title}</strong>
                <small>{dayStatusLabel(day, completed, reality)}</small>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (view === 'results') {
    const results = [
      { id: 'value', number: '01', title: '一句话介绍', text: valueArtifact },
      { id: 'trust', number: '02', title: '为什么能信我', text: trustArtifact },
      {
        id: 'content',
        number: '03',
        title: '五篇价值内容',
        text: [15, 16, 17, 18, 19]
          .map((dayNumber) => {
            const day = days[dayNumber - 1];
            const draft = day.prompts
              .map((prompt) => answers[answerKey(dayNumber, prompt.id)]?.trim())
              .filter(Boolean)
              .at(-1);
            return `${day.title}\n${draft || '待完成'}`;
          })
          .join('\n\n'),
      },
      { id: 'offer', number: '04', title: '可购买入口', text: offerArtifact },
    ];

    return (
      <main className="app-page">
        <AppBar
          completedCount={completedCount}
          saveLabel={saveLabel}
          onHome={() => setView('home')}
          onResults={() => setView('results')}
        />
        <section className="results-page">
          <header className="results-hero">
            <span className="mono-label">OUTPUT CENTER · LOCAL FIRST</span>
            <h1>你的四件成果</h1>
            <p>这里不是额外填写区，而是把 30 天里已经完成的答案重新组装成可以使用的东西。</p>
            <div className="results-actions">
              <button type="button" className="primary-action" onClick={exportMarkdown}>
                导出 Markdown
              </button>
              <button type="button" className="secondary-action" onClick={exportJson}>
                备份全部进度
              </button>
            </div>
          </header>
          <div className="results-grid">
            {results.map((result) => (
              <article className="result-card" key={result.id}>
                <div className="result-card-top">
                  <span className="panel-index">{result.number}</span>
                  <button
                    type="button"
                    className="copy-button"
                    disabled={
                      result.text.includes('待完成') ||
                      result.text.includes('完成第') ||
                      result.text.includes('完成 Day')
                    }
                    onClick={() => copyText(result.id, result.text)}
                  >
                    {copied === result.id ? '已复制' : '复制'}
                  </button>
                </div>
                <h2>{result.title}</h2>
                <pre>{result.text}</pre>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-page">
      <AppBar
        completedCount={completedCount}
        saveLabel={saveLabel}
        onHome={() => setView('home')}
        onResults={() => setView('results')}
      />

      <div className="mobile-day-strip" aria-label="30 天导航">
        {days.map((day) => (
          <button
            key={day.day}
            type="button"
            className={day.day === activeDay.day ? 'is-current' : ''}
            onClick={() => navigateToDay(day.day)}
          >
            {pad(day.day)}
          </button>
        ))}
      </div>

      <div className="workbench-layout">
        <aside className="day-sidebar" aria-label="课程导航">
          <div className="sidebar-progress">
            <span className="mono-label">PROGRESS</span>
            <strong>{completedCount} / 30</strong>
            <div className="progress-line">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          {stages.map((stage) => {
            const stageDays = days.filter((day) => day.stage === stage.id);
            return (
              <section className="sidebar-stage" key={stage.id}>
                <header>
                  <span>0{stage.id}</span>
                  <strong>{stage.shortName}</strong>
                </header>
                <div>
                  {stageDays.map((day) => (
                    <button
                      key={day.day}
                      type="button"
                      className={`${day.day === activeDay.day ? 'is-current ' : ''}${
                        completed[String(day.day)] ? 'is-complete' : ''
                      }`}
                      onClick={() => navigateToDay(day.day)}
                    >
                      <span>{pad(day.day)}</span>
                      {day.title}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </aside>

        <article className="day-workspace">
          <header className="day-hero">
            <div className="day-number-block">
              <span>DAY</span>
              <strong>{pad(activeDay.day)}</strong>
            </div>
            <div>
              <span className="mono-label">
                STAGE 0{activeStage.id} · {activeStage.shortName}
              </span>
              <h1>{activeDay.title}</h1>
              <p>{activeDay.principle}</p>
            </div>
          </header>

          <section className="day-brief-grid">
            <div className="output-card">
              <span className="mono-label">TODAY&apos;S OUTPUT</span>
              <h2>今天做完，会留下什么</h2>
              <p>{activeDay.output}</p>
            </div>
            <div className="prep-card">
              <span className="mono-label">BEFORE YOU START</span>
              <h2>开始前准备</h2>
              <ul>
                {activeDay.prep.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          {activeDay.editorialNote && (
            <aside className="editorial-note">
              <span className="mono-label">编校说明</span>
              <p>{activeDay.editorialNote}</p>
            </aside>
          )}

          <section className="exercise-section" aria-labelledby="exercise-title">
            <div className="exercise-heading">
              <span className="mono-label">WORK AREA</span>
              <h2 id="exercise-title">现在动手</h2>
              <p>内容会自动保存在当前浏览器；数量和字数按照原书任务要求提示。</p>
            </div>
            <div className="prompt-stack">
              {activeDay.prompts.map((prompt, index) => {
                const value = answers[answerKey(activeDay.day, prompt.id)] ?? '';
                const currentLines = lineCount(value);
                const valid = promptIsValid(prompt, value);
                const isPrivate = prompt.id === 'privateCase';
                return (
                  <div className={`prompt-card ${isPrivate ? 'private-prompt' : ''}`} key={prompt.id}>
                    <div className="prompt-label-row">
                      <div>
                        <span className="prompt-index">{pad(index + 1)}</span>
                        <label htmlFor={`prompt-${activeDay.day}-${prompt.id}`}>{prompt.label}</label>
                      </div>
                      {value && <span className={valid ? 'field-status is-valid' : 'field-status'}>{valid ? '达到要求' : '继续完成'}</span>}
                    </div>
                    {prompt.helper && <p className="prompt-helper">{prompt.helper}</p>}
                    {prompt.mode === 'text' ? (
                      <input
                        id={`prompt-${activeDay.day}-${prompt.id}`}
                        value={value}
                        placeholder={prompt.placeholder}
                        onChange={(event) => updateAnswer(prompt.id, event.target.value)}
                      />
                    ) : (
                      <textarea
                        id={`prompt-${activeDay.day}-${prompt.id}`}
                        value={value}
                        placeholder={prompt.placeholder}
                        rows={prompt.mode === 'lines' ? 7 : 8}
                        onChange={(event) => updateAnswer(prompt.id, event.target.value)}
                      />
                    )}
                    <div className="field-meta">
                      {prompt.targetCount && (
                        <span className={currentLines >= prompt.targetCount ? 'is-met' : ''}>
                          {currentLines} / {prompt.targetCount} 条
                        </span>
                      )}
                      {(prompt.minChars || prompt.maxChars) && (
                        <span>
                          {value.length} 字
                          {prompt.minChars && prompt.maxChars
                            ? ` · 建议 ${prompt.minChars}–${prompt.maxChars}`
                            : prompt.maxChars
                              ? ` · 上限 ${prompt.maxChars}`
                              : ` · 至少 ${prompt.minChars}`}
                        </span>
                      )}
                      {isPrivate && <span>私密层 · 不进入 Markdown 成果导出</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {activeDay.day === 1 && (
            <section className="clarity-diagnosis" aria-labelledby="clarity-title">
              <div className="clarity-heading">
                <span className="mono-label">03 CLARITY TESTS</span>
                <h2 id="clarity-title">先判断，不急着修改</h2>
                <p>把自己当作第一次看到这段介绍的陌生人。这里没有标准答案，“不清楚”就是今天最有价值的发现。</p>
              </div>
              <div className="clarity-grid">
                {dayOneClarityChecks.map((item, index) => {
                  const key = answerKey(1, item.id);
                  const value = answers[key] ?? '';
                  return (
                    <article className="clarity-card" key={item.id}>
                      <span className="prompt-index">{pad(index + 1)}</span>
                      <h3>{item.label}</h3>
                      <div className="clarity-options" role="group" aria-label={item.label}>
                        {['清楚', '不清楚'].map((option) => (
                          <button
                            type="button"
                            key={option}
                            className={value === option ? 'is-selected' : ''}
                            aria-pressed={value === option}
                            onClick={() => updateAnswer(item.id, option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="completion-section">
            <div className="completion-heading">
              <span className="mono-label">QUALITY CHECK</span>
              <h2>完成前检查</h2>
            </div>
            <div className="checklist">
              {activeDay.checks.map((item, index) => {
                const key = checkKey(activeDay.day, index);
                return (
                  <label key={item} className={checks[key] ? 'is-checked' : ''}>
                    <input type="checkbox" checked={Boolean(checks[key])} onChange={() => toggleCheck(index)} />
                    <span className="check-mark" aria-hidden="true">
                      {checks[key] ? '✓' : ''}
                    </span>
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>

            {activeDay.externalAction && (
              <div className="reality-card">
                <span className="mono-label">REALITY TEST · 不在工具里完成</span>
                <h3>把今天的东西交给真实世界</h3>
                <p>{activeDay.externalAction}</p>
                <label className="reality-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(reality[String(activeDay.day)])}
                    onChange={toggleReality}
                  />
                  <span>{reality[String(activeDay.day)] ? '已执行并记录反馈' : '执行后在这里标记'}</span>
                </label>
              </div>
            )}

            <div className="completion-actions">
              <div>
                <button type="button" className="primary-action" onClick={completeDay}>
                  {completed[String(activeDay.day)] ? '已完成 · 重新确认' : `完成第 ${activeDay.day} 天`}
                </button>
                <p className="validation-message" role="status" aria-live="polite">
                  {validationMessage}
                </p>
              </div>
              <div className="prev-next">
                <button type="button" disabled={activeDay.day === 1} onClick={() => navigateToDay(activeDay.day - 1)}>
                  ← 上一天
                </button>
                <button type="button" disabled={activeDay.day === 30} onClick={() => navigateToDay(activeDay.day + 1)}>
                  下一天 →
                </button>
              </div>
            </div>
          </section>

          <footer className="source-footer">
            <span>任务来源：原书 30 天附录</span>
            <span>PDF 第 {activeDay.sourcePages} 页</span>
          </footer>
        </article>

        <aside className="artifact-sidebar" aria-label="实时成果预览">
          <div className="artifact-sticky">
            <div className="artifact-heading">
              <span className="mono-label">LIVE ARTIFACT</span>
              <h2>此刻留下的东西</h2>
            </div>
            <div className="artifact-paper">
              <span className="artifact-number">{pad(activeDay.day)}</span>
              <h3>{activeDay.day === 1 ? '当前介绍' : activeDay.output}</h3>
              <p>
                {activeDay.day === 1
                  ? dayOneArtifact
                  : activeDay.prompts
                      .map((prompt) => answers[answerKey(activeDay.day, prompt.id)]?.trim())
                      .filter(Boolean)
                      .at(-1) || '开始填写后，最新答案会在这里实时出现。'}
              </p>
            </div>
            <div className="artifact-meta">
              <span>{dayStatusLabel(activeDay, completed, reality)}</span>
              <span>{saveLabel}</span>
            </div>
            <button type="button" className="secondary-action full-width" onClick={() => setView('results')}>
              查看四件成果
            </button>
          </div>
        </aside>
      </div>

      <div className="mobile-action-bar">
        <span>{pad(activeDay.day)} / 30</span>
        <button type="button" onClick={completeDay}>
          {completed[String(activeDay.day)] ? '重新确认' : '完成今天'}
        </button>
      </div>
    </main>
  );
}

function AppBar({
  completedCount,
  saveLabel,
  onHome,
  onResults,
}: {
  completedCount: number;
  saveLabel: string;
  onHome: () => void;
  onResults: () => void;
}) {
  return (
    <header className="app-bar">
      <button type="button" className="brand-button" onClick={onHome}>
        <span>TALENT TO VALUE</span>
        <strong>把才华变成价值</strong>
      </button>
      <div className="app-bar-status" aria-live="polite">
        <span>{completedCount} / 30 已产出</span>
        <span>{saveLabel}</span>
      </div>
      <button type="button" className="results-button" onClick={onResults}>
        成果中心
      </button>
    </header>
  );
}
