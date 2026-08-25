'use client';

import { useEffect, useMemo, useState } from 'react';
import { days, type Day, type Prompt } from './curriculum';

type View = 'intro' | 'overview' | 'day';
type AnswerMap = Record<string, string>;
type BooleanMap = Record<string, boolean>;

type SavedState = {
  answers?: AnswerMap;
  completed?: BooleanMap;
  currentDay?: number;
};

type SelectionStep = {
  kind: 'selection';
  title: string;
  helper?: string;
  sourceDay: number;
  sourceId: string;
  targetId: string;
  max: number;
};

type FlowStep =
  | { kind: 'prompt'; prompt: Prompt }
  | { kind: 'clarity' }
  | SelectionStep
  | { kind: 'action'; text: string };

const STORAGE_KEY = 'talent-to-value-demo-v1';
const keyFor = (day: number, id: string) => `${day}:${id}`;

const clarityQuestions = [
  { id: 'clarityWho', label: '别人能看出你主要在帮助谁吗？' },
  { id: 'clarityProblem', label: '别人能看出你可以解决什么问题吗？' },
  { id: 'clarityTiming', label: '别人知道什么时候可以来找你吗？' },
];

const fourSteps = [
  '想清楚：你能帮谁解决什么问题',
  '证明：别人为什么应该相信你',
  '表达：让合适的人看懂你的价值',
  '出售：把能力变成可以购买的服务或产品',
];

function uniqueLines(value: string) {
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
  const audiences = uniqueLines(next[keyFor(2, 'audienceCandidates')] ?? '');
  next[keyFor(2, 'selectedAudience')] = uniqueLines(next[keyFor(2, 'selectedAudience')] ?? '')
    .filter((item) => audiences.includes(item))
    .slice(0, 1)
    .join('\n');

  const problems = uniqueLines(next[keyFor(3, 'problemCandidates')] ?? '');
  next[keyFor(3, 'topProblems')] = uniqueLines(next[keyFor(3, 'topProblems')] ?? '')
    .filter((item) => problems.includes(item))
    .slice(0, 3)
    .join('\n');

  const topProblems = uniqueLines(next[keyFor(3, 'topProblems')] ?? '');
  next[keyFor(4, 'focusProblem')] = uniqueLines(next[keyFor(4, 'focusProblem')] ?? '')
    .filter((item) => topProblems.includes(item))
    .slice(0, 1)
    .join('\n');

  const valueVersions = uniqueLines(next[keyFor(4, 'valueVersions')] ?? '');
  next[keyFor(4, 'selectedValue')] = uniqueLines(next[keyFor(4, 'selectedValue')] ?? '')
    .filter((item) => valueVersions.includes(item))
    .slice(0, 1)
    .join('\n');
  return next;
}

function isPromptValid(prompt: Prompt, value: string) {
  const clean = value.trim();
  if (!clean) return false;
  if (prompt.targetCount && uniqueLines(clean).length < prompt.targetCount) return false;
  if (prompt.minChars && clean.length < prompt.minChars) return false;
  if (prompt.maxChars && clean.length > prompt.maxChars) return false;
  return true;
}

function getFlow(day: Day): FlowStep[] {
  if (day.day === 1) {
    return [{ kind: 'prompt', prompt: day.prompts[0] }, { kind: 'clarity' }];
  }

  if (day.day === 2) {
    return [
      { kind: 'prompt', prompt: day.prompts[0] },
      {
        kind: 'selection',
        title: '这一次，你最想先服务谁？',
        helper: '从刚才写的 10 个候选里选一个。其他答案会保留，但后面先只围绕这一位客户展开。',
        sourceDay: 2,
        sourceId: 'audienceCandidates',
        targetId: 'selectedAudience',
        max: 1,
      },
    ];
  }

  if (day.day === 3) {
    return [
      { kind: 'prompt', prompt: day.prompts[0] },
      {
        kind: 'selection',
        title: '从中选出最重要的 3 个问题',
        helper: '选择客户最着急、最具体，而且你确实能帮忙推进的问题。',
        sourceDay: 3,
        sourceId: 'problemCandidates',
        targetId: 'topProblems',
        max: 3,
      },
    ];
  }

  if (day.day === 4) {
    return [
      {
        kind: 'selection',
        title: '这句话先回应哪个问题？',
        sourceDay: 3,
        sourceId: 'topProblems',
        targetId: 'focusProblem',
        max: 1,
      },
      { kind: 'prompt', prompt: day.prompts[1] },
      {
        kind: 'selection',
        title: '选出最容易听懂的一版',
        sourceDay: 4,
        sourceId: 'valueVersions',
        targetId: 'selectedValue',
        max: 1,
      },
    ];
  }

  const flow: FlowStep[] = day.prompts.map((prompt) => ({ kind: 'prompt', prompt }));
  if (day.externalAction) {
    const positions: Record<number, number> = { 7: 1, 21: 0, 28: 1, 29: 0, 30: 2 };
    flow.splice(positions[day.day] ?? flow.length, 0, { kind: 'action', text: day.externalAction });
  }
  return flow;
}

