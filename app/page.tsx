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
  next[keyFor(2, 'selectedAudience')] = uniqueLines(next[keyFor(2, 'selectedAudience')] ?? '')
    .slice(0, 1)
    .join('\n');

  const problems = uniqueLines(next[keyFor(3, 'problemCandidates')] ?? '');
  next[keyFor(3, 'topProblems')] = uniqueLines(next[keyFor(3, 'topProblems')] ?? '')
    .filter((item) => problems.includes(item))
    .slice(0, 3)
    .join('\n');

  next[keyFor(4, 'focusProblem')] = uniqueLines(next[keyFor(4, 'focusProblem')] ?? '')
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
  if (day <= 7) return '';
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

function flowStepId(step: FlowStep, index: number) {
  if (step.kind === 'prompt') return step.prompt.id;
  if (step.kind === 'clarity') return 'clarity';
  if (step.kind === 'selection') return step.targetId;
  return `action-${index}`;
}

function stepIsSatisfied(dayNumber: number, step: FlowStep, index: number, answers: AnswerMap) {
  if (step.kind === 'prompt') return hasPromptAnswer(answers[keyFor(dayNumber, step.prompt.id)] ?? '');
  if (step.kind === 'clarity') {
    return clarityQuestions.every((question) => Boolean(answers[keyFor(1, question.id)]));
  }
  if (step.kind === 'selection') {
    const candidates = uniqueLines(answers[keyFor(step.sourceDay, step.sourceId)] ?? '');
    const selected = uniqueLines(answers[keyFor(dayNumber, step.targetId)] ?? '');
    if (dayNumber === 4 && step.targetId === 'focusProblem') return selected.length > 0;
    return selected.some((item) => candidates.includes(item));
  }
  return answers[keyFor(dayNumber, flowStepId(step, index))] === 'done';
}

function reconcileSavedProgress(saved: SavedState) {
  const answers = normalizeAnswers(saved.answers ?? {});
  const completed = { ...(saved.completed ?? {}) };
  const deferred = { ...(saved.deferred ?? {}) };

  days.forEach((day) => {
    if (!completed[String(day.day)]) return;
    const dayFlow = getFlow(day);

    // The previous interface stored a completed reality action as deferred=false.
    // Give that state a durable answer in the single-page worksheet.
    dayFlow.forEach((step, index) => {
      if (step.kind !== 'action') return;
      const id = flowStepId(step, index);
      const key = keyFor(day.day, id);
      if (!answers[key] && Object.prototype.hasOwnProperty.call(deferred, key) && deferred[key] === false) {
        answers[key] = 'done';
      }
    });

    if (day.day === 2) {
      deferred[keyFor(2, 'audienceCandidates')] = false;
      deferred[keyFor(2, 'selectedAudience')] = !Boolean(answers[keyFor(2, 'selectedAudience')]?.trim());
      return;
    }

    dayFlow.forEach((step, index) => {
      const id = flowStepId(step, index);
      deferred[keyFor(day.day, id)] = !stepIsSatisfied(day.day, step, index, answers);
    });
  });

  return { answers, completed, deferred };
}

function shortReason(day: Day) {
  const tailored: Record<number, string> = {
    1: '先保留你真实在用的介绍，再看陌生人能不能听懂。',
    2: '先选一个这一轮最想服务的人，后面的练习才有明确对象。',
    3: '把客户真实会说的问题摊开，才能看出什么最值得解决。',
    4: '把客户和问题合成一句话，让陌生人马上知道这是否与自己有关。',
  };
  if (tailored[day.day]) return tailored[day.day];
  const firstSentence = day.principle.split('。').find((sentence) => sentence.trim());
  return firstSentence ? `${firstSentence}。` : day.principle;
}

