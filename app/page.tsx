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

type SelectionConfig = {
  sourceDay: number;
  sourceId: string;
  targetId: string;
  max: number;
  title: string;
  helper: string;
};

const STORAGE_KEY = 'talent-to-value-demo-v1';

const pad = (value: number) => String(value).padStart(2, '0');
const answerKey = (day: number, promptId: string) => `${day}:${promptId}`;

function splitUniqueLines(value: string) {
  return Array.from(
    new Set(
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeAnswers(input: AnswerMap) {
  const next = { ...input };
  const audienceCandidates = splitUniqueLines(next[answerKey(2, 'audienceCandidates')] ?? '');
  const selectedAudience = splitUniqueLines(next[answerKey(2, 'selectedAudience')] ?? '')
    .filter((item) => audienceCandidates.includes(item))
    .slice(0, 1);
  next[answerKey(2, 'selectedAudience')] = selectedAudience.join('\n');

  const problemCandidates = splitUniqueLines(next[answerKey(3, 'problemCandidates')] ?? '');
  const selectedProblems = splitUniqueLines(next[answerKey(3, 'topProblems')] ?? '')
    .filter((item) => problemCandidates.includes(item))
    .slice(0, 3);
  next[answerKey(3, 'topProblems')] = selectedProblems.join('\n');

  const focusProblem = splitUniqueLines(next[answerKey(4, 'focusProblem')] ?? '')
    .filter((item) => selectedProblems.includes(item))
    .slice(0, 1);
  next[answerKey(4, 'focusProblem')] = focusProblem.join('\n');
  return next;
}

const dayOneClarityChecks = [
  { id: 'clarityWho', label: '陌生人能看出你在帮谁吗？', short: '你主要服务谁' },
  { id: 'clarityProblem', label: '陌生人能看出你解决什么问题吗？', short: '客户可以找你解决什么问题' },
  { id: 'clarityTiming', label: '陌生人知道什么时候该来找你吗？', short: '什么时候应该想到你' },
];

const stageMeanings = [
  {
    problem: '别人听完，仍不知道你具体能帮上什么',
    action: '从你会的很多事情里，确定先为谁解决哪几个问题。',
    artifact: '一段服务介绍，可放在主页、个人简介或第一次私信里',
  },
  {
    problem: '别人觉得有关系，但还不敢选择你',
    action: '把散落的经历、案例与反馈整理成可信证据。',
    artifact: '一页信任说明，有人进一步了解时可以直接发给对方',
  },
  {
    problem: '别人看过你，却没有形成稳定印象',
    action: '用五种内容持续解释同一个价值，而不是随机发内容。',
    artifact: '五篇服务内容稿，帮助合适的人认出自己的问题',
  },
  {
    problem: '别人想进一步了解，却不知道怎么买',
    action: '把服务对象、交付、边界、价格和入口放在同一页。',
    artifact: '一页购买说明，写清交付、边界、价格与购买方式',
  },
];

function lineCount(value: string) {
  return splitUniqueLines(value).length;
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
  const [navOpen, setNavOpen] = useState(false);
  const [taskStep, setTaskStep] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskFlowRef = useRef<HTMLDivElement | null>(null);

  const activeDay = days[currentDay - 1];
  const activeStage = stages[activeDay.stage - 1];
  const completedCount = Object.values(completed).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / days.length) * 100);
  const nextIncomplete = days.find((day) => !completed[String(day.day)])?.day ?? 30;
  const selectedAudience = splitUniqueLines(answers[answerKey(2, 'selectedAudience')] ?? '')[0] ?? '';
  const selectedProblems = splitUniqueLines(answers[answerKey(3, 'topProblems')] ?? '').slice(0, 3).join('\n');
  const activeTitle = activeDay.day === 3 ? '这类客户现在最想解决哪 3 件事？' : activeDay.title;

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage hydration and save status intentionally update client state */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SavedState>;
        const normalizedAnswers = normalizeAnswers(saved.answers ?? {});
        const normalizedCompleted = { ...(saved.completed ?? {}) };
        const invalidFromDay = !normalizedAnswers[answerKey(2, 'selectedAudience')]
          ? 2
          : lineCount(normalizedAnswers[answerKey(3, 'topProblems')] ?? '') < 3
            ? 3
            : !normalizedAnswers[answerKey(4, 'focusProblem')]
              ? 4
              : null;
        if (invalidFromDay) {
          Object.keys(normalizedCompleted).forEach((dayNumber) => {
            if (Number(dayNumber) >= invalidFromDay) normalizedCompleted[dayNumber] = false;
          });
        }
        setAnswers(normalizedAnswers);
        setChecks(saved.checks ?? {});
        setCompleted(normalizedCompleted);
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

  useEffect(() => {
    if (!navOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [navOpen]);

  const navigateToDay = (dayNumber: number) => {
    setCurrentDay(dayNumber);
    setView('day');
    setNavOpen(false);
    setTaskStep(0);
    setValidationMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const moveTaskStep = (nextStep: number) => {
    setTaskStep(Math.max(0, nextStep));
    window.setTimeout(() => taskFlowRef.current?.scrollIntoView({ block: 'start' }), 0);
  };

  const updateAnswer = (promptId: string, value: string) => {
    const key = answerKey(activeDay.day, promptId);
    setAnswers((previous) => {
      const next = { ...previous, [key]: value };
      if (activeDay.day === 2 && promptId === 'audienceCandidates') {
        const candidates = splitUniqueLines(value);
        const selected = splitUniqueLines(previous[answerKey(2, 'selectedAudience')] ?? '').filter((line) =>
          candidates.includes(line),
        );
        next[answerKey(2, 'selectedAudience')] = selected.slice(0, 1).join('\n');
      }
      if (activeDay.day === 3 && promptId === 'problemCandidates') {
        const candidates = splitUniqueLines(value);
        const selected = splitUniqueLines(previous[answerKey(3, 'topProblems')] ?? '').filter((line) =>
          candidates.includes(line),
        );
        next[answerKey(3, 'topProblems')] = selected.slice(0, 3).join('\n');
      }
      if (activeDay.day === 3 && (promptId === 'problemCandidates' || promptId === 'topProblems')) {
        const validProblems = splitUniqueLines(next[answerKey(3, 'topProblems')] ?? '');
        const focusProblem = splitUniqueLines(previous[answerKey(4, 'focusProblem')] ?? '').filter((line) =>
          validProblems.includes(line),
        );
        next[answerKey(4, 'focusProblem')] = focusProblem.slice(0, 1).join('\n');
      }
      return next;
    });
    setCompleted((previous) => {
      const next = { ...previous, [String(activeDay.day)]: false };
      Object.keys(next).forEach((dayNumber) => {
        if (Number(dayNumber) >= activeDay.day) next[dayNumber] = false;
      });
      return next;
    });
    setReality((previous) => {
      const next = { ...previous };
      Object.keys(next).forEach((dayNumber) => {
        if (Number(dayNumber) >= activeDay.day) next[dayNumber] = false;
      });
      return next;
    });
    if (completed[String(activeDay.day)]) {
      setValidationMessage('内容已修改。后续答案仍会保留，但需要沿顺序重新确认。');
    }
  };

  const completeDay = () => {
    const missingPrompts = activeDay.prompts.filter(
      (prompt) => !promptIsValid(prompt, answers[answerKey(activeDay.day, prompt.id)] ?? ''),
    );
    const missingClarityChecks =
      activeDay.day === 1
        ? dayOneClarityChecks.filter(
            (item) => !answers[answerKey(activeDay.day, item.id)]?.trim(),
          )
        : [];

    if (missingPrompts.length || missingClarityChecks.length) {
      const parts = [];
      if (missingPrompts.length) parts.push(`${missingPrompts.length} 项内容未达到要求`);
      if (missingClarityChecks.length) parts.push(`${missingClarityChecks.length} 项清晰度尚未判断`);
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

  const toggleLineSelection = (targetId: string, item: string, max: number) => {
    const key = answerKey(activeDay.day, targetId);
    const selected = splitUniqueLines(answers[key] ?? '');
    const next = selected.includes(item)
      ? selected.filter((line) => line !== item)
      : selected.length < max
        ? [...selected, item]
        : selected;
    updateAnswer(targetId, next.join('\n'));
    if (!selected.includes(item) && selected.length >= max) {
      setValidationMessage(`这一轮最多选择 ${max} 项；先取消一项再替换。`);
    } else {
      setValidationMessage('');
    }
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

  const valueArtifact =
    answers[answerKey(7, 'revisedStatement')]?.trim() ||
    answers[answerKey(6, 'firstStatement')]?.trim() ||
    answers[answerKey(4, 'selectedValue')]?.trim() ||
    '完成 Day 4 后生成；Day 1 的介绍只是诊断基线，不会被当成成品。';
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

          <div className="guided-hero-copy">
            <div>
              <p className="eyebrow">不是做作业，是把你的价值整理成一条可验证的路径</p>
              <h1 id="page-title">把你会做的事，做成别人看得懂、信得过、买得到的服务</h1>
              <p className="hero-fit">
                适合已经有经验、有作品，但介绍、内容和购买入口还没有连起来的人。第 30 天，你会得到一套可以直接发给潜在客户的服务材料。
              </p>
            </div>
            <div className="hero-purpose">
              <span className="mono-label">WHY OPEN THIS TOOL</span>
              <h2>你打开这个工具，是为了回答一个现实问题：</h2>
              <p className="hero-question">别人为什么要找你，而不是继续观望或去找别人？</p>
              <p>
                你不需要先承认自己的介绍有问题。这个工具会把你现有的介绍、客户、经验与案例带进同一条流程，
                帮你检查它们能不能让别人听懂、相信，并知道下一步怎么买。
              </p>
              <div className="hero-actions">
                <button className="primary-action" type="button" onClick={() => navigateToDay(nextIncomplete)}>
                  {completedCount ? `继续下一步 · Day ${nextIncomplete}` : '从 3 分钟现状诊断开始'}
                </button>
                <span className="save-status" role="status" aria-live="polite">
                  {saveLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="purpose-strip" aria-label="使用这个工具的方式">
            <div>
              <span>01</span>
              <strong>带来已有材料</strong>
              <p>不用从零想答案，先放进你正在使用的版本。</p>
            </div>
            <div>
              <span>02</span>
              <strong>一次只做一个决策</strong>
              <p>每一步都会说明为什么做，以及它会交给下一步什么。</p>
            </div>
            <div>
              <span>03</span>
              <strong>拿到现实里测试</strong>
              <p>不是追求完美答案，而是形成可以被反馈的第一版。</p>
            </div>
          </div>

          <footer className="frame-footer">
            <p>30 天不是目标；形成一套别人能理解、信任并购买的表达，才是目标。</p>
            <span className="mono-label">{pad(completedCount)} / 30</span>
          </footer>
        </section>

        <section className="roadmap-section" aria-labelledby="roadmap-title">
          <div className="section-heading-row">
            <div>
              <span className="mono-label">THE ROUTE · 04 STAGES</span>
              <h2 id="roadmap-title">你会按顺序解决四个问题</h2>
              <p className="section-intro">
                后一步会直接使用前一步的答案，所以它不是四个可以随便挑选的模块。你只需要从当前这一步继续。
              </p>
            </div>
            <button className="text-action" type="button" onClick={() => setView('results')}>
              查看成果中心 →
            </button>
          </div>

          <div className="stage-grid">
            {stages.map((stage) => {
              const stageDays = days.filter((day) => day.stage === stage.id);
              const stageComplete = stageDays.filter((day) => completed[String(day.day)]).length;
              const meaning = stageMeanings[stage.id - 1];
              return (
                <article className={`stage-card stage-${stage.id}`} key={stage.id}>
                  <span className="panel-index">0{stage.id}</span>
                  <span className="mono-label">DAY {stage.range}</span>
                  <h3>{stage.shortName}</h3>
                  <p className="stage-problem">先解决：{meaning.problem}</p>
                  <p className="stage-action">{meaning.action}</p>
                  <div className="stage-artifact">留下：{meaning.artifact}</div>
                  <div className="stage-count">
                    {stageComplete} / {stageDays.length}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="sequence-continue">
            <div>
              <span className="mono-label">YOUR NEXT STEP</span>
              <strong>
                Day {pad(nextIncomplete)} · {days[nextIncomplete - 1].title}
              </strong>
            </div>
            <button className="primary-action" type="button" onClick={() => navigateToDay(nextIncomplete)}>
              继续当前步骤 →
            </button>
          </div>
        </section>

        <section className="day-map-section" aria-labelledby="day-map-title">
          <details className="all-days-details">
            <summary>
              <span>
                <span className="mono-label">REFERENCE · OPTIONAL</span>
                <strong id="day-map-title">查看完整 30 天目录</strong>
              </span>
              <span>平时不需要从这里选任务；它只用于回看或跳转。</span>
            </summary>
            <div className="day-map">
              {days.map((day) => (
                <button
                  type="button"
                  key={day.day}
                  className={completed[String(day.day)] ? 'day-map-item is-complete' : 'day-map-item'}
                  disabled={day.day > nextIncomplete && !completed[String(day.day)]}
                  onClick={() => navigateToDay(day.day)}
                >
                  <span>{pad(day.day)}</span>
                  <strong>{day.title}</strong>
                  <small>
                    {day.day > nextIncomplete && !completed[String(day.day)]
                      ? '完成前一步后开启'
                      : dayStatusLabel(day, completed, reality)}
                  </small>
                </button>
              ))}
            </div>
          </details>
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

  const selectionConfig: SelectionConfig | null =
    activeDay.day === 2
      ? {
          sourceDay: 2,
          sourceId: 'audienceCandidates',
          targetId: 'selectedAudience',
          max: 1,
          title: '选定这一轮唯一的主要客户',
          helper: '其他候选不会丢失，但接下来的问题、证据、内容和服务只围绕这一位主要客户展开。优先选择你接触过、对方正在面对真实问题、而且你愿意继续理解的人。',
        }
      : activeDay.day === 3
        ? {
            sourceDay: 3,
            sourceId: 'problemCandidates',
            targetId: 'topProblems',
            max: 3,
            title: '直接选出这一版服务先关注的 3 个问题',
            helper: '优先选场景具体、对客户足够着急、而且你确实有经验推进的问题。',
          }
        : activeDay.day === 4
          ? {
              sourceDay: 3,
              sourceId: 'topProblems',
              targetId: 'focusProblem',
              max: 1,
              title: '先选择这句话主要回应哪个问题',
              helper: '目标客户已经确定；现在从昨天选出的 3 个问题里选 1 个作为这句话的主轴，避免一句话同时说三件事。',
            }
          : null;
  const selectionCandidates = selectionConfig
    ? splitUniqueLines(answers[answerKey(selectionConfig.sourceDay, selectionConfig.sourceId)] ?? '')
    : [];
  const selectedItems = selectionConfig
    ? splitUniqueLines(answers[answerKey(activeDay.day, selectionConfig.targetId)] ?? '').slice(
        0,
        selectionConfig.max,
      )
    : [];
  const visiblePrompts = activeDay.prompts.filter(
    (prompt) => !selectionConfig || prompt.id !== selectionConfig.targetId,
  );
  const hasDecisionStep = activeDay.day === 1 || Boolean(selectionConfig);
  const decisionFirst = activeDay.day === 4 && Boolean(selectionConfig);
  const decisionStepIndex = decisionFirst ? 0 : visiblePrompts.length;
  const promptStepIndex = decisionFirst ? taskStep - 1 : taskStep;
  const currentPrompt =
    promptStepIndex >= 0 && promptStepIndex < visiblePrompts.length
      ? visiblePrompts[promptStepIndex]
      : null;
  const showDecisionStep = hasDecisionStep && taskStep === decisionStepIndex;
  const completionStepIndex = visiblePrompts.length + (hasDecisionStep ? 1 : 0);
  const showCompletionStep = taskStep >= completionStepIndex;
  const decisionReady =
    activeDay.day === 1
      ? dayOneClarityChecks.every((item) => Boolean(answers[answerKey(1, item.id)]))
      : selectionConfig
        ? selectedItems.length === selectionConfig.max &&
          selectedItems.every((item) => selectionCandidates.includes(item))
        : true;
  const clarityAnswers = dayOneClarityChecks.map((item) => answers[answerKey(1, item.id)] ?? '');
  const clarityAnswered = clarityAnswers.every(Boolean);
  const unclearItems = dayOneClarityChecks.filter(
    (item) => answers[answerKey(1, item.id)] === '不清楚',
  );
  const clearItems = dayOneClarityChecks.filter(
    (item) => answers[answerKey(1, item.id)] === '清楚',
  );
  const dependencyMissing =
    (activeDay.day === 3 && !selectedAudience) ||
    (activeDay.day === 4 && (!selectedAudience || lineCount(selectedProblems) < 3));
  const dependencyDay = activeDay.day === 4 && selectedAudience ? 3 : 2;
  const previousDay = activeDay.day > 1 ? days[activeDay.day - 2] : null;
  const previousResult = previousDay
    ? previousDay.prompts
        .map((prompt) => answers[answerKey(previousDay.day, prompt.id)]?.trim())
        .filter(Boolean)
        .at(-1)
    : '';
  const carryForward =
    activeDay.day === 2
      ? {
          label: '从 Day 1 带来的当前介绍',
          text: answers[answerKey(1, 'currentIntro')]?.trim() || 'Day 1 还没有保存介绍；你仍可继续，但建议先完成上一步。',
        }
      : activeDay.day === 3
        ? {
            label: '今天研究的客户',
            text: selectedAudience || '请先在 Day 2 选择这一轮要服务的客户。',
          }
        : activeDay.day === 4
          ? {
              label: 'Day 2 + Day 3 已经替你准备好的输入',
              text: `本轮目标客户：\n${selectedAudience || '尚未选择'}\n\n已选问题：\n${selectedProblems || '尚未选择'}`,
            }
        : previousDay
          ? {
              label: `从 Day ${previousDay.day} 带来的结果`,
              text: previousResult || `Day ${previousDay.day} 完成后，最重要的答案会自动带到这里。`,
            }
          : null;
  const nextUse =
    activeDay.day === 1
      ? '下一步会先确定这一版服务卖给谁。只有围绕同一类人，后面的问题、证据、内容和产品才不会各说各话。'
      : activeDay.day === 2
        ? '下一步只研究你刚选中的客户正在为什么事情头疼；这个答案会自动带过去，不需要重新输入。'
        : activeDay.day === 3
          ? '下一步会把目标客户和这 3 个问题组合起来，帮助你写出一句容易听懂的服务说明。'
          : activeDay.day === 4
            ? 'Day 5 会围绕这句承诺筛选相关证据，避免把与客户问题无关的经历继续堆进去。'
            : activeDay.day < 30
              ? `今天的结果会保存在成果库，并作为 Day ${activeDay.day + 1} 的输入。`
              : '这一步完成后，你会得到可以公开测试的第一版购买入口。';
  const automaticRule =
    activeDay.day === 1
      ? '系统自动确认：已放入当前介绍，并完成 3 项“清楚 / 不清楚”判断。'
      : activeDay.day === 2
        ? '系统自动确认：已写下 10 个真实候选，并选定唯一的主要客户。'
        : activeDay.day === 3
          ? '系统自动确认：已写下 20 句客户可能说的话，并从中直接选出 3 句。'
          : activeDay.day === 4
            ? '系统自动确认：已选定 1 个客户问题，并完成这一页的服务表达。'
            : '系统会根据本页必填内容自动确认，不需要再逐项打勾。';
  const totalTaskSteps = completionStepIndex + 1;
  const displayedTaskStep = Math.min(taskStep, completionStepIndex) + 1;

  return (
    <main className="app-page focus-app">
      <AppBar
        completedCount={completedCount}
        saveLabel={saveLabel}
        currentDay={activeDay.day}
        onMenu={() => setNavOpen(true)}
        onHome={() => setView('home')}
        onResults={() => setView('results')}
      />

      <div
        className={navOpen ? 'drawer-backdrop is-open' : 'drawer-backdrop'}
        aria-hidden={!navOpen}
        onClick={() => setNavOpen(false)}
      >
        <aside className="day-drawer" aria-label="30 天目录" onClick={(event) => event.stopPropagation()}>
          <header className="drawer-header">
            <div>
              <span className="mono-label">YOUR PATH</span>
              <strong>{completedCount} / 30 已完成</strong>
            </div>
            <button type="button" onClick={() => setNavOpen(false)} aria-label="关闭目录">
              关闭
            </button>
          </header>
          <div className="drawer-progress progress-line" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <nav>
            {stages.map((stage) => (
              <section className="drawer-stage" key={stage.id}>
                <header>
                  <span>0{stage.id}</span>
                  <strong>{stage.shortName}</strong>
                </header>
                {days
                  .filter((day) => day.stage === stage.id)
                  .map((day) => {
                    const future = day.day > nextIncomplete && !completed[String(day.day)];
                    return (
                      <button
                        key={day.day}
                        type="button"
                        disabled={future}
                        className={`${day.day === activeDay.day ? 'is-current ' : ''}${
                          completed[String(day.day)] ? 'is-complete' : ''
                        }`}
                        onClick={() => navigateToDay(day.day)}
                      >
                        <span>{pad(day.day)}</span>
                        <strong>{day.title}</strong>
                        <small>{future ? '完成前一步后开启' : dayStatusLabel(day, completed, reality)}</small>
                      </button>
                    );
                  })}
              </section>
            ))}
          </nav>
        </aside>
      </div>

      <div className="focused-workbench">
        <article className="guided-day">
          <header className="guided-day-header">
            <div className="day-breadcrumb">
              <span className="mono-label">STAGE 0{activeStage.id} · {activeStage.shortName}</span>
              <span>Day {activeDay.day} / 30</span>
            </div>
            <h1>{activeTitle}</h1>
            <section className="why-block" aria-labelledby="why-title">
              <span className="mono-label">WHY THIS STEP</span>
              <h2 id="why-title">为什么现在做这一步</h2>
              <p>{activeDay.principle}</p>
            </section>
          </header>

          <section className="day-orientation">
            <div>
              <span className="mono-label">TODAY&apos;S RESULT</span>
              <strong>今天会留下</strong>
              <p>{activeDay.output}</p>
            </div>
            <details>
              <summary>开始前需要什么</summary>
              <ul>
                {activeDay.prep.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          </section>

          {carryForward && (
            <section className="carry-forward" aria-label={carryForward.label}>
              <span className="mono-label">BROUGHT FORWARD</span>
              <strong>{carryForward.label}</strong>
              <p>{carryForward.text}</p>
              {activeDay.day === 2 && (
                <p className="carry-instruction">
                  先做：如果这段介绍里已经提到某类客户，把它整理成候选 01；如果没有，候选 01 就写你最近真实帮助过的人。
                </p>
              )}
            </section>
          )}

          {dependencyMissing ? (
            <section className="prerequisite-card">
              <span className="mono-label">NEEDS DAY {dependencyDay}</span>
              <h2>{dependencyDay === 2 ? '先选定这一轮唯一的主要客户' : '先选出客户最想解决的 3 个问题'}</h2>
              <p>
                {dependencyDay === 2
                  ? '这一页不能脱离目标客户单独完成。回到 Day 2 选好一个主要客户后，这里会自动显示具体名称。'
                  : '这一页要直接使用 Day 3 的三个重点问题。先把上一步完成，回来后不需要重新输入。'}
              </p>
              <button type="button" className="primary-action" onClick={() => navigateToDay(dependencyDay)}>
                返回 Day {dependencyDay} 完成上一步
              </button>
            </section>
          ) : (
            <>
              <div ref={taskFlowRef} className="task-progress" aria-label={`本页共 ${totalTaskSteps} 步`}>
                <span>
                  本页步骤 {displayedTaskStep} / {totalTaskSteps}
                </span>
                <div aria-hidden="true">
                  <i style={{ width: `${(displayedTaskStep / totalTaskSteps) * 100}%` }} />
                </div>
              </div>

              {currentPrompt && (() => {
                const value = answers[answerKey(activeDay.day, currentPrompt.id)] ?? '';
                const currentLines = lineCount(value);
                const valid = promptIsValid(currentPrompt, value);
                const isPrivate = currentPrompt.id === 'privateCase';
                return (
                  <section className="guided-exercise" aria-labelledby="exercise-title">
                    <div className="guided-exercise-heading">
                      <span className="mono-label">ONE ACTION AT A TIME</span>
                      <h2 id="exercise-title">现在只做这一件事</h2>
                      <p>完成后再进入下一步；已经输入的内容会自动保存。</p>
                    </div>
                    <div className="prompt-stack quiet-prompts">
                      <div className={`prompt-card ${isPrivate ? 'private-prompt' : ''}`}>
                        <div className="prompt-label-row">
                          <div>
                            <span className="prompt-index">STEP {pad(displayedTaskStep)}</span>
                            <label htmlFor={`prompt-${activeDay.day}-${currentPrompt.id}`}>
                              {currentPrompt.label}
                            </label>
                          </div>
                          {value && (
                            <span className={valid ? 'field-status is-valid' : 'field-status'}>
                              {valid ? '可以继续' : '继续完成'}
                            </span>
                          )}
                        </div>
                        {currentPrompt.helper && <p className="prompt-helper">{currentPrompt.helper}</p>}
                        {currentPrompt.mode === 'text' ? (
                          <input
                            id={`prompt-${activeDay.day}-${currentPrompt.id}`}
                            value={value}
                            placeholder={currentPrompt.placeholder}
                            onChange={(event) => updateAnswer(currentPrompt.id, event.target.value)}
                          />
                        ) : (
                          <textarea
                            id={`prompt-${activeDay.day}-${currentPrompt.id}`}
                            value={value}
                            placeholder={currentPrompt.placeholder}
                            rows={currentPrompt.mode === 'lines' ? 9 : 7}
                            onChange={(event) => updateAnswer(currentPrompt.id, event.target.value)}
                          />
                        )}
                        <div className="field-meta">
                          {currentPrompt.targetCount && (
                            <span className={currentLines >= currentPrompt.targetCount ? 'is-met' : ''}>
                              {currentLines} / {currentPrompt.targetCount} 条
                            </span>
                          )}
                          {(currentPrompt.minChars || currentPrompt.maxChars) && (
                            <span>
                              {value.length} 字
                              {currentPrompt.minChars && currentPrompt.maxChars
                                ? ` · 建议 ${currentPrompt.minChars}–${currentPrompt.maxChars}`
                                : currentPrompt.maxChars
                                  ? ` · 上限 ${currentPrompt.maxChars}`
                                  : ` · 至少 ${currentPrompt.minChars}`}
                            </span>
                          )}
                          {isPrivate && <span>私密层 · 不进入 Markdown 成果导出</span>}
                        </div>
                      </div>
                    </div>
                    <div className="atomic-nav">
                      <button
                        type="button"
                        className="previous-link"
                        disabled={taskStep === 0}
                        onClick={() => moveTaskStep(taskStep - 1)}
                      >
                        ← 上一步
                      </button>
                      <button
                        type="button"
                        className="primary-action"
                        disabled={!valid}
                        onClick={() => {
                          setValidationMessage('');
                          moveTaskStep(taskStep + 1);
                        }}
                      >
                        继续 →
                      </button>
                    </div>
                  </section>
                );
              })()}

              {showDecisionStep && activeDay.day === 1 && (
                <section className="clarity-diagnosis" aria-labelledby="clarity-title">
                  <div className="clarity-heading">
                    <span className="mono-label">STEP {pad(displayedTaskStep)} · QUICK JUDGMENT</span>
                    <h2 id="clarity-title">只根据这段介绍，第一次认识你的人能否回答：</h2>
                    <p>如果需要靠猜，或者你自己也拿不准，就选“不清楚”。这不是好坏评分，Day 7 还会交给真人复述验证。</p>
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
                  <div className="diagnosis-summary" aria-live="polite">
                    {!clarityAnswered
                      ? '完成三项判断后，这里会直接告诉你下一步需要补什么；不再另填一遍诊断。'
                      : unclearItems.length
                        ? `这不是好坏评分。目前需要补清楚：${unclearItems.map((item) => item.short).join('、')}。${
                            clearItems.length
                              ? `已经说清楚的部分会保留：${clearItems.map((item) => item.short).join('、')}。`
                              : ''
                          }`
                        : '当前介绍通过了第一次自评。接下来仍会把客户与问题拆开核对，最后在 Day 7 交给真人复述验证。'}
                  </div>
                  <div className="atomic-nav">
                    <button type="button" className="previous-link" onClick={() => moveTaskStep(taskStep - 1)}>
                      ← 修改介绍
                    </button>
                    <button
                      type="button"
                      className="primary-action"
                      disabled={!decisionReady}
                      onClick={() => {
                        setValidationMessage('');
                        moveTaskStep(taskStep + 1);
                      }}
                    >
                      确认判断并继续 →
                    </button>
                  </div>
                </section>
              )}

              {showDecisionStep && selectionConfig && (
                <section className="selection-step">
                  <DirectSelection
                    config={selectionConfig}
                    candidates={selectionCandidates}
                    selectedItems={selectedItems}
                    day={activeDay.day}
                    onToggle={toggleLineSelection}
                  />
                  <div className="atomic-nav">
                    <button
                      type="button"
                      className="previous-link"
                      disabled={taskStep === 0}
                      onClick={() => moveTaskStep(taskStep - 1)}
                    >
                      ← 上一步
                    </button>
                    <button
                      type="button"
                      className="primary-action"
                      disabled={!decisionReady}
                      onClick={() => {
                        setValidationMessage('');
                        moveTaskStep(taskStep + 1);
                      }}
                    >
                      确认选择并继续 →
                    </button>
                  </div>
                </section>
              )}

              {showCompletionStep && (
                <>
                  {activeDay.externalAction && (
                    <section className="reality-card">
                      <span className="mono-label">REALITY TEST · 在网页之外完成</span>
                      <h2>把今天的结果交给真实的人</h2>
                      <p>{activeDay.externalAction}</p>
                      <label className="reality-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(reality[String(activeDay.day)])}
                          onChange={toggleReality}
                        />
                        <span>{reality[String(activeDay.day)] ? '已执行并记录反馈' : '执行后在这里标记'}</span>
                      </label>
                    </section>
                  )}

                  <section className="guided-completion">
                    <span className="mono-label">RESULT READY</span>
                    <h2>{completed[String(activeDay.day)] ? '这一步已经留下结果' : '今天的结果已经准备好'}</h2>
                    <p>{nextUse}</p>
                    <p className="automatic-rule">{automaticRule}</p>
                    {activeDay.day > 3 && (
                      <details className="completion-guide">
                        <summary>可选：查看书中的写作提示</summary>
                        <ul>
                          {activeDay.checks.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <div className="completion-actions quiet-completion-actions">
                      <button
                        type="button"
                        className="primary-action"
                        onClick={() => {
                          if (completed[String(activeDay.day)]) {
                            if (activeDay.day < 30) navigateToDay(activeDay.day + 1);
                            else setView('results');
                          } else {
                            completeDay();
                          }
                        }}
                      >
                        {completed[String(activeDay.day)]
                          ? activeDay.day < 30
                            ? `继续 Day ${activeDay.day + 1} →`
                            : '查看最终成果 →'
                          : '保存并完成今天'}
                      </button>
                      <button
                        type="button"
                        className="previous-link"
                        onClick={() => moveTaskStep(completionStepIndex - 1)}
                      >
                        ← 返回修改本页
                      </button>
                    </div>
                    <p className="validation-message" role="status" aria-live="polite">
                      {validationMessage}
                    </p>
                  </section>
                </>
              )}
            </>
          )}

          <details className="source-details">
            <summary>查看原书依据与编校说明</summary>
            <p>任务来源：原书 30 天附录 · PDF 第 {activeDay.sourcePages} 页</p>
            {activeDay.editorialNote && <p>{activeDay.editorialNote}</p>}
          </details>
        </article>
      </div>

    </main>
  );
}

function AppBar({
  completedCount,
  saveLabel,
  currentDay,
  onMenu,
  onHome,
  onResults,
}: {
  completedCount: number;
  saveLabel: string;
  currentDay?: number;
  onMenu?: () => void;
  onHome: () => void;
  onResults: () => void;
}) {
  return (
    <header className="app-bar">
      {onMenu && (
        <button type="button" className="menu-button" onClick={onMenu} aria-label="打开 30 天目录">
          目录
        </button>
      )}
      <button type="button" className="brand-button" onClick={onHome}>
        <span>TALENT TO VALUE</span>
        <strong>把才华变成价值</strong>
      </button>
      <div className="app-bar-status" aria-live="polite">
        <span>{currentDay ? `Day ${currentDay} / 30` : `${completedCount} / 30 已产出`}</span>
        <span>{saveLabel}</span>
      </div>
      <button type="button" className="results-button" onClick={onResults}>
        成果中心
      </button>
    </header>
  );
}

function DirectSelection({
  config,
  candidates,
  selectedItems,
  day,
  onToggle,
}: {
  config: SelectionConfig;
  candidates: string[];
  selectedItems: string[];
  day: number;
  onToggle: (targetId: string, item: string, max: number) => void;
}) {
  const titleId = `selection-title-${day}`;
  return (
    <section className="direct-selection" aria-labelledby={titleId}>
      <span className="mono-label">CHOOSE FROM WHAT YOU ALREADY WROTE</span>
      <h2 id={titleId}>{config.title}</h2>
      <p>{config.helper}</p>
      {candidates.length ? (
        <div className="selection-list">
          {candidates.map((item, index) => {
            const selected = selectedItems.includes(item);
            const selectedPosition = selectedItems.indexOf(item);
            return (
              <button
                type="button"
                key={`${item}-${index}`}
                className={selected ? 'is-selected' : ''}
                aria-pressed={selected}
                onClick={() => onToggle(config.targetId, item, config.max)}
              >
                <span>{pad(index + 1)}</span>
                <strong>{item}</strong>
                <small>
                  {selected
                    ? day === 2
                      ? '主要客户'
                      : day === 4
                        ? '本句主轴'
                        : `重点问题 ${selectedPosition + 1}`
                    : '点击选择'}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty-selection">
          {day === 4
            ? '先完成 Day 3 并选出 3 个重点问题，它们会自动出现在这里。'
            : '先在上方逐行写下候选，写出的内容会自动变成可选择的卡片。'}
        </p>
      )}
      <div className="selection-count">
        已选择 {selectedItems.length} / {config.max}
      </div>
    </section>
  );
}
