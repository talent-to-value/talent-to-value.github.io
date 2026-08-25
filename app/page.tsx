'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { days, stages, type Day, type Prompt } from './curriculum';

type View = 'intro' | 'overview' | 'day';
type AnswerMap = Record<string, string>;
type BooleanMap = Record<string, boolean>;

type SavedState = {
  answers?: AnswerMap;
  completed?: BooleanMap;
  deferred?: BooleanMap;
  currentDay?: number;
  dayStep?: number;
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

function hasPromptAnswer(value: string) {
  return Boolean(value.trim());
}

function promptExample(day: number, prompt: Prompt) {
  if (day === 1) return '我以前做产品，现在做咨询，也会写一些关于个人成长和商业的内容。';
  if (day === 2) return '准备从公司转向自由职业的人\n已经开始提供咨询的独立顾问';
  if (day === 3) return '我不知道怎么介绍自己\n我发了很多内容，但没人来问\n每次有人问价格，我都不知道该怎么报价';
  if (day === 4) return '我帮已经开始做咨询、但客户看不懂差别的独立顾问，把零散经验整理成一页能直接发给客户的服务说明。';
  if (day === 5 && prompt.id === 'evidenceFacts') return '我为 3 位独立顾问重写过服务介绍\n我整理过一套客户访谈提纲';
  if (day === 5) return '我能做这件事，是因为我已经把 3 次真实服务整理成了可以核验的前后版本。';
  return prompt.placeholder?.trim() ?? '';
}

function stuckHelp(day: number, prompt: Prompt) {
  if (day === 1) {
    return ['想象刚认识的人问你：“你是做什么的？”', '把你脱口而出的回答写下来。', '只有一句也可以继续。'];
  }
  if (day === 2) {
    return ['最近一次主动找你帮忙的人是谁？', '你最了解哪一类人的处境？', '你已经有作品或经验能帮到谁？'];
  }
  if (day === 3) {
    return ['先回想最近一次这类人找你时说的原话。', '也可以看聊天、评论或咨询记录。', '不确定是否真实存在时，加上“【待验证】”再继续。'];
  }
  if (day === 4) {
    return ['先直接套用“我帮谁，解决什么，最终可以什么”。', '一次只替换一个词，不用追求漂亮。', '写出 1 版就可以继续，其他版本之后再补。'];
  }
  if (day === 5) {
    return ['作品、免费帮助、旧稿和过程记录都可以算事实。', '先写“我做过……”而不是“我很专业”。', '只有一条相关事实也可以继续。'];
  }
  if (prompt.mode === 'lines') {
    return ['先写你已经遇到过的一个真实例子。', '再回想聊天、工作或评论里出现过的原话。', '想到 1 条就可以继续，之后随时回来补。'];
  }
  return ['先写关键词或一个不完整的版本。', '不要追求一次写对，当前答案只是下一步的材料。', '如果仍然没有思路，可以先标记待补充并继续。'];
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
        title: '这一轮，先服务谁？',
        helper: '从刚才写出的候选里先选一个临时方向。其他答案会保留，后面先围绕这一类人展开。',
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
        title: '从中选出最重要的几个问题',
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

function completionCopy(day: number, answers: AnswerMap, partial: boolean) {
  if (partial && day === 2) {
    return {
      title: '你还没确定服务谁，也可以先往下走',
      body: '下一关先回想最近一次别人来找你时，他说过的具体问题。等你更有感觉了，再从左侧导航回来补这个选择。',
    };
  }
  if (partial && day === 3) {
    return {
      title: '先带着目前想到的问题继续',
      body: '下一关可以先用最近一次真实求助里的问题试写一句话；素材不够时，之后再从左侧回来补。',
    };
  }
  if (partial) {
    return {
      title: '这一关先完成到这里',
      body: '没填完的地方已经标记为“待补充”。你可以先带着现有答案继续，也可以随时从左侧导航回来补。',
    };
  }
  if (day === 1) {
    const hasUnclear = clarityQuestions.some((question) => answers[keyFor(1, question.id)] === '不清楚');
    return {
      title: hasUnclear ? '你已经找到这段介绍缺少的信息' : '这段介绍目前已经能被听懂',
      body: hasUnclear
        ? '先不用急着重写，后面会把这些部分逐项补齐。'
        : '先保留它，后面继续验证它能不能让人信任并采取行动。',
    };
  }
  if (day === 2) return { title: '你有了一个临时目标客户', body: '下一关只研究他正在为什么事情头疼；如果后面发现选错，随时回来换。' };
  if (day === 3) return { title: '你找到了客户当前最在意的问题', body: '下一关，把客户和这些问题组合成一句容易听懂的话。' };
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
  const [deferred, setDeferred] = useState<BooleanMap>({});
  const [hydrated, setHydrated] = useState(false);

  const activeDay = days[currentDay - 1];
  const activeStage = stages[activeDay.stage - 1];
  const flow = useMemo(() => getFlow(activeDay), [activeDay]);
  const currentStep = flow[dayStep];
  const completedCount = days.filter((day) => completed[String(day.day)]).length;
  const firstIncomplete = days.find((day) => !completed[String(day.day)])?.day ?? 30;
  const activeDayIsPartial = Object.entries(deferred).some(
    ([key, value]) => value && key.startsWith(`${currentDay}:`),
  );

  /* eslint-disable react-hooks/set-state-in-effect -- restoring device-local progress is intentional */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedState;
        const savedAnswers = normalizeAnswers(saved.answers ?? {});
        const savedCompleted = saved.completed ?? {};
        const savedDeferred = saved.deferred ?? {};
        const nextDay = days.find((day) => !savedCompleted[String(day.day)]);
        const resumeDay = nextDay?.day ?? 30;
        setAnswers(savedAnswers);
        setCompleted(savedCompleted);
        setDeferred(savedDeferred);
        setCurrentDay(resumeDay);
        if (saved.currentDay === resumeDay) setDayStep(saved.dayStep ?? 0);
        if (
          Object.keys(savedAnswers).some((key) => savedAnswers[key])
          || Object.values(savedCompleted).some(Boolean)
          || Object.values(savedDeferred).some(Boolean)
        ) {
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
      JSON.stringify({ answers, completed, deferred, currentDay, dayStep }),
    );
  }, [answers, completed, currentDay, dayStep, deferred, hydrated]);

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
    const isFuturePreview = dayNumber > firstIncomplete && !completed[String(dayNumber)];
    setCurrentDay(dayNumber);
    setPreviewMode(isFuturePreview);
    setDayStep(0);
    setLevelsOpen(false);
    setView('day');
    window.scrollTo({ top: 0 });
  };

  const setAnswer = (id: string, value: string) => {
    const dependentSelectionWillBeEmpty =
      (currentDay === 2
        && id === 'audienceCandidates'
        && uniqueLines(answers[keyFor(2, 'selectedAudience')] ?? '')
          .filter((item) => uniqueLines(value).includes(item)).length === 0)
      || (currentDay === 3
        && id === 'problemCandidates'
        && uniqueLines(answers[keyFor(3, 'topProblems')] ?? '')
          .filter((item) => uniqueLines(value).includes(item)).length === 0)
      || (currentDay === 4
        && id === 'valueVersions'
        && uniqueLines(answers[keyFor(4, 'selectedValue')] ?? '')
          .filter((item) => uniqueLines(value).includes(item)).length === 0);

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
    setDeferred((previous) => ({ ...previous, [keyFor(currentDay, id)]: false }));
    if (!value.trim() || dependentSelectionWillBeEmpty) {
      setCompleted((previous) => ({ ...previous, [String(currentDay)]: false }));
    }
  };

  const deferAndAdvance = (id: string) => {
    setDeferred((previous) => ({ ...previous, [keyFor(currentDay, id)]: true }));
    advance();
  };

  const changeClarity = (id: string, value: string) => {
    setAnswer(id, value);
    const nextAnswers = { ...answers, [keyFor(1, id)]: value };
    if (clarityQuestions.every((question) => Boolean(nextAnswers[keyFor(1, question.id)]))) {
      setDeferred((previous) => ({ ...previous, [keyFor(1, 'clarity')]: false }));
    }
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
      <main className="mvp-home home-shell">
        <section className="editorial-home">
          <header className="home-masthead">
            <span>TALENT TO VALUE · 30 关</span>
            <span>能力 → 服务 → 产品</span>
          </header>
          <div className="home-hero">
            <div className="home-hero-copy">
              <span className="home-eyebrow">一套可以真正动手完成的引导工具</span>
              <h1>教你如何把才华变成钱</h1>
              <p>把脑子里模糊的能力，一步步整理成别人看得懂、愿意相信、可以买到的服务或产品。</p>
              <button className="main-button" type="button" onClick={() => setView('overview')}>
                下一步 <span aria-hidden="true">→</span>
              </button>
            </div>
            <aside className="home-question-card" aria-label="你可能正在面对的问题">
              <span className="home-card-label">先从你的真实处境开始</span>
              <ul className="pain-list">
                <li>你有没有想过把自己的能力变成一个服务或者一项产品？</li>
                <li>到底是什么阻碍了你？还是说你已经在做了但效果不好？</li>
                <li>今天我们可以通过这个工具来理清楚。</li>
              </ul>
            </aside>
          </div>
          <footer className="home-footer">
            <span>30 关 · 每次只处理一个问题</span>
            <span>{completedCount} / 30 已推进</span>
          </footer>
        </section>
      </main>
    );
  }

  if (view === 'overview') {
    return (
      <main className="mvp-home overview-shell">
        <section className="overview-frame">
          <header className="home-masthead">
            <button type="button" onClick={() => setView('intro')}>← 返回首页</button>
            <span>THE ROUTE · 04 STAGES</span>
          </header>
          <div className="overview-heading">
            <div>
              <span className="home-eyebrow">接下来会发生什么</span>
              <h1>四步把才华变成钱</h1>
            </div>
            <p className="overview-copy">
              这个工具会通过下面四个步骤来帮你想清楚。现在一共有 30 关，不用担心，时间不会很长，让我们现在开始吧！
            </p>
          </div>
          <div className="stage-card-grid">
            {stages.map((stage) => {
              const stageDays = days.filter((day) => day.stage === stage.id);
              const stageCompleted = stageDays.filter((day) => completed[String(day.day)]).length;
              return (
                <article className={`stage-card stage-card-${stage.id}`} key={stage.id}>
                  <div className="stage-card-top">
                    <span>0{stage.id}</span>
                    <small>DAY {stage.range}</small>
                  </div>
                  <h2>{stage.shortName}</h2>
                  <p>{stage.title}</p>
                  <div className="stage-card-output">最后留下：{stage.output}</div>
                  <span className="stage-card-progress">{stageCompleted} / {stageDays.length} 已推进</span>
                </article>
              );
            })}
          </div>
          <div className="overview-actions">
            <div>
              <span className="home-card-label">你的下一步</span>
              <strong>第 {firstIncomplete} 关 · {days[firstIncomplete - 1].title}</strong>
            </div>
            <div className="home-actions">
              <button className="main-button" type="button" onClick={startOrContinue}>
                {completedCount === 30
                  ? '查看全部关卡'
                  : completedCount
                    ? `继续第 ${firstIncomplete} 关`
                    : '开始第 1 关'}
              </button>
              <button className="text-button" type="button" onClick={() => setLevelsOpen(true)}>
                查看全部 30 关
              </button>
            </div>
          </div>
        </section>
        <LevelList
          open={levelsOpen}
          completed={completed}
          deferred={deferred}
          firstIncomplete={firstIncomplete}
          onClose={() => setLevelsOpen(false)}
          onSelect={navigateToDay}
        />
      </main>
    );
  }

  const completion = completionCopy(currentDay, answers, activeDayIsPartial);
  const isFinishedScreen = dayStep >= flow.length;
  const backFromStep = () => {
    if (dayStep) setDayStep((step) => step - 1);
    else if (currentDay > 1) navigateToDay(currentDay - 1);
    else setView('overview');
  };

  return (
    <main className="mvp-day">
      <DaySidebar
        currentDay={currentDay}
        completed={completed}
        deferred={deferred}
        firstIncomplete={firstIncomplete}
        onHome={() => setView('intro')}
        onSelect={navigateToDay}
      />

      <section className="day-workspace">
        <header className="day-header">
          <button className="mobile-menu-button" type="button" onClick={() => setLevelsOpen(true)}>☰ 目录</button>
          <button className="day-brand" type="button" onClick={() => setView('intro')}>把才华变成钱</button>
          <span>第 {currentDay} / 30 关</span>
        </header>
        <div className="day-progress" aria-hidden="true">
          <span style={{ width: `${(currentDay / 30) * 100}%` }} />
        </div>

        <div className="day-scroll">
          <section className="day-orientation">
            <div className="day-kicker-row">
              <span>阶段 0{activeStage.id} · {activeStage.shortName}</span>
              {activeDayIsPartial && <strong>待补充</strong>}
            </div>
            <h1>第 {currentDay} 关 · {activeDay.title}</h1>
            <div className="day-why">
              <span>为什么做这一步</span>
              <p>{activeDay.principle}</p>
            </div>
            <div className="day-result">
              <span>这一关的目标</span>
              <strong>{activeDay.output}</strong>
            </div>
          </section>

          <section className="day-content">
            {previewMode ? (
              <PreviewDay day={activeDay} flow={flow} currentDay={firstIncomplete} onReturn={() => navigateToDay(firstIncomplete)} />
            ) : isFinishedScreen ? (
              <div className="completion-message">
                <span className={activeDayIsPartial ? 'completion-mark is-partial' : 'completion-mark'}>
                  {activeDayIsPartial ? '…' : '✓'}
                </span>
                <h1>{completion.title}</h1>
                <p>{completion.body}</p>
                <div className="completion-actions">
                  {currentDay > 1 && (
                    <button className="secondary-button" type="button" onClick={() => navigateToDay(currentDay - 1)}>
                      返回第 {currentDay - 1} 关
                    </button>
                  )}
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
              </div>
            ) : currentStep?.kind === 'prompt' ? (
              <PromptQuestion
                day={currentDay}
                prompt={currentStep.prompt}
                value={answers[keyFor(currentDay, currentStep.prompt.id)] ?? ''}
                carryText={
                  currentDay === 2
                    ? answers[keyFor(1, 'currentIntro')] ?? ''
                    : currentDay === 3
                      ? answers[keyFor(2, 'selectedAudience')] ?? ''
                      : currentDay === 4
                        ? [
                            answers[keyFor(2, 'selectedAudience')] ?? '',
                            answers[keyFor(4, 'focusProblem')] ? `当前问题：${answers[keyFor(4, 'focusProblem')]}` : '',
                          ].filter(Boolean).join('\n')
                        : ''
                }
                onChange={(value) => setAnswer(currentStep.prompt.id, value)}
                onBack={backFromStep}
                onConfirm={advance}
                onDefer={() => deferAndAdvance(currentStep.prompt.id)}
              />
            ) : currentStep?.kind === 'clarity' ? (
              <ClarityQuestion
                answers={answers}
                intro={answers[keyFor(1, 'currentIntro')] ?? ''}
                onChange={changeClarity}
                onBack={() => setDayStep((step) => step - 1)}
                onConfirm={advance}
                onDefer={() => deferAndAdvance('clarity')}
              />
            ) : currentStep?.kind === 'selection' ? (
              <ChooseQuestion
                step={currentStep}
                candidates={uniqueLines(answers[keyFor(currentStep.sourceDay, currentStep.sourceId)] ?? '')}
                selected={uniqueLines(answers[keyFor(currentDay, currentStep.targetId)] ?? '')}
                onToggle={(item) => toggleSelection(currentStep, item)}
                onBack={backFromStep}
                onConfirm={advance}
                onDefer={() => deferAndAdvance(currentStep.targetId)}
              />
            ) : currentStep?.kind === 'action' ? (
              <ActionQuestion
                text={currentStep.text}
                onBack={backFromStep}
                onConfirm={() => {
                  setDeferred((previous) => ({ ...previous, [keyFor(currentDay, `action-${dayStep}`)]: false }));
                  advance();
                }}
                onDefer={() => deferAndAdvance(`action-${dayStep}`)}
              />
            ) : null}
          </section>
        </div>
      </section>

      <LevelList
        open={levelsOpen}
        completed={completed}
        deferred={deferred}
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
  carryText,
  onChange,
  onBack,
  onConfirm,
  onDefer,
}: {
  day: number;
  prompt: Prompt;
  value: string;
  carryText: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onDefer: () => void;
}) {
  const [showFallback, setShowFallback] = useState(false);
  const valid = hasPromptAnswer(value);
  const lines = uniqueLines(value).length;
  const example = promptExample(day, prompt);
  const title = day === 1 && prompt.id === 'currentIntro'
    ? '把你平时真实会说的那一段写下来'
    : prompt.label;
  const countCopy = prompt.targetCount
    ? lines
      ? lines < prompt.targetCount
        ? `已写 ${lines} 条 · 建议继续想到 ${prompt.targetCount} 条`
        : `已写 ${lines} 条`
      : `建议尝试想到 ${prompt.targetCount} 条`
    : prompt.minChars || prompt.maxChars
      ? `已经写了 ${value.length} 字；建议字数只用于帮助控制篇幅，不影响继续。`
      : '';
  const confirmLabel = day === 1
    ? '用路人的眼光看一遍 →'
    : prompt.targetCount && lines < prompt.targetCount
      ? `先带着这 ${lines} 条继续 →`
      : day === 2
        ? '从这些候选里选一个 →'
        : '保存并继续 →';
  return (
    <>
      <button className="back-link" type="button" onClick={onBack}>← {day > 1 ? '上一关或上一步' : '返回'}</button>
      <span className="question-label">现在做什么</span>
      <h1>{title}</h1>
      {prompt.helper && <p className="question-intro">{prompt.helper}</p>}
      {carryText && (
        <div className="carry-card">
          <span>{day === 2 ? '你上一关写的介绍' : day === 3 ? '这一轮先服务的人' : '前面已经确定的方向'}</span>
          <p>「{carryText}」</p>
          <small>
            {day === 2
              ? '里面如果已经出现某类人，可以先把他写成第一个候选。'
              : day === 3
                ? '下面只围绕这类人正在经历的具体问题来写。'
                : '直接使用这些答案，不需要重新回忆或重新输入。'}
          </small>
        </div>
      )}
      {example && (
        <div className="example-card">
          <span>例如</span>
          <p>{example}</p>
          {day === 1 && <small>这不是标准答案。你平时怎么说，就怎么写。</small>}
        </div>
      )}
      <label className="sr-only" htmlFor={`prompt-${day}-${prompt.id}`}>{title}</label>
      {prompt.mode === 'text' ? (
        <input
          id={`prompt-${day}-${prompt.id}`}
          type="text"
          value={value}
          placeholder={prompt.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <textarea
          id={`prompt-${day}-${prompt.id}`}
          value={value}
          placeholder={day === 1 ? '把你平时最常用的介绍写在这里' : prompt.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {countCopy && <p className="input-count">{countCopy}</p>}
      <details className="stuck-help">
        <summary>写不出来？从这里开始</summary>
        <ul>
          {stuckHelp(day, prompt).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </details>
      {day === 2 && showFallback && (
        <div className="fallback-card">
          <span>那就先回答一个更简单的问题</span>
          <strong>最近一次有人请你帮忙，他大概是什么人？</strong>
          <p>不知道职业也没关系，可以写：“刚开始做副业、来问我怎么起步的朋友。”</p>
          <label className="sr-only" htmlFor="day-2-fallback">最近一次请你帮忙的人</label>
          <input
            id="day-2-fallback"
            type="text"
            value={value}
            placeholder="例如：刚开始做副业、来问我怎么起步的朋友"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
      <div className="step-actions">
        {!valid && (
          <button
            className="secondary-button"
            type="button"
            onClick={day === 2 && !showFallback ? () => setShowFallback(true) : onDefer}
          >
            {day === 2
              ? showFallback ? '仍然想不到，标记待补充' : '换个更简单的问题'
              : '暂时写不出，标记待补充'}
          </button>
        )}
        {valid && <button className="main-button" type="button" onClick={onConfirm}>{confirmLabel}</button>}
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
  onDefer,
}: {
  answers: AnswerMap;
  intro: string;
  onChange: (id: string, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onDefer: () => void;
}) {
  const ready = clarityQuestions.every((question) => Boolean(answers[keyFor(1, question.id)]));
  return (
    <>
      <button className="back-link" type="button" onClick={onBack}>← 返回修改</button>
      <span className="question-label">现在做什么</span>
      <h1>只看这段话，不替自己补充</h1>
      <p className="question-intro">需要猜、需要追问，或者你自己也拿不准，都选“不清楚”。这不是给你的能力打分。</p>
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
        {!ready && <button className="secondary-button" type="button" onClick={onDefer}>暂时判断不出来，先继续</button>}
        <button className="main-button" type="button" disabled={!ready} onClick={onConfirm}>确认这次判断 →</button>
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
  onDefer,
}: {
  step: SelectionStep;
  candidates: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onDefer: () => void;
}) {
  const ready = selected.length > 0
    && selected.length <= step.max
    && selected.every((item) => candidates.includes(item));
  return (
    <>
      <button className="back-link" type="button" onClick={onBack}>← 返回</button>
      <span className="question-label">做一个临时选择</span>
      <h1>{step.title}</h1>
      {step.helper && <p className="question-intro">{step.helper}</p>}
      {step.max > 1 && <p className="selection-note">最多选 {step.max} 个；先选 1 个也可以继续。</p>}
      {step.targetId === 'selectedAudience' && (
        <div className="choice-guide">
          <strong>拿不准时，优先选择符合其中两项的人：</strong>
          <span>你真实接触过 · 他的问题正在发生 · 你确实能帮他往前走一步</span>
        </div>
      )}
      {candidates.length ? (
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
      ) : (
        <div className="empty-choice">
          <strong>现在还没有可选内容</strong>
          <p>可以返回补写，也可以先标记为待补充。后面的关卡不会因此被锁住。</p>
        </div>
      )}
      <p className="input-count">已选 {selected.length}{step.max > 1 ? `，最多 ${step.max} 个` : ''}</p>
      <div className="step-actions">
        {!ready && <button className="secondary-button" type="button" onClick={onDefer}>暂时拿不准，先继续</button>}
        <button className="main-button" type="button" disabled={!ready} onClick={onConfirm}>就先从这里开始 →</button>
      </div>
    </>
  );
}

function ActionQuestion({
  text,
  onBack,
  onConfirm,
  onDefer,
}: {
  text: string;
  onBack: () => void;
  onConfirm: () => void;
  onDefer: () => void;
}) {
  return (
    <>
      <button className="back-link" type="button" onClick={onBack}>← 返回</button>
      <span className="question-label">现实行动</span>
      <h1>现在去完成这件事</h1>
      <p className="action-copy">{text}</p>
      <div className="step-actions">
        <button className="secondary-button" type="button" onClick={onDefer}>暂时没做，先继续</button>
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
      <h1>这一关会怎样进行</h1>
      <div className="preview-output">完成后会留下：{day.output}</div>
      <p>你会按下面的顺序完成：</p>
      <ol>
        {labels.map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}
      </ol>
      <button className="main-button" type="button" onClick={onReturn}>回到第 {currentDay} 关</button>
    </div>
  );
}

function hasDeferredDay(deferred: BooleanMap, dayNumber: number) {
  return Object.entries(deferred).some(
    ([key, value]) => value && key.startsWith(`${dayNumber}:`),
  );
}

function dayStatus(
  dayNumber: number,
  completed: BooleanMap,
  deferred: BooleanMap,
  firstIncomplete: number,
) {
  if (completed[String(dayNumber)]) return hasDeferredDay(deferred, dayNumber) ? '待补充' : '已完成';
  if (dayNumber === firstIncomplete) return '进行中';
  return dayNumber > firstIncomplete ? '可预览' : '未完成';
}

function DaySidebar({
  currentDay,
  completed,
  deferred,
  firstIncomplete,
  onHome,
  onSelect,
}: {
  currentDay: number;
  completed: BooleanMap;
  deferred: BooleanMap;
  firstIncomplete: number;
  onHome: () => void;
  onSelect: (day: number) => void;
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current?.querySelector('.is-current')?.scrollIntoView({ block: 'center' });
  }, [currentDay]);

  return (
    <aside className="day-sidebar" aria-label="30 关导航">
      <header>
        <button type="button" onClick={onHome}>教你如何把才华变成钱</button>
        <span>{Object.values(completed).filter(Boolean).length} / 30 已推进</span>
      </header>
      <div className="sidebar-progress" aria-hidden="true">
        <span style={{ width: `${(Object.values(completed).filter(Boolean).length / 30) * 100}%` }} />
      </div>
      <nav ref={navRef}>
        {stages.map((stage) => (
          <section className="sidebar-stage" key={stage.id}>
            <h2><span>0{stage.id}</span>{stage.shortName}</h2>
            {days.filter((day) => day.stage === stage.id).map((day) => {
              const status = dayStatus(day.day, completed, deferred, firstIncomplete);
              return (
                <button
                  type="button"
                  key={day.day}
                  className={`${day.day === currentDay ? 'is-current ' : ''}${status === '已完成' ? 'is-complete ' : ''}${status === '待补充' ? 'is-partial' : ''}`}
                  onClick={() => onSelect(day.day)}
                >
                  <span>{String(day.day).padStart(2, '0')}</span>
                  <strong>{day.title}</strong>
                  <small>{status}</small>
                </button>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}

function LevelList({
  open,
  completed,
  deferred,
  firstIncomplete,
  onClose,
  onSelect,
}: {
  open: boolean;
  completed: BooleanMap;
  deferred: BooleanMap;
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
            <p>前面的关卡可以随时回来修改，后面的关卡可以先预览。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭关卡列表">关闭</button>
        </header>
        <div className="level-list">
          {days.map((day) => {
            const status = dayStatus(day.day, completed, deferred, firstIncomplete);
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