function completionCopy(day: number, answers: AnswerMap) {
  if (day === 1) {
    const hasUnclear = clarityQuestions.some((question) => answers[keyFor(1, question.id)] === '不清楚');
    return {
      title: '由此你知道了自己的自我介绍出了什么问题',
      body: hasUnclear
        ? '接下来，我们会把还没说清楚的部分一步步补上。'
        : '这段介绍已经回答了三个关键问题，接下来继续验证它能不能让别人行动。',
    };
  }
  if (day === 2) return { title: '你已经确定了这一轮先服务谁', body: '下一关，只研究这位客户最想解决的问题。' };
  if (day === 3) return { title: '你已经找到了客户最在意的 3 个问题', body: '下一关，把客户和问题组合成一句容易听懂的话。' };
  if (day === 30) return { title: '30 关完成', body: '现在，把第一版放到真实世界里继续测试。' };
  return { title: `第 ${day} 关完成`, body: '答案已经保存，可以进入下一关。' };
}

export default function Home() {
  const [view, setView] = useState<View>('intro');
  const [currentDay, setCurrentDay] = useState(1);
  const [dayStep, setDayStep] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [completed, setCompleted] = useState<BooleanMap>({});
  const [hydrated, setHydrated] = useState(false);

  const activeDay = days[currentDay - 1];
  const flow = useMemo(() => getFlow(activeDay), [activeDay]);
  const currentStep = flow[dayStep];
  const completedCount = days.filter((day) => completed[String(day.day)]).length;
  const firstIncomplete = days.find((day) => !completed[String(day.day)])?.day ?? 30;

  /* eslint-disable react-hooks/set-state-in-effect -- restoring device-local progress is intentional */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedState;
        const savedAnswers = normalizeAnswers(saved.answers ?? {});
        const savedCompleted = saved.completed ?? {};
        const nextDay = days.find((day) => !savedCompleted[String(day.day)]);
        const resumeDay = nextDay?.day ?? 30;
        setAnswers(savedAnswers);
        setCompleted(savedCompleted);
        setCurrentDay(resumeDay);
        if (Object.keys(savedAnswers).some((key) => savedAnswers[key]) || Object.values(savedCompleted).some(Boolean)) {
          setView(nextDay ? 'day' : 'overview');
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answers, completed, currentDay }),
    );
  }, [answers, completed, currentDay, hydrated]);

  useEffect(() => {
    if (!levelsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLevelsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', close);
    };
  }, [levelsOpen]);

  const navigateToDay = (dayNumber: number) => {
    const isFuturePreview = !completed[String(dayNumber)] && dayNumber !== firstIncomplete;
    setCurrentDay(dayNumber);
    setPreviewMode(isFuturePreview);
    setDayStep(0);
    setLevelsOpen(false);
    setView('day');
    window.scrollTo({ top: 0 });
  };

  const invalidateFrom = (dayNumber: number) => {
    setCompleted((previous) => {
      const next = { ...previous };
      Object.keys(next).forEach((key) => {
        if (Number(key) >= dayNumber) next[key] = false;
      });
      return next;
    });
  };

  const setAnswer = (id: string, value: string) => {
    setAnswers((previous) => {
      const next = { ...previous, [keyFor(currentDay, id)]: value };

      if (currentDay === 2 && id === 'audienceCandidates') {
        const candidates = uniqueLines(value);
        next[keyFor(2, 'selectedAudience')] = uniqueLines(previous[keyFor(2, 'selectedAudience')] ?? '')
          .filter((item) => candidates.includes(item))
          .slice(0, 1)
          .join('\n');
      }

      if (currentDay === 3 && (id === 'problemCandidates' || id === 'topProblems')) {
        if (id === 'problemCandidates') {
          const candidates = uniqueLines(value);
          next[keyFor(3, 'topProblems')] = uniqueLines(previous[keyFor(3, 'topProblems')] ?? '')
            .filter((item) => candidates.includes(item))
            .slice(0, 3)
            .join('\n');
        }
        const selectedProblems = uniqueLines(next[keyFor(3, 'topProblems')] ?? '');
        next[keyFor(4, 'focusProblem')] = uniqueLines(previous[keyFor(4, 'focusProblem')] ?? '')
          .filter((item) => selectedProblems.includes(item))
          .slice(0, 1)
          .join('\n');
      }

      if (currentDay === 4 && id === 'valueVersions') {
        const versions = uniqueLines(value);
        next[keyFor(4, 'selectedValue')] = uniqueLines(previous[keyFor(4, 'selectedValue')] ?? '')
          .filter((item) => versions.includes(item))
          .slice(0, 1)
          .join('\n');
      }
      return next;
    });

    if (completed[String(currentDay)]) invalidateFrom(currentDay);
  };

  const advance = () => {
    if (dayStep === flow.length - 1) {
      setCompleted((previous) => ({ ...previous, [String(currentDay)]: true }));
      setDayStep(flow.length);
    } else {
      setDayStep((step) => step + 1);
    }
    window.scrollTo({ top: 0 });
  };

  const toggleSelection = (step: SelectionStep, item: string) => {
    const selected = uniqueLines(answers[keyFor(currentDay, step.targetId)] ?? '');
    const next = selected.includes(item)
      ? selected.filter((entry) => entry !== item)
      : step.max === 1
        ? [item]
        : selected.length < step.max
          ? [...selected, item]
          : selected;
    setAnswer(step.targetId, next.join('\n'));
  };

  const startOrContinue = () => {
    if (completedCount === 30) setLevelsOpen(true);
    else navigateToDay(firstIncomplete);
  };

  if (!hydrated) return <main className="mvp-home" aria-busy="true" />;

  if (view === 'intro') {
    return (
      <main className="mvp-home">
        <section className="home-content">
          <h1>教你如何把才华变成钱</h1>
          <ul className="pain-list">
            <li>你有没有想过把自己的能力变成一个服务或者一项产品？</li>
            <li>到底是什么阻碍了你？还是说你已经在做了但效果不好？</li>
            <li>今天我们可以通过这个工具来理清楚。</li>
          </ul>
          <button className="main-button" type="button" onClick={() => setView('overview')}>
            下一步
          </button>
        </section>
      </main>
    );
  }

  if (view === 'overview') {
    return (
      <main className="mvp-home">
        <section className="home-content overview-content">
          <button className="back-link" type="button" onClick={() => setView('intro')}>
            ← 返回
          </button>
          <h1>四步把才华变成钱</h1>
          <p className="overview-copy">
            这个工具会通过下面四个步骤来帮你想清楚。现在一共有 30 关，不用担心，时间不会很长，让我们现在开始吧！
          </p>
          <ol className="four-step-list">
            {fourSteps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
          <div className="home-actions">
            <button className="main-button" type="button" onClick={startOrContinue}>
              {completedCount === 30
                ? '查看已完成关卡'
                : completedCount
                  ? `继续第 ${firstIncomplete} 关`
                  : '开始第 1 关'}
            </button>
            <button className="text-button" type="button" onClick={() => setLevelsOpen(true)}>
              预览全部 30 关
            </button>
          </div>
        </section>
        <LevelList
          open={levelsOpen}
          completed={completed}
          firstIncomplete={firstIncomplete}
          onClose={() => setLevelsOpen(false)}
          onSelect={navigateToDay}
        />
      </main>
    );
  }

  const completion = completionCopy(currentDay, answers);
  const isFinishedScreen = dayStep >= flow.length;

  return (
    <main className="mvp-day">
      <header className="day-header">
        <button type="button" onClick={() => setView('intro')}>首页</button>
        <span>第 {currentDay} / 30 关</span>
        <button type="button" onClick={() => setLevelsOpen(true)}>30 关</button>
      </header>
      <div className="day-progress" aria-hidden="true">
        <span style={{ width: `${(currentDay / 30) * 100}%` }} />
      </div>

      <section className="day-content">
        {previewMode ? (
          <PreviewDay day={activeDay} flow={flow} currentDay={firstIncomplete} onReturn={() => navigateToDay(firstIncomplete)} />
        ) : isFinishedScreen ? (
          <div className="completion-message">
            <span className="completion-mark">✓</span>
            <h1>{completion.title}</h1>
            <p>{completion.body}</p>
            <button
              className="main-button"
              type="button"
              onClick={() => {
                if (currentDay < 30) navigateToDay(currentDay + 1);
                else setView('overview');
              }}
            >
              {currentDay < 30 ? `进入第 ${currentDay + 1} 关` : '回到首页'}
            </button>
          </div>
        ) : currentStep?.kind === 'prompt' ? (
          <PromptQuestion
            day={currentDay}
            prompt={currentStep.prompt}
            value={answers[keyFor(currentDay, currentStep.prompt.id)] ?? ''}
            onChange={(value) => setAnswer(currentStep.prompt.id, value)}
            onBack={() => (dayStep ? setDayStep((step) => step - 1) : setView('overview'))}
            onConfirm={advance}
          />
        ) : currentStep?.kind === 'clarity' ? (
          <ClarityQuestion
            answers={answers}
            intro={answers[keyFor(1, 'currentIntro')] ?? ''}
            onChange={setAnswer}
            onBack={() => setDayStep((step) => step - 1)}
            onConfirm={advance}
          />
        ) : currentStep?.kind === 'selection' ? (
          <ChooseQuestion
            step={currentStep}
            candidates={uniqueLines(answers[keyFor(currentStep.sourceDay, currentStep.sourceId)] ?? '')}
            selected={uniqueLines(answers[keyFor(currentDay, currentStep.targetId)] ?? '')}
            onToggle={(item) => toggleSelection(currentStep, item)}
            onBack={() => (dayStep ? setDayStep((step) => step - 1) : setView('overview'))}
            onConfirm={advance}
          />
        ) : currentStep?.kind === 'action' ? (
          <ActionQuestion
            text={currentStep.text}
            onBack={() => (dayStep ? setDayStep((step) => step - 1) : setView('overview'))}
            onConfirm={advance}
          />
        ) : null}
      </section>

      <LevelList
        open={levelsOpen}
        completed={completed}
        firstIncomplete={firstIncomplete}
        onClose={() => setLevelsOpen(false)}
        onSelect={navigateToDay}
      />
    </main>
  );
}