export default function Home() {
  const [view, setView] = useState<View>('intro');
  const [currentDay, setCurrentDay] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [completed, setCompleted] = useState<BooleanMap>({});
  const [deferred, setDeferred] = useState<BooleanMap>({});
  const [hydrated, setHydrated] = useState(false);

  const activeDay = days[currentDay - 1];
  const activeStage = stages[activeDay.stage - 1];
  const flow = useMemo(() => getFlow(activeDay), [activeDay]);
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
        const reconciled = reconcileSavedProgress(saved);
        const savedAnswers = reconciled.answers;
        const savedCompleted = reconciled.completed;
        const savedDeferred = reconciled.deferred;
        const nextDay = days.find((day) => !savedCompleted[String(day.day)]);
        const resumeDay = nextDay?.day ?? 30;
        setAnswers(savedAnswers);
        setCompleted(savedCompleted);
        setDeferred(savedDeferred);
        setCurrentDay(resumeDay);
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
      JSON.stringify({ answers, completed, deferred, currentDay }),
    );
  }, [answers, completed, currentDay, deferred, hydrated]);

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
    setLevelsOpen(false);
    setView('day');
    window.scrollTo({ top: 0 });
  };

  const setAnswer = (id: string, value: string) => {
    const previousValue = answers[keyFor(currentDay, id)] ?? '';
    const downstreamStart =
      currentDay === 2 && id === 'selectedAudience' && previousValue.trim() !== value.trim()
        ? 3
        : currentDay === 3 && ['problemCandidates', 'topProblems'].includes(id) && previousValue !== value
          ? 4
          : currentDay === 4 && ['focusProblem', 'valueVersions', 'selectedValue'].includes(id) && previousValue !== value
            ? 5
            : null;
    const dependentSelectionWillBeEmpty =
      (currentDay === 3
        && id === 'problemCandidates'
        && uniqueLines(answers[keyFor(3, 'topProblems')] ?? '')
          .filter((item) => uniqueLines(value).includes(item)).length === 0)
      || (currentDay === 4
        && id === 'valueVersions'
        && uniqueLines(answers[keyFor(4, 'selectedValue')] ?? '')
          .filter((item) => uniqueLines(value).includes(item)).length === 0);

    setAnswers((previous) => {
      const next = { ...previous, [keyFor(currentDay, id)]: value };

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
    if (downstreamStart) {
      setCompleted((previous) => {
        const next = { ...previous };
        for (let day = downstreamStart; day <= 30; day += 1) next[String(day)] = false;
        return next;
      });
      setDeferred((previous) => {
        const next = { ...previous };
        Object.keys(next).forEach((key) => {
          const day = Number(key.split(':')[0]);
          if (day >= downstreamStart) delete next[key];
        });
        return next;
      });
    }
    if (!value.trim() || dependentSelectionWillBeEmpty) {
      setCompleted((previous) => ({ ...previous, [String(currentDay)]: false }));
    }
  };

  const changeClarity = (id: string, value: string) => {
    setAnswer(id, value);
    const nextAnswers = { ...answers, [keyFor(1, id)]: value };
    if (clarityQuestions.every((question) => Boolean(nextAnswers[keyFor(1, question.id)]))) {
      setDeferred((previous) => ({ ...previous, [keyFor(1, 'clarity')]: false }));
    }
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

  const finishCurrentDay = (missingIds: string[]) => {
    const missing = new Set(missingIds);
    setDeferred((previous) => {
      const next = { ...previous };
      flow.forEach((step, index) => {
        const id = flowStepId(step, index);
        next[keyFor(currentDay, id)] = missing.has(id);
      });
      return next;
    });
    setCompleted((previous) => ({ ...previous, [String(currentDay)]: true }));
    if (currentDay === 30 && firstIncomplete < 30) {
      setCurrentDay(firstIncomplete);
      setPreviewMode(false);
      setView('day');
    } else if (currentDay < 30) {
      const nextDay = currentDay > firstIncomplete ? firstIncomplete : currentDay + 1;
      setCurrentDay(nextDay);
      setPreviewMode(false);
      setView('day');
    } else {
      setView('overview');
    }
    window.scrollTo({ top: 0 });
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
          <div className="day-sheet">
          <section className="day-orientation">
            <div className="day-kicker-row">
              <span>第 {activeStage.id} 周 · {activeStage.title}</span>
              {activeDayIsPartial && <strong>待补充</strong>}
            </div>
            <h1>{activeDay.title}</h1>
            <div className="day-orientation-copy">
              <p>{shortReason(activeDay)}</p>
              <strong>完成后：{activeDay.output}</strong>
            </div>
          </section>

          <section className="day-content">
            {previewMode ? (
              <PreviewDay day={activeDay} flow={flow} currentDay={firstIncomplete} onReturn={() => navigateToDay(firstIncomplete)} />
            ) : currentDay === 1 ? (
              <DayOneSinglePage
                intro={answers[keyFor(1, 'currentIntro')] ?? ''}
                answers={answers}
                onIntroChange={(value) => setAnswer('currentIntro', value)}
                onClarityChange={changeClarity}
                onSubmit={() => {
                  const missing: string[] = [];
                  if (!answers[keyFor(1, 'currentIntro')]?.trim()) missing.push('currentIntro');
                  if (!clarityQuestions.every((question) => answers[keyFor(1, question.id)])) missing.push('clarity');
                  finishCurrentDay(missing);
                }}
              />
            ) : currentDay === 2 ? (
              <DayTwoSinglePage
                selectedAudience={answers[keyFor(2, 'selectedAudience')] ?? ''}
                candidates={answers[keyFor(2, 'audienceCandidates')] ?? ''}
                previousIntro={answers[keyFor(1, 'currentIntro')] ?? ''}
                onAudienceChange={(value) => setAnswer('selectedAudience', value)}
                onCandidatesChange={(value) => setAnswer('audienceCandidates', value)}
                onSubmit={() => {
                  const selected = answers[keyFor(2, 'selectedAudience')]?.trim() ?? '';
                  finishCurrentDay(selected ? [] : ['selectedAudience']);
                }}
              />
            ) : currentDay === 4 ? (
              <DayFourSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            ) : currentDay === 6 ? (
              <DaySixSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            ) : currentDay === 7 ? (
              <DaySevenSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            ) : (
              <DayWorksheet
                day={activeDay}
                flow={flow}
                answers={answers}
                onAnswer={setAnswer}
                onToggleSelection={toggleSelection}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            )}
          </section>
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

function DayOneSinglePage({
  intro,
  answers,
  onIntroChange,
  onClarityChange,
  onSubmit,
}: {
  intro: string;
  answers: AnswerMap;
  onIntroChange: (value: string) => void;
  onClarityChange: (id: string, value: string) => void;
  onSubmit: () => void;
}) {
  const judgmentsReady = clarityQuestions.every((question) => answers[keyFor(1, question.id)]);
  const partial = !intro.trim() || !judgmentsReady;
  return (
    <div className="single-day-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>你平时是怎样介绍自己的？</h2>
          <p>把你平时真实会说的版本写下来，不需要先优化。</p>
          <label className="sr-only" htmlFor="day-one-intro">你平时的自我介绍</label>
          <textarea
            id="day-one-intro"
            value={intro}
            placeholder="例如：我以前做产品，现在做咨询，也会写一些关于个人成长和商业的内容。"
            onChange={(event) => onIntroChange(event.target.value)}
          />
        </div>
      </section>

      <section className="single-task-block clarity-block">
        <span className="task-number">02</span>
        <div>
          <h2>请站在一个路人的角度看一下</h2>
          <p>只看这段介绍，不替自己补充。需要猜或需要追问，就选“不清楚”。</p>
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
                        onClick={() => onClarityChange(question.id, option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>
      </section>

      <div className="single-day-submit">
        <p>{partial ? '没填完也可以继续；未完成的部分会标记为待补充。' : '这一关已经填写完整。'}</p>
        <button className="main-button" type="button" onClick={onSubmit}>
          {partial ? '先保存，进入第 2 关 →' : '完成本关，进入第 2 关 →'}
        </button>
      </div>
    </div>
  );
}

function DayTwoSinglePage({
  selectedAudience,
  candidates,
  previousIntro,
  onAudienceChange,
  onCandidatesChange,
  onSubmit,
}: {
  selectedAudience: string;
  candidates: string;
  previousIntro: string;
  onAudienceChange: (value: string) => void;
  onCandidatesChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const candidateItems = uniqueLines(candidates);
  const hasDirection = Boolean(selectedAudience.trim());
  return (
    <div className="single-day-form day-two-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>这一轮，你最想服务谁？</h2>
          <p>不用一次确定终身定位。先写一个你真实接触过、问题正在发生、你也能帮到的人。</p>
          <label className="sr-only" htmlFor="day-two-audience">这一轮想服务的人</label>
          <input
            id="day-two-audience"
            type="text"
            value={selectedAudience}
            placeholder="例如：准备从公司转向自由职业、正在寻找第一批客户的人"
            onChange={(event) => onAudienceChange(event.target.value)}
          />

          <details className="worksheet-help">
            <summary>还拿不准？先列几个候选</summary>
            <p>每行写一类人。先写 5 个，有余力可以写到 10 个；写好后点一下其中一项，把它设为本轮对象。</p>
            <textarea
              value={candidates}
              placeholder="准备从公司转向自由职业的人\n已经开始提供咨询的独立顾问"
              onChange={(event) => onCandidatesChange(event.target.value)}
            />
            {candidateItems.length > 0 && (
              <div className="candidate-chips">
                {candidateItems.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={selectedAudience.trim() === item ? 'is-selected' : ''}
                    aria-pressed={selectedAudience.trim() === item}
                    onClick={() => onAudienceChange(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </details>

          <details className="worksheet-help">
            <summary>完全想不到？</summary>
            <p>最近一次主动找你帮忙的人是谁？他当时处在什么情况？先把这个人写下来。</p>
          </details>

          {previousIntro && (
            <details className="worksheet-help">
              <summary>查看我第 1 关的自我介绍</summary>
              <p className="saved-answer">{previousIntro}</p>
            </details>
          )}
        </div>
      </section>

      <div className="single-day-submit">
        <p>{hasDirection ? '之后的练习会先围绕这类人展开，随时可以回来修改。' : '暂时不确定也可以继续，这一关会标记为待补充。'}</p>
        <button className="main-button" type="button" onClick={onSubmit}>
          {hasDirection ? '就先服务这类人，进入第 3 关 →' : '暂时不确定，进入第 3 关 →'}
        </button>
      </div>
    </div>
  );
}

function DayFourSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const previousAudience = answers[keyFor(2, 'selectedAudience')] ?? '';
  const audience = answers[keyFor(4, 'valueAudience')] ?? previousAudience;
  const previousProblems = uniqueLines(answers[keyFor(3, 'topProblems')] ?? '');
  const focusProblem = answers[keyFor(4, 'focusProblem')] ?? '';
  const outcome = answers[keyFor(4, 'valueOutcome')] ?? '';
  const versions = uniqueLines(answers[keyFor(4, 'valueVersions')] ?? '');
  const selectedValue = answers[keyFor(4, 'selectedValue')] ?? '';
  const generatedSentence = audience.trim() && focusProblem.trim() && outcome.trim()
    ? `我帮${audience.trim()}，解决“${focusProblem.trim()}”的问题，让他能${outcome.trim()}。`
    : '';
  const missingIds = [
    !focusProblem.trim() ? 'focusProblem' : '',
    !versions.length ? 'valueVersions' : '',
    !selectedValue.trim() || !versions.includes(selectedValue.trim()) ? 'selectedValue' : '',
  ].filter(Boolean);

  const addGeneratedSentence = () => {
    if (!generatedSentence) return;
    onAnswer('valueVersions', uniqueLines([...versions, generatedSentence].join('\n')).join('\n'));
  };

  return (
    <div className="single-day-form day-four-form">
      <section className="context-panel" aria-label="前面已经确定的方向">
        <div>
          <span>本轮想服务的人</span>
          <strong>{previousAudience || '第 2 关暂未填写'}</strong>
        </div>
        <div>
          <span>他们正在遇到的问题</span>
          <strong>{previousProblems.length ? previousProblems.join(' · ') : '第 3 关暂未选择，下面可以直接写'}</strong>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>这句话先回应哪个问题？</h2>
          <p>可以点选前一关的结果，也可以直接写一个更合适的问题。</p>
          {previousProblems.length > 0 && (
            <div className="candidate-chips visible-candidates">
              {previousProblems.map((problem) => (
                <button
                  type="button"
                  key={problem}
                  className={focusProblem.trim() === problem ? 'is-selected' : ''}
                  aria-pressed={focusProblem.trim() === problem}
                  onClick={() => onAnswer('focusProblem', problem)}
                >
                  {problem}
                </button>
              ))}
            </div>
          )}
          <label htmlFor="day-four-problem">当前要回应的问题</label>
          <input
            id="day-four-problem"
            type="text"
            value={focusProblem}
            placeholder="例如：客户看完介绍，还是不知道我具体能做什么"
            onChange={(event) => onAnswer('focusProblem', event.target.value)}
          />
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>把客户、问题和结果合成一句话</h2>
          <div className="formula-panel">
            <strong>句式：我帮【谁】，解决【什么问题】，让他能【得到什么结果】。</strong>
            <p>例如：我帮已经开始做咨询、但说不清服务价值的独立顾问，解决客户看完介绍仍不知道他能提供什么的问题，让他能写出一段客户看得懂、愿意继续了解的服务说明。</p>
          </div>
          <div className="formula-fields">
            <label>
              <span>我帮谁</span>
              <input
                type="text"
                value={audience}
                placeholder="例如：说不清服务价值的独立顾问"
                onChange={(event) => onAnswer('valueAudience', event.target.value)}
              />
            </label>
            <div className="formula-readonly">
              <span>他卡在什么问题</span>
              <strong>{focusProblem || '请先完成上一步'}</strong>
            </div>
            <label>
              <span>你希望他最后能做到什么</span>
              <input
                type="text"
                value={outcome}
                placeholder="例如：写出一段客户看得懂的服务说明"
                onChange={(event) => onAnswer('valueOutcome', event.target.value)}
              />
            </label>
          </div>
          <div className="generated-sentence">
            <span>工具拼出的句子</span>
            <p>{generatedSentence || '上面三项填完后，这里会出现一句完整介绍。'}</p>
            <button className="secondary-button" type="button" disabled={!generatedSentence} onClick={addGeneratedSentence}>
              把这句加入候选
            </button>
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">03</span>
        <div>
          <h2>围绕同一个问题，再写几种说法</h2>
          <p>每行一句。先写 5 个，有余力可以写到 10 个；只有 1 个也可以继续。</p>
          <textarea
            value={answers[keyFor(4, 'valueVersions')] ?? ''}
            placeholder="每行写一个完整说法"
            onChange={(event) => onAnswer('valueVersions', event.target.value)}
          />
          <p className="worksheet-count">已写 {versions.length} 个 · 建议 5–10 个，不影响继续</p>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">04</span>
        <div>
          <h2>选出一个别人听一遍就能复述的版本</h2>
          <p>优先选择客户、问题和结果都具体，没有内部术语，而且可以一口气说完的一句。</p>
          {versions.length ? (
            <div className="selection-list worksheet-selection">
              {versions.map((version, index) => (
                <button
                  type="button"
                  key={`${version}-${index}`}
                  className={selectedValue.trim() === version ? 'selection-item selected' : 'selection-item'}
                  aria-pressed={selectedValue.trim() === version}
                  onClick={() => onAnswer('selectedValue', version)}
                >
                  <span>{index + 1}</span>
                  <strong>{version}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-inline">先把上面拼出的句子加入候选，或直接写一个版本。</p>
          )}
        </div>
      </section>

      <div className="single-day-submit">
        <p>{missingIds.length ? `还有 ${missingIds.length} 项未确定，会标记为待补充。` : '这一关已经填写完整。'}</p>
        <button className="main-button" type="button" onClick={() => onSubmit(missingIds)}>
          {missingIds.length ? '先保存，进入第 5 关 →' : '完成本关，进入第 5 关 →'}
        </button>
      </div>
    </div>
  );
}

function DaySixSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const earlierProblems = uniqueLines(answers[keyFor(3, 'topProblems')] ?? '');
  const valueLine = answers[keyFor(6, 'statementValue')]
    ?? answers[keyFor(4, 'selectedValue')]
    ?? answers[keyFor(6, 'firstStatement')]
    ?? '';
  const fitAudience = answers[keyFor(6, 'statementFit')]
    ?? answers[keyFor(2, 'selectedAudience')]
    ?? '';
  const problemValues = [0, 1, 2].map((index) => (
    answers[keyFor(6, `statementProblem${index + 1}`)] ?? earlierProblems[index] ?? ''
  ));
  const evidence = answers[keyFor(6, 'statementEvidence')]
    ?? answers[keyFor(5, 'evidenceSentence')]
    ?? '';
  const filledProblems = problemValues.map((item) => item.trim()).filter(Boolean);
  const assembled = [
    valueLine.trim(),
    fitAudience.trim() ? `这项服务适合${fitAudience.trim()}。` : '',
    filledProblems.length ? `他们常遇到的问题是：${filledProblems.join('；')}。` : '',
    evidence.trim() ? `我能推进这件事，是因为${evidence.trim()}。` : '',
  ].filter(Boolean).join('\n');
  const complete = Boolean(valueLine.trim() && fitAudience.trim() && filledProblems.length && evidence.trim());

  const saveAndContinue = () => {
    onAnswer('statementValue', valueLine);
    onAnswer('statementFit', fitAudience);
    problemValues.forEach((problem, index) => onAnswer(`statementProblem${index + 1}`, problem));
    onAnswer('statementEvidence', evidence);
    onAnswer('firstStatement', assembled);
    onSubmit(complete ? [] : ['firstStatement']);
  };

  return (
    <div className="single-day-form day-six-form">
      <section className="assembly-intro">
        <strong>这一关不是让你重新想一遍。</strong>
        <p>前 5 关的答案已经带进来。你只需分别检查四部分，工具会在底部自动拼成一段可以发给别人测试的说明。</p>
      </section>

      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>我帮谁、解决什么，让他能做到什么</h2>
          <p>这是第 4 关选中的服务介绍。可以直接修改，不需要重新填空。</p>
          <textarea
            value={valueLine}
            placeholder="我帮……，解决……，让他能……"
            onChange={(event) => onAnswer('statementValue', event.target.value)}
          />
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>这项服务具体适合谁？</h2>
          <p>“我帮谁”是人群名称；“适合谁”要进一步说清他正处在什么情况，让读者能判断自己是否符合。</p>
          <textarea
            value={fitAudience}
            placeholder="例如：已经有服务经验和案例，但陌生客户仍看不懂他与同行有什么不同的独立顾问"
            onChange={(event) => onAnswer('statementFit', event.target.value)}
          />
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">03</span>
        <div>
          <h2>这类客户常带着哪些具体问题来找你？</h2>
          <p>这不是产品 FAQ，而是客户真的可能说出口的困扰。第 3 关选中的问题已经带进来；只有 1 个也可以继续。</p>
          <div className="problem-field-list">
            {problemValues.map((problem, index) => (
              <label key={`statement-problem-${index + 1}`}>
                <span>常见问题 {index + 1}</span>
                <input
                  type="text"
                  value={problem}
                  placeholder={index === 0 ? '例如：客户看完介绍，还是会问“所以你具体做什么？”' : '没有可以先留空'}
                  onChange={(event) => onAnswer(`statementProblem${index + 1}`, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">04</span>
        <div>
          <h2>为什么是你？</h2>
          <p>这里不写“我很专业”，而是放入第 5 关的事实证据：你做过什么，证明你有能力推进这个问题。</p>
          <textarea
            value={evidence}
            placeholder="例如：我已经为 3 位独立顾问重新整理过服务说明，并保留了修改前后的真实版本"
            onChange={(event) => onAnswer('statementEvidence', event.target.value)}
          />
        </div>
      </section>

      <section className="assembly-preview">
        <div>
          <span>工具为你拼出的测试稿</span>
          <strong>{assembled.length} 字 · 200 字只是精简建议，不影响继续</strong>
        </div>
        <p>{assembled || '上面的答案会在这里自动拼成一段完整说明。'}</p>
      </section>

      <div className="single-day-submit">
        <p>{complete ? '四部分都已齐全，可以拿去测试。' : '没填完也可以继续；缺少的部分会标记为待补充。'}</p>
        <button className="main-button" type="button" onClick={saveAndContinue}>
          {complete ? '保存测试稿，进入第 7 关 →' : '先保存，进入第 7 关 →'}
        </button>
      </div>
    </div>
  );
}

function DaySevenSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const [copied, setCopied] = useState(false);
  const testStatement = answers[keyFor(6, 'firstStatement')] ?? '';
  const legacyTesterNames = uniqueLines(answers[keyFor(7, 'testers')] ?? '');
  const testers = Array.from({ length: 5 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      name: answers[keyFor(7, `tester-${number}-name`)] ?? legacyTesterNames[index] ?? '',
      who: answers[keyFor(7, `tester-${number}-who`)] ?? '',
      problem: answers[keyFor(7, `tester-${number}-problem`)] ?? '',
      timing: answers[keyFor(7, `tester-${number}-timing`)] ?? '',
    };
  });
  const sent = answers[keyFor(7, 'action-1')] === 'done';
  const namedCount = testers.filter((tester) => tester.name.trim()).length;
  const feedbackCount = testers.filter((tester) => (
    tester.who.trim() && tester.problem.trim() && tester.timing.trim()
  )).length;
  const feedbackGap = answers[keyFor(7, 'feedbackGap')] ?? '';
  const revisedStatement = answers[keyFor(7, 'revisedStatement')] ?? testStatement;
  const testMessage = `想请你帮我测试一段介绍是否清楚。请只根据下面的文字回答，不用帮我润色，也不用猜我的本意。\n\n${testStatement || '【第 6 关还没有服务说明】'}\n\n1. 你觉得我主要在帮谁？\n2. 你觉得我主要解决什么问题？\n3. 什么情况下你会想到找我？`;

  const copyTestMessage = async () => {
    if (!testStatement) return;
    try {
      await navigator.clipboard.writeText(testMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const saveAndContinue = () => {
    const testerNames = testers.map((tester) => tester.name.trim()).filter(Boolean).join('\n');
    const feedback = testers
      .filter((tester) => tester.name.trim() || tester.who.trim() || tester.problem.trim() || tester.timing.trim())
      .map((tester) => [
        `${tester.name.trim() || `测试者 ${tester.number}`}：`,
        `他认为我在帮谁：${tester.who.trim() || '未记录'}`,
        `他认为我解决什么：${tester.problem.trim() || '未记录'}`,
        `什么情况会想到我：${tester.timing.trim() || '未记录'}`,
      ].join('\n'))
      .join('\n\n');
    onAnswer('testers', testerNames);
    onAnswer('retellFeedback', feedback);
    onAnswer('revisedStatement', revisedStatement);
    const missingIds = [
      namedCount < 5 ? 'testers' : '',
      !sent ? 'action-1' : '',
      feedbackCount < 5 ? 'retellFeedback' : '',
      !revisedStatement.trim() ? 'revisedStatement' : '',
    ].filter(Boolean);
    onSubmit(missingIds);
  };

  const feedbackColumns = [
    { title: '他们认为你在帮谁', field: 'who' as const },
    { title: '他们认为你解决什么', field: 'problem' as const },
    { title: '什么情况会想到你', field: 'timing' as const },
  ];

  return (
    <div className="single-day-form day-seven-form">
      <section className="test-message-panel">
        <div className="test-message-heading">
          <div>
            <span>你要测试的第 6 关说明</span>
            <strong>{testStatement ? '请把同一段文字发给所有人' : '第 6 关暂时没有可用的测试稿'}</strong>
          </div>
        </div>
        <p className="test-statement">{testStatement || '请先回到第 6 关生成一段服务说明；也可以继续浏览这一关的流程。'}</p>
      </section>

      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>把这段测试消息发给 5 个人</h2>
          <p>不要问“你觉得写得怎么样”。请对方只根据文字回答三个固定问题，发送后不补充背景、不解释本意。</p>
          <div className="copy-message">
            <p>{testMessage}</p>
            <button className="secondary-button" type="button" disabled={!testStatement} onClick={copyTestMessage}>
              {copied ? '✓ 已复制' : '复制整段测试消息'}
            </button>
          </div>
          <button
            className={sent ? 'action-toggle is-done' : 'action-toggle'}
            type="button"
            aria-pressed={sent}
            onClick={() => onAnswer('action-1', sent ? '' : 'done')}
          >
            {sent ? '✓ 已经发给至少 1 个人' : '我已经发给至少 1 个人'}
          </button>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>分别记下 5 个人的第一反应</h2>
          <p>只记原话，不总结、不润色。对方说“没看出来”或“想不到”，也请原样记下。收到 1 份就能开始，目标是 5 份。</p>
          <div className="tester-list">
            {testers.map((tester) => {
              const hasFeedback = Boolean(tester.who.trim() || tester.problem.trim() || tester.timing.trim());
              const status = !tester.name.trim() ? '未添加' : hasFeedback ? '已记录' : '等回复';
              return (
                <details className="tester-card" key={tester.number}>
                  <summary>
                    <strong>测试者 {tester.number}{tester.name.trim() ? ` · ${tester.name.trim()}` : ''}</strong>
                    <span>{status}</span>
                  </summary>
                  <div className="tester-fields">
                    <label>
                      <span>别名 / 你们的关系</span>
                      <input
                        type="text"
                        value={tester.name}
                        placeholder="例如：A / 前同事"
                        onChange={(event) => onAnswer(`tester-${tester.number}-name`, event.target.value)}
                      />
                    </label>
                    <label>
                      <span>他觉得你主要在帮谁？</span>
                      <textarea
                        value={tester.who}
                        placeholder="粘贴对方原话；没说出来就写“没看出来”"
                        onChange={(event) => onAnswer(`tester-${tester.number}-who`, event.target.value)}
                      />
                    </label>
                    <label>
                      <span>他觉得你主要解决什么问题？</span>
                      <textarea
                        value={tester.problem}
                        placeholder="粘贴对方原话"
                        onChange={(event) => onAnswer(`tester-${tester.number}-problem`, event.target.value)}
                      />
                    </label>
                    <label>
                      <span>什么情况下他会想到找你？</span>
                      <textarea
                        value={tester.timing}
                        placeholder="粘贴对方原话；想不到就写“想不到具体情况”"
                        onChange={(event) => onAnswer(`tester-${tester.number}-timing`, event.target.value)}
                      />
                    </label>
                  </div>
                </details>
              );
            })}
          </div>
          <p className="worksheet-count">已添加 {namedCount} / 5 人 · 已完整记录 {feedbackCount} / 5 份回复</p>
        </div>
      </section>

      {feedbackCount > 0 && (
        <section className="single-task-block">
          <span className="task-number">03</span>
          <div>
            <h2>把不同人的回答放在一起，看哪里传偏了</h2>
            <p>这里不评分、不算百分比，只把三个问题的原话重新归组，帮你看出反复出现的误解。</p>
            <div className="feedback-columns">
              {feedbackColumns.map((column) => (
                <div key={column.field}>
                  <strong>{column.title}</strong>
                  <ul>
                    {testers.filter((tester) => tester[column.field].trim()).map((tester) => (
                      <li key={`${column.field}-${tester.number}`}><span>{tester.name || `测试者 ${tester.number}`}</span>{tester[column.field]}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <label htmlFor="feedback-gap">哪些复述和你原本想表达的意思不一样？</label>
            <textarea
              id="feedback-gap"
              value={feedbackGap}
              placeholder="例如：他们把我理解成“教人写文案”，但我真正想服务的是“做咨询却说不清价值的人”"
              onChange={(event) => onAnswer('feedbackGap', event.target.value)}
            />
          </div>
        </section>
      )}

      <section className="single-task-block">
        <span className="task-number">{feedbackCount > 0 ? '04' : '03'}</span>
        <div>
          <h2>只修改反复被误解的地方</h2>
          <p>保留大家已经能复述的部分，只修改连续被漏掉或听偏的内容；不需要把整段推翻重写。</p>
          <textarea
            value={revisedStatement}
            placeholder="第 6 关的测试稿会自动带入这里"
            onChange={(event) => onAnswer('revisedStatement', event.target.value)}
          />
        </div>
      </section>

      <div className="single-day-submit">
        <p>{feedbackCount < 5 ? '没收满 5 份也能继续，这一关会标记为待补充。' : '已收齐 5 份复述，可以保存修订版。'}</p>
        <button className="main-button" type="button" onClick={saveAndContinue}>
          {feedbackCount < 5 ? '先保存，进入第 8 关 →' : '保存修订版，进入第 8 关 →'}
        </button>
      </div>
    </div>
  );
}

function DayWorksheet({
  day,
  flow,
  answers,
  onAnswer,
  onToggleSelection,
  onSubmit,
}: {
  day: Day;
  flow: FlowStep[];
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onToggleSelection: (step: SelectionStep, item: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const missingIds = flow.flatMap((step, index) => {
    const id = flowStepId(step, index);
    return stepIsSatisfied(day.day, step, index, answers) ? [] : [id];
  });
  const carried = day.day === 3 ? answers[keyFor(2, 'selectedAudience')] ?? '' : '';

  return (
    <div className="single-day-form worksheet-form">
      {carried && (
        <details className="worksheet-help carried-answer">
          <summary>查看前面已经确定的方向</summary>
          <p className="saved-answer">{carried}</p>
        </details>
      )}

      {flow.map((step, index) => {
        const number = String(index + 1).padStart(2, '0');
        if (step.kind === 'prompt') {
          const value = answers[keyFor(day.day, step.prompt.id)] ?? '';
          const example = promptExample(day.day, step.prompt);
          const lineCount = uniqueLines(value).length;
          return (
            <section className="single-task-block" key={`${step.prompt.id}-${index}`}>
              <span className="task-number">{number}</span>
              <div>
                <h2>{step.prompt.label}</h2>
                {step.prompt.helper && <p>{step.prompt.helper}</p>}
                <label className="sr-only" htmlFor={`worksheet-${day.day}-${step.prompt.id}`}>{step.prompt.label}</label>
                {step.prompt.mode === 'text' ? (
                  <input
                    id={`worksheet-${day.day}-${step.prompt.id}`}
                    type="text"
                    value={value}
                    placeholder={step.prompt.placeholder}
                    onChange={(event) => onAnswer(step.prompt.id, event.target.value)}
                  />
                ) : (
                  <textarea
                    id={`worksheet-${day.day}-${step.prompt.id}`}
                    value={value}
                    placeholder={step.prompt.placeholder}
                    onChange={(event) => onAnswer(step.prompt.id, event.target.value)}
                  />
                )}
                {step.prompt.targetCount && (
                  <p className="worksheet-count">
                    {day.day <= 7 && step.prompt.targetCount === 5
                      ? `已写 ${lineCount} 条 · 先写 5 条，有余力可以写到 10 条，不影响继续`
                      : `已写 ${lineCount} 条 · 建议目标 ${step.prompt.targetCount} 条，不影响继续`}
                  </p>
                )}
                {(example || stuckHelp(day.day, step.prompt).length > 0) && (
                  <details className="worksheet-help">
                    <summary>{example ? '查看完整例子和写作提示' : '写不出来？'}</summary>
                    {example && <p className="saved-answer">例如：{example}</p>}
                    <ul>{stuckHelp(day.day, step.prompt).map((item) => <li key={item}>{item}</li>)}</ul>
                  </details>
                )}
              </div>
            </section>
          );
        }

        if (step.kind === 'selection') {
          const candidates = uniqueLines(answers[keyFor(step.sourceDay, step.sourceId)] ?? '');
          const selected = uniqueLines(answers[keyFor(day.day, step.targetId)] ?? '');
          return (
            <section className="single-task-block" key={`${step.targetId}-${index}`}>
              <span className="task-number">{number}</span>
              <div>
                <h2>{step.title}</h2>
                {step.helper && <p>{step.helper}</p>}
                {step.max > 1 && <p className="worksheet-count">最多选 {step.max} 个，先选 1 个也可以。</p>}
                {candidates.length ? (
                  <div className="selection-list worksheet-selection">
                    {candidates.map((item, itemIndex) => (
                      <button
                        type="button"
                        key={`${item}-${itemIndex}`}
                        className={selected.includes(item) ? 'selection-item selected' : 'selection-item'}
                        aria-pressed={selected.includes(item)}
                        onClick={() => onToggleSelection(step, item)}
                      >
                        <span>{itemIndex + 1}</span>
                        <strong>{item}</strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-inline">上面的素材还没有内容。可以先填写，也可以把这一项留作待补充。</p>
                )}
              </div>
            </section>
          );
        }

        if (step.kind === 'action') {
          const id = flowStepId(step, index);
          const done = answers[keyFor(day.day, id)] === 'done';
          return (
            <section className="single-task-block" key={id}>
              <span className="task-number">{number}</span>
              <div>
                <h2>在网页之外完成这件事</h2>
                <p>{step.text}</p>
                <button
                  className={done ? 'action-toggle is-done' : 'action-toggle'}
                  type="button"
                  aria-pressed={done}
                  onClick={() => onAnswer(id, done ? '' : 'done')}
                >
                  {done ? '✓ 已完成' : '标记为已完成'}
                </button>
              </div>
            </section>
          );
        }

        return null;
      })}

      <div className="single-day-submit">
        <p>{missingIds.length ? `还有 ${missingIds.length} 项未填写，会标记为待补充。` : '这一关已经填写完整。'}</p>
        <button className="main-button" type="button" onClick={() => onSubmit(missingIds)}>
          {day.day < 30
            ? missingIds.length ? `先保存，进入第 ${day.day + 1} 关 →` : `完成本关，进入第 ${day.day + 1} 关 →`
            : '保存第 30 关，回到总览 →'}
        </button>
      </div>
    </div>
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