function PromptQuestion({
  day,
  prompt,
  value,
  onChange,
  onBack,
  onConfirm,
}: {
  day: number;
  prompt: Prompt;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const valid = isPromptValid(prompt, value);
  const title = day === 1 && prompt.id === 'currentIntro' ? '你平时是怎样介绍自己的？' : prompt.label;
  return (
    <>
      <button className="back-link" type="button" onClick={onBack}>← 返回</button>
      <h1>{title}</h1>
      {prompt.helper && <p className="question-intro">{prompt.helper}</p>}
      <label className="sr-only" htmlFor={`prompt-${day}-${prompt.id}`}>{title}</label>
      {prompt.mode === 'text' ? (
        <input
          id={`prompt-${day}-${prompt.id}`}
          type="text"
          autoFocus
          value={value}
          placeholder={prompt.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <textarea
          id={`prompt-${day}-${prompt.id}`}
          autoFocus
          value={value}
          placeholder={day === 1 ? '把你平时最常用的介绍写在这里' : prompt.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {(prompt.targetCount || prompt.minChars || prompt.maxChars) && (
        <p className="input-count">
          {prompt.targetCount
            ? `${uniqueLines(value).length} / ${prompt.targetCount} 条`
            : `${value.length}${prompt.maxChars ? ` / ${prompt.maxChars}` : ''} 字`}
        </p>
      )}
      <div className="step-actions">
        <button className="main-button" type="button" disabled={!valid} onClick={onConfirm}>确认</button>
      </div>
    </>
  );
}

function ClarityQuestion({
  answers,
  intro,
  onChange,
  onBack,
  onConfirm,
}: {
  answers: AnswerMap;
  intro: string;
  onChange: (id: string, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const ready = clarityQuestions.every((question) => Boolean(answers[keyFor(1, question.id)]));
  return (
    <>
      <button className="back-link" type="button" onClick={onBack}>← 返回修改</button>
      <h1>请站在一个路人的角度看一下</h1>
      <p className="question-intro">这段介绍有没有回答清楚下面三件事？</p>
      <blockquote className="intro-preview">{intro}</blockquote>
      <div className="clarity-list">
        {clarityQuestions.map((question, index) => {
          const value = answers[keyFor(1, question.id)] ?? '';
          return (
            <fieldset key={question.id}>
              <legend>{index + 1}. {question.label}</legend>
              <div>
                {['清楚', '不清楚'].map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={value === option ? 'choice-button selected' : 'choice-button'}
                    aria-pressed={value === option}
                    onClick={() => onChange(question.id, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <div className="step-actions">
        <button className="main-button" type="button" disabled={!ready} onClick={onConfirm}>确认</button>
      </div>
    </>
  );
}

function ChooseQuestion({
  step,
  candidates,
  selected,
  onToggle,
  onBack,
  onConfirm,
}: {
  step: SelectionStep;
  candidates: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const ready = selected.length === step.max && selected.every((item) => candidates.includes(item));
  return (
    <>
      <button className="back-link" type="button" onClick={onBack}>← 返回</button>
      <h1>{step.title}</h1>
      {step.helper && <p className="question-intro">{step.helper}</p>}
      <div className="selection-list">
        {candidates.map((item, index) => (
          <button
            type="button"
            key={`${item}-${index}`}
            className={selected.includes(item) ? 'selection-item selected' : 'selection-item'}
            aria-pressed={selected.includes(item)}
            onClick={() => onToggle(item)}
          >
            <span>{index + 1}</span>
            <strong>{item}</strong>
          </button>
        ))}
      </div>
      <p className="input-count">已选 {selected.length} / {step.max}</p>
      <div className="step-actions">
        <button className="main-button" type="button" disabled={!ready} onClick={onConfirm}>确认</button>
      </div>
    </>
  );
}

function ActionQuestion({
  text,
  onBack,
  onConfirm,
}: {
  text: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <button className="back-link" type="button" onClick={onBack}>← 返回</button>
      <h1>现在去完成这件事</h1>
      <p className="action-copy">{text}</p>
      <div className="step-actions">
        <button className="main-button" type="button" onClick={onConfirm}>我做完了，继续</button>
      </div>
    </>
  );
}

function PreviewDay({
  day,
  flow,
  currentDay,
  onReturn,
}: {
  day: Day;
  flow: FlowStep[];
  currentDay: number;
  onReturn: () => void;
}) {
  const labels = flow.map((step) => {
    if (step.kind === 'prompt') return step.prompt.label;
    if (step.kind === 'clarity') return '从路人角度判断介绍是否清楚';
    if (step.kind === 'selection') return step.title;
    return '完成一次现实行动';
  });
  return (
    <div className="preview-day">
      <span className="preview-badge">预览 · 未完成</span>
      <h1>第 {day.day} 关：{day.title}</h1>
      <p>这一关会做：</p>
      <ol>
        {labels.map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}
      </ol>
      <button className="main-button" type="button" onClick={onReturn}>回到第 {currentDay} 关</button>
    </div>
  );
}

function LevelList({
  open,
  completed,
  firstIncomplete,
  onClose,
  onSelect,
}: {
  open: boolean;
  completed: BooleanMap;
  firstIncomplete: number;
  onClose: () => void;
  onSelect: (day: number) => void;
}) {
  if (!open) return null;
  return (
    <div className="level-overlay" role="dialog" aria-modal="true" aria-labelledby="level-list-title">
      <section className="level-panel">
        <header>
          <div>
            <h2 id="level-list-title">全部 30 关</h2>
            <p>可以预览，只有确认完成才会改变进度。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭关卡列表">关闭</button>
        </header>
        <div className="level-list">
          {days.map((day) => {
            const status = completed[String(day.day)]
              ? '已完成'
              : day.day === firstIncomplete
                ? '继续这里'
                : '未完成';
            return (
              <button type="button" key={day.day} onClick={() => onSelect(day.day)}>
                <span>{String(day.day).padStart(2, '0')}</span>
                <strong>{day.title}</strong>
                <small>{status}</small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
