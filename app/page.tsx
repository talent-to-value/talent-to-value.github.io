'use client';

import { useEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react';
import { days, stages, type Day, type Prompt } from './curriculum';

type View = 'intro' | 'overview' | 'day' | 'week-checklist' | 'week-complete' | 'week-two-checklist' | 'week-two-complete';
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

type WeekOneChecklistItem = {
  id: 'introduction' | 'audience' | 'problems' | 'evidence';
  label: string;
  value: string;
};

type WeekTwoChecklistItem = {
  label: string;
  value: string;
};

type WorkEvidence = {
  id: string;
  title: string;
  problem: string;
  proof: string;
  discarded: boolean;
};

type ResultEvidenceMap = Record<string, string>;

type FeedbackRecord = {
  id: string;
  workId: string;
  feedback: string;
};

type CognitionRecord = {
  id: string;
  workId: string;
  story: string;
};

type RepresentativeWork = {
  workId: string;
  what: string;
  problem: string;
  proof: string;
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

function parseWorkEvidence(value: string, legacyValue = ''): WorkEvidence[] {
  if (value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item, index) => {
          if (!item || typeof item !== 'object') return [];
          const candidate = item as Partial<WorkEvidence>;
          return [{
            id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `work-${index + 1}`,
            title: typeof candidate.title === 'string' ? candidate.title : '',
            problem: typeof candidate.problem === 'string' ? candidate.problem : '',
            proof: typeof candidate.proof === 'string' ? candidate.proof : '',
            discarded: Boolean(candidate.discarded),
          }];
        });
      }
    } catch {
      // Fall through to the legacy newline format.
    }
  }

  return uniqueLines(legacyValue).map((title, index) => ({
    id: `work-${index + 1}`,
    title,
    problem: '',
    proof: '',
    discarded: false,
  }));
}

function nextWorkId(works: WorkEvidence[]) {
  let index = works.length + 1;
  while (works.some((work) => work.id === `work-${index}`)) index += 1;
  return `work-${index}`;
}

function parseResultEvidence(value: string, works: WorkEvidence[]): ResultEvidenceMap {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>)
          .filter(([, result]) => typeof result === 'string'),
      ) as ResultEvidenceMap;
    }
  } catch {
    // Preserve a result written in the previous single-textarea interface.
  }
  return works[0] ? { [works[0].id]: value } : {};
}

function parseFeedbackRecords(value: string, works: WorkEvidence[]): FeedbackRecord[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const candidate = item as Partial<FeedbackRecord>;
        return [{
          id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `feedback-${index + 1}`,
          workId: typeof candidate.workId === 'string' ? candidate.workId : '',
          feedback: typeof candidate.feedback === 'string' ? candidate.feedback : '',
        }];
      });
    }
  } catch {
    // Preserve feedback written in the previous single-textarea interface.
  }
  return [{ id: 'feedback-1', workId: works[0]?.id ?? '', feedback: value }];
}

function parseCognitionRecords(value: string, works: WorkEvidence[]): CognitionRecord[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const candidate = item as Partial<CognitionRecord>;
        return [{
          id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `cognition-${index + 1}`,
          workId: typeof candidate.workId === 'string' ? candidate.workId : '',
          story: typeof candidate.story === 'string' ? candidate.story : '',
        }];
      });
    }
  } catch {
    // Preserve stories written in the previous single-textarea interface.
  }
  return [{ id: 'cognition-1', workId: works[0]?.id ?? '', story: value }];
}

function parseRepresentativeWorks(value: string, works: WorkEvidence[]): RepresentativeWork[] {
  if (value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const candidate = item as Partial<RepresentativeWork>;
          const source = works.find((work) => work.id === candidate.workId);
          if (!source) return [];
          return [{
            workId: source.id,
            what: typeof candidate.what === 'string' && candidate.what.trim() ? candidate.what : source.title,
            problem: typeof candidate.problem === 'string' && candidate.problem.trim() ? candidate.problem : source.problem,
            proof: typeof candidate.proof === 'string' && candidate.proof.trim() ? candidate.proof : source.proof,
          }];
        }).slice(0, 3);
      }
    } catch {
      // Preserve selections written in the previous free-text interface.
    }
  }

  return uniqueLines(value).flatMap((line) => {
    const source = works.find((work) => line.includes(work.title));
    return source ? [{
      workId: source.id,
      what: source.title,
      problem: source.problem,
      proof: source.proof,
    }] : [];
  }).slice(0, 3);
}

function nextRecordId(prefix: string, records: Array<{ id: string }>) {
  let index = records.length + 1;
  while (records.some((record) => record.id === `${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function AutoGrowTextarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(element.scrollHeight, 74)}px`;
  };

  useEffect(resize, [props.value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={2}
      className={`auto-grow-textarea ${className}`.trim()}
      onInput={(event) => {
        resize();
        props.onInput?.(event);
      }}
    />
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
    return [{ kind: 'prompt', prompt: day.prompts[1] }];
  }

  if (day.day === 3) {
    return [
      { kind: 'prompt', prompt: day.prompts[0] },
      {
        kind: 'selection',
        title: '选出用户最痛的、你能解决的',
        helper: '从列出的卡点中选择 1–3 个。',
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
        title: '选择他们正在遇到的问题',
        sourceDay: 3,
        sourceId: 'topProblems',
        targetId: 'focusProblem',
        max: 1,
      },
      { kind: 'prompt', prompt: day.prompts[1] },
      {
        kind: 'selection',
        title: '在候选池中选择最终版',
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

    if (day.day === 12 || day.day === 14) {
      Object.keys(deferred).forEach((key) => {
        if (key.startsWith(`${day.day}:`)) deferred[key] = false;
      });
      return;
    }

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
  const firstSentence = day.principle.split('。').find((sentence) => sentence.trim());
  return firstSentence ? `${firstSentence}。` : day.principle;
}

function firstFilled(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? '';
}

function WeekOneChecklistPage({
  items,
  onSave,
}: {
  items: WeekOneChecklistItem[];
  onSave: (drafts: Record<WeekOneChecklistItem['id'], string>) => void;
}) {
  const [editingId, setEditingId] = useState<WeekOneChecklistItem['id'] | null>(null);
  const [drafts, setDrafts] = useState<Record<WeekOneChecklistItem['id'], string>>(() => (
    Object.fromEntries(items.map((item) => [item.id, item.value])) as Record<WeekOneChecklistItem['id'], string>
  ));

  return (
    <main className="week-transition-page week-checklist-page">
      <section className="week-checklist-card">
        <header className="week-checklist-heading">
          <span>WEEK 01 · CHECKLIST</span>
          <h1>第一周结束，请检查下方内容是否 ready：</h1>
          <p>这些内容会成为第二周整理证据、故事和代表作品的起点。需要调整时，可以直接在这里编辑。</p>
        </header>
        <div className="week-checklist-list">
          {items.map((item, index) => {
            const value = drafts[item.id] ?? '';
            const editing = editingId === item.id;
            return (
              <article className={value.trim() ? 'is-ready' : 'is-missing'} key={item.id}>
                <div className="week-checklist-label">
                  <span>0{index + 1}</span>
                  <div>
                    <h2>{item.label}：</h2>
                    <small>{value.trim() ? 'READY' : '待补充'}</small>
                  </div>
                  <button
                    className="checklist-edit-button"
                    type="button"
                    onClick={() => setEditingId(editing ? null : item.id)}
                  >
                    {editing ? '完成编辑' : '编辑'}
                  </button>
                </div>
                {editing ? (
                  <AutoGrowTextarea
                    className="week-checklist-editor"
                    value={value}
                    aria-label={`编辑${item.label}`}
                    autoFocus
                    placeholder="请填写这一项"
                    onChange={(event) => setDrafts((previous) => ({
                      ...previous,
                      [item.id]: event.target.value,
                    }))}
                  />
                ) : (
                  <p>{value || '这一项还没有内容，点击“编辑”即可在这里补充。'}</p>
                )}
              </article>
            );
          })}
        </div>
        <footer className="week-checklist-actions">
          <button className="main-button" type="button" onClick={() => onSave(drafts)}>
            保存修改，查看第一周成果 <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

function WeekTwoChecklistPage({
  items,
  onContinue,
}: {
  items: WeekTwoChecklistItem[];
  onContinue: () => void;
}) {
  return (
    <main className="week-transition-page week-checklist-page">
      <section className="week-checklist-card">
        <header className="week-checklist-heading">
          <span>WEEK 02 · CHECKLIST</span>
          <h1>第二周结束，请检查你已经整理好的内容：</h1>
          <p>这些内容会成为第三周写作时直接调用的证据和素材。</p>
        </header>
        <div className="week-checklist-list week-two-checklist-list">
          {items.map((item, index) => (
            <article className={item.value.trim() ? 'is-ready' : 'is-missing'} key={item.label}>
              <div className="week-checklist-label">
                <span>0{index + 1}</span>
                <div>
                  <h2>{item.label}：</h2>
                  <small>{item.value.trim() ? 'READY' : '待补充'}</small>
                </div>
              </div>
              <p>{item.value || '这一项目前还没有内容，可以之后回到对应关卡补充。'}</p>
            </article>
          ))}
        </div>
        <footer className="week-checklist-actions">
          <button className="main-button" type="button" onClick={onContinue}>
            确认，查看第二周成果 <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </main>
  );
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
  const activeDayIsPartial = (
    currentDay === 10 && answers[keyFor(10, 'feedbackStatus')] === 'waiting'
  ) || Object.entries(deferred).some(
    ([key, value]) => value && key.startsWith(`${currentDay}:`),
  );
  const weekOneChecklist: WeekOneChecklistItem[] = [
    {
      id: 'introduction',
      label: '一句话介绍',
      value: firstFilled(answers[keyFor(4, 'selectedValue')], answers[keyFor(6, 'statementValue')]),
    },
    {
      id: 'audience',
      label: '我知道自己先服务哪类人',
      value: firstFilled(answers[keyFor(2, 'selectedAudience')]),
    },
    {
      id: 'problems',
      label: '我列出了他们最常见的 3 个问题',
      value: firstFilled(answers[keyFor(3, 'topProblems')]),
    },
    {
      id: 'evidence',
      label: '我有一句“为什么是我”的证据',
      value: firstFilled(answers[keyFor(5, 'evidenceSentence')], answers[keyFor(6, 'statementEvidence')]),
    },
  ];
  const weekTwoWorks = parseWorkEvidence(
    answers[keyFor(8, 'workEvidence')] ?? '',
    answers[keyFor(8, 'works')] ?? '',
  ).filter((work) => work.title.trim() && !work.discarded);
  const weekTwoCognition = parseCognitionRecords(
    answers[keyFor(11, 'stories')] ?? '',
    weekTwoWorks,
  ).filter((record) => record.story.trim());
  const weekTwoRepresentatives = parseRepresentativeWorks(
    answers[keyFor(13, 'representativeWorks')] ?? '',
    weekTwoWorks,
  );
  const weekTwoChecklist: WeekTwoChecklistItem[] = [
    {
      label: '一份作品与证据清单',
      value: weekTwoWorks.map((work) => [
        work.title,
        work.problem ? `解决：${work.problem}` : '',
        work.proof ? `证明：${work.proof}` : '',
      ].filter(Boolean).join('\n')).join('\n\n'),
    },
    {
      label: '一组能证明判断的认知变化',
      value: weekTwoCognition.map((record) => {
        const work = weekTwoWorks.find((item) => item.id === record.workId);
        return `${work?.title || '相关作品'}：${record.story}`;
      }).join('\n\n'),
    },
    {
      label: '1–3 个代表作品',
      value: weekTwoRepresentatives.map((work) => [
        work.what,
        work.problem ? `解决：${work.problem}` : '',
        work.proof ? `证明：${work.proof}` : '',
      ].filter(Boolean).join('\n')).join('\n\n'),
    },
    {
      label: '一页“为什么能信我”',
      value: answers[keyFor(13, 'trustPage')] ?? '',
    },
  ];

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
          : currentDay === 4 && ['focusProblem', 'valueOutcome', 'generatedDraft', 'valueVersions', 'selectedValue'].includes(id) && previousValue !== value
            ? 5
            : currentDay === 5 && ['evidenceFacts', 'evidenceProblem', 'evidenceReason', 'evidenceSentence'].includes(id) && previousValue !== value
              ? 6
              : currentDay === 6 && ['statementValue', 'statementFit', 'statementProblem1', 'statementProblem2', 'statementProblem3', 'statementEvidence', 'optimizedStatement', 'firstStatement'].includes(id) && previousValue !== value
                ? 7
                : currentDay === 8 && id === 'workEvidence' && previousValue !== value
                  ? 9
                  : currentDay === 9 && id === 'resultEvidence' && previousValue !== value
                    ? 10
                    : currentDay === 10 && id === 'specificFeedback' && previousValue !== value
                      ? 11
                      : currentDay === 11 && id === 'stories' && previousValue !== value
                        ? 12
                        : currentDay === 13 && ['representativeWorks', 'notPromise', 'canHelp', 'trustPage'].includes(id) && previousValue !== value
                          ? 15
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

      if (
        currentDay === 6
        && ['statementValue', 'statementFit', 'statementProblem1', 'statementProblem2', 'statementProblem3', 'statementEvidence'].includes(id)
        && previousValue !== value
      ) {
        next[keyFor(6, 'optimizedStatement')] = '';
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

  const finishFirstWeek = (missingIds: string[]) => {
    const missing = new Set(missingIds);
    setDeferred((previous) => {
      const next = { ...previous };
      flow.forEach((step, index) => {
        const id = flowStepId(step, index);
        next[keyFor(7, id)] = missing.has(id);
      });
      return next;
    });
    setCompleted((previous) => ({ ...previous, '7': true }));
    setPreviewMode(false);
    setView('week-checklist');
    window.scrollTo({ top: 0 });
  };

  const finishCombinedDaysThirteenAndFourteen = (missingIds: string[]) => {
    const missing = new Set(missingIds);
    const dayThirteenFlow = getFlow(days[12]);
    setDeferred((previous) => {
      const next = { ...previous };
      dayThirteenFlow.forEach((step, index) => {
        const id = flowStepId(step, index);
        next[keyFor(13, id)] = missing.has(id);
      });
      Object.keys(next).forEach((key) => {
        if (key.startsWith('14:')) delete next[key];
      });
      return next;
    });
    setCompleted((previous) => ({ ...previous, '13': true, '14': true }));
    setCurrentDay(15);
    setPreviewMode(false);
    setView('week-two-checklist');
    window.scrollTo({ top: 0 });
  };

  const finishMergedDayFourteen = () => {
    setCompleted((previous) => ({ ...previous, '14': true }));
    setDeferred((previous) => {
      const next = { ...previous };
      Object.keys(next).forEach((key) => {
        if (key.startsWith('14:')) delete next[key];
      });
      return next;
    });
    setCurrentDay(15);
    setPreviewMode(false);
    setView('week-two-checklist');
    window.scrollTo({ top: 0 });
  };

  const saveWeekOneChecklist = (drafts: Record<WeekOneChecklistItem['id'], string>) => {
    const introduction = drafts.introduction.trim();
    const audience = drafts.audience.trim();
    const problems = uniqueLines(drafts.problems).slice(0, 3);
    const evidence = drafts.evidence.trim();

    setAnswers((previous) => {
      const next = { ...previous };
      next[keyFor(2, 'selectedAudience')] = audience;
      next[keyFor(3, 'problemCandidates')] = uniqueLines([
        previous[keyFor(3, 'problemCandidates')] ?? '',
        ...problems,
      ].join('\n')).join('\n');
      next[keyFor(3, 'topProblems')] = problems.join('\n');
      next[keyFor(4, 'valueVersions')] = uniqueLines([
        previous[keyFor(4, 'valueVersions')] ?? '',
        introduction,
      ].join('\n')).join('\n');
      next[keyFor(4, 'selectedValue')] = introduction;
      next[keyFor(5, 'evidenceSentence')] = evidence;
      next[keyFor(6, 'statementValue')] = introduction;
      next[keyFor(6, 'statementFit')] = audience;
      [0, 1, 2].forEach((index) => {
        next[keyFor(6, `statementProblem${index + 1}`)] = problems[index] ?? '';
      });
      next[keyFor(6, 'statementEvidence')] = evidence;
      next[keyFor(6, 'optimizedStatement')] = '';
      next[keyFor(6, 'firstStatement')] = [
        introduction,
        audience ? `适合：${audience}` : '',
        problems.length ? `常见卡点：${problems.join('；')}` : '',
        evidence,
      ].filter(Boolean).join('\n');
      return next;
    });
    setView('week-complete');
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
          answers={answers}
          completed={completed}
          deferred={deferred}
          firstIncomplete={firstIncomplete}
          onClose={() => setLevelsOpen(false)}
          onSelect={navigateToDay}
        />
      </main>
    );
  }

  if (view === 'week-checklist') {
    return <WeekOneChecklistPage items={weekOneChecklist} onSave={saveWeekOneChecklist} />;
  }

  if (view === 'week-complete') {
    return (
      <main className="week-transition-page week-complete-page">
        <section className="week-complete-card">
          <span>WEEK 01 · COMPLETE</span>
          <div className="week-firework" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <b />
          </div>
          <h1>恭喜你完成了第一周的任务</h1>
          <p>你已经收获了一份可用的服务说明。接下来，我们进入第二周。</p>
          <button className="main-button" type="button" onClick={() => navigateToDay(8)}>
            进入第二周 <span aria-hidden="true">→</span>
          </button>
          <div className="next-week-preview">
            <strong>在第二周你会获得什么</strong>
            <p>一份作品与证据清单、一组能证明判断的认知变化、1–3 个代表作品，以及一页“为什么能信我”。</p>
          </div>
        </section>
      </main>
    );
  }

  if (view === 'week-two-checklist') {
    return <WeekTwoChecklistPage items={weekTwoChecklist} onContinue={() => setView('week-two-complete')} />;
  }

  if (view === 'week-two-complete') {
    return (
      <main className="week-transition-page week-complete-page">
        <section className="week-complete-card">
          <span>WEEK 02 · COMPLETE</span>
          <div className="week-firework" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <b />
          </div>
          <h1>恭喜你完成了第二周的任务</h1>
          <p>你已经把散落的作品、变化和判断整理成了一套可以被别人看见的信任证据。接下来，我们进入第三周。</p>
          <button className="main-button" type="button" onClick={() => navigateToDay(15)}>
            进入第三周 <span aria-hidden="true">→</span>
          </button>
          <div className="next-week-preview">
            <strong>在第三周你会获得什么</strong>
            <p>5 篇能说明你价值的内容初稿，让别人看见你发现的问题、你的判断，以及你能够提供的帮助。</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mvp-day">
      <DaySidebar
        currentDay={currentDay}
        answers={answers}
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
              {activeDayIsPartial && (
                <strong>{currentDay === 10 && answers[keyFor(10, 'feedbackStatus')] === 'waiting' ? '反馈待补充' : '待补充'}</strong>
              )}
            </div>
            <h1>{activeDay.title}</h1>
            {currentDay === 5 ? (
              <div className="day-orientation-copy day-orientation-copy-single">
                <p>{activeDay.principle}</p>
              </div>
            ) : ![1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(currentDay) && (
              <div className="day-orientation-copy">
                <p>{shortReason(activeDay)}</p>
                <strong>完成后：{activeDay.output}</strong>
              </div>
            )}
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
            ) : currentDay === 3 ? (
              <DayThreeSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            ) : currentDay === 4 ? (
              <DayFourSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            ) : currentDay === 5 ? (
              <DayFiveSinglePage
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
                onSubmit={finishFirstWeek}
              />
            ) : currentDay === 8 ? (
              <DayEightSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            ) : currentDay === 9 ? (
              <DayNineSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            ) : currentDay === 10 ? (
              <DayTenSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(status, missingIds) => {
                  setAnswer('feedbackStatus', status);
                  finishCurrentDay(missingIds);
                }}
              />
            ) : currentDay === 11 ? (
              <DayElevenSinglePage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => finishCurrentDay(missingIds)}
              />
            ) : currentDay === 12 ? (
              <DayTwelvePlaceholder onSubmit={() => finishCurrentDay([])} />
            ) : currentDay === 13 ? (
              <DayThirteenCombinedPage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={finishCombinedDaysThirteenAndFourteen}
              />
            ) : currentDay === 14 ? (
              <DayFourteenMergedPage
                onBack={() => navigateToDay(13)}
                onContinue={finishMergedDayFourteen}
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
        answers={answers}
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
          <h2>请站在别人的视角看看</h2>
          <p>注释：需要猜或者追问，就要选“不清楚”</p>
          <div className="clarity-list">
            {clarityQuestions.map((question, index) => {
              const value = answers[keyFor(1, question.id)] ?? '';
              return (
                <div className="clarity-item" role="group" aria-label={question.label} key={question.id}>
                  <p>{index + 1}. {question.label}</p>
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
                </div>
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
          <h2>你的客户是什么样的？</h2>
          <p>不用确定终身定位，就根据你现在的技能，写下来你能帮到的人是什么样的。</p>
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
            <summary>完全想不到怎么办？</summary>
            <p>你的这项技能为你解决了什么问题？你为什么会拥有这项技能？</p>
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

function DayThreeSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const audience = answers[keyFor(2, 'selectedAudience')] ?? '';
  const candidates = uniqueLines(answers[keyFor(3, 'problemCandidates')] ?? '');
  const selected = uniqueLines(answers[keyFor(3, 'topProblems')] ?? '');
  const toggleProblem = (problem: string) => {
    const next = selected.includes(problem)
      ? selected.filter((item) => item !== problem)
      : selected.length < 3 ? [...selected, problem] : selected;
    onAnswer('topProblems', next.join('\n'));
  };
  const missingIds = [
    candidates.length ? '' : 'problemCandidates',
    selected.length ? '' : 'topProblems',
  ].filter(Boolean);

  return (
    <div className="single-day-form day-three-form">
      {audience && (
        <div className="answer-row compact-answer-row">
          <span>你正在代入的客户</span>
          <strong>{audience}</strong>
        </div>
      )}

      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>请你代入这类客户，想想他们的卡点会是什么</h2>
          <p>结合你想提供的服务，想想对应解决了什么问题。可以多写几个，每行一个问题。</p>
          <details className="worksheet-help problem-examples">
            <summary>查看例子</summary>
            <ul>
              <li>对自媒体感兴趣但无从下手的人：我不知道可以怎么开始拍视频</li>
              <li>有目标但不知道怎么执行的人：我不知道可以怎么规划日程</li>
              <li>想写作但无从写起的人：我想开始练习写作，但是不知道可以写什么</li>
            </ul>
          </details>
          <label className="sr-only" htmlFor="day-three-problems">客户的卡点</label>
          <textarea
            id="day-three-problems"
            value={answers[keyFor(3, 'problemCandidates')] ?? ''}
            placeholder="每行写一个问题"
            onChange={(event) => onAnswer('problemCandidates', event.target.value)}
          />
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>选出用户最痛的、你能解决的</h2>
          <p>从列出的卡点中选择 1–3 个。</p>
          {candidates.length ? (
            <div className="selection-list worksheet-selection">
              {candidates.map((problem, index) => (
                <button
                  type="button"
                  key={`${problem}-${index}`}
                  className={selected.includes(problem) ? 'selection-item selected' : 'selection-item'}
                  aria-pressed={selected.includes(problem)}
                  onClick={() => toggleProblem(problem)}
                >
                  <span>{index + 1}</span>
                  <strong>{problem}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-inline">先在上面写下卡点，它们会自动出现在这里。</p>
          )}
        </div>
      </section>

      <div className="single-day-submit">
        <p>{missingIds.length ? '暂时没写完也可以继续，这一关会标记为待补充。' : '已选出这一轮最值得解决的卡点。'}</p>
        <button className="main-button" type="button" onClick={() => onSubmit(missingIds)}>
          完成本关，进入第 4 关 →
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
  const audience = answers[keyFor(2, 'selectedAudience')] ?? '';
  const selectedProblems = uniqueLines(answers[keyFor(3, 'topProblems')] ?? '');
  const allProblems = uniqueLines(answers[keyFor(3, 'problemCandidates')] ?? '');
  const problemOptions = selectedProblems.length ? selectedProblems : allProblems;
  const storedProblem = answers[keyFor(4, 'focusProblem')] ?? '';
  const focusProblem = storedProblem || (problemOptions.length === 1 ? problemOptions[0] : '');
  const outcome = answers[keyFor(4, 'valueOutcome')] ?? '';
  const versions = uniqueLines(answers[keyFor(4, 'valueVersions')] ?? '');
  const selectedValue = answers[keyFor(4, 'selectedValue')] ?? '';
  const draft = answers[keyFor(4, 'generatedDraft')] ?? selectedValue;
  const canGenerate = Boolean(audience.trim() && focusProblem.trim() && outcome.trim());
  const missingIds = [
    !focusProblem.trim() ? 'focusProblem' : '',
    !versions.length ? 'valueVersions' : '',
    !selectedValue.trim() || !versions.includes(selectedValue.trim()) ? 'selectedValue' : '',
  ].filter(Boolean);

  const generateSentence = () => {
    if (!canGenerate) return;
    const sentence = `我帮助${audience.trim()}解决“${focusProblem.trim()}”，让他能够${outcome.trim()}。`;
    onAnswer('focusProblem', focusProblem);
    onAnswer('generatedDraft', sentence);
  };

  const addCandidate = () => {
    const sentence = draft.trim();
    if (!sentence || versions.includes(sentence) || versions.length >= 5) return;
    onAnswer('valueVersions', [...versions, sentence].join('\n'));
  };

  return (
    <div className="single-day-form day-four-form">
      <section className="single-task-block compact-task-block">
        <span className="task-number">01</span>
        <div>
          <div className="answer-row">
            <span>本轮最想服务的人</span>
            <strong>{audience || '第 2 关暂未填写'}</strong>
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>他们正在遇到的问题</h2>
          <label className="sr-only" htmlFor="day-four-problem">选择一个客户卡点</label>
          {problemOptions.length ? (
            <select
              id="day-four-problem"
              className="full-select"
              value={focusProblem}
              onChange={(event) => onAnswer('focusProblem', event.target.value)}
            >
              {problemOptions.length > 1 && <option value="">请选择一个客户卡点</option>}
              {problemOptions.map((problem) => <option value={problem} key={problem}>{problem}</option>)}
            </select>
          ) : (
            <p className="empty-inline">第 3 关还没有卡点，请先返回补充。</p>
          )}
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">03</span>
        <div>
          <h2>让他们得到什么样的结果</h2>
          <textarea
            value={outcome}
            placeholder="例如：完成并发布第一条视频"
            onChange={(event) => onAnswer('valueOutcome', event.target.value)}
          />
          <div className="sentence-formula" aria-label="自我介绍句子公式">
            <span>句子公式</span>
            <p>我帮助【本轮服务的人】解决【选择的问题】，让他能够【得到的结果】。</p>
          </div>
          <div className="center-action">
            <button className="secondary-button generate-button" type="button" disabled={!canGenerate} onClick={generateSentence}>
              生成自我介绍 <span aria-hidden="true">→</span>
            </button>
          </div>

          {draft && (
            <div className="draft-editor">
              <label htmlFor="day-four-draft">生成后可以自行编辑和完善</label>
              <textarea
                id="day-four-draft"
                value={draft}
                onChange={(event) => onAnswer('generatedDraft', event.target.value)}
              />
              <div className="center-action">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!draft.trim() || versions.includes(draft.trim()) || versions.length >= 5}
                  onClick={addCandidate}
                >
                  {versions.length >= 5 ? '候选池已满 5 条' : versions.includes(draft.trim()) ? '已加入候选池' : <>加入候选池 <span aria-hidden="true">→</span></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">04</span>
        <div>
          <h2>自我介绍候选池</h2>
          <p>先选一版你最想立刻开始的。</p>
          {versions.length ? (
            <div className="introduction-pool">
              {versions.map((version, index) => (
                <button
                  type="button"
                  key={`${version}-${index}`}
                  className={selectedValue.trim() === version ? 'introduction-candidate selected' : 'introduction-candidate'}
                  aria-pressed={selectedValue.trim() === version}
                  onClick={() => onAnswer('selectedValue', version)}
                >
                  <span>{index + 1}</span>
                  <strong>{version}</strong>
                  <small>{selectedValue.trim() === version ? '最终选择' : '点击选择'}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-inline">生成并完善句子后，把它加入候选池。</p>
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

function DayFiveSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const experience = answers[keyFor(5, 'evidenceFacts')] ?? '';
  const problemOptions = uniqueLines([
    answers[keyFor(3, 'topProblems')] ?? '',
    answers[keyFor(3, 'problemCandidates')] ?? '',
    answers[keyFor(4, 'focusProblem')] ?? '',
  ].join('\n'));
  const savedSentence = answers[keyFor(5, 'evidenceSentence')] ?? '';
  const legacyReason = savedSentence.includes('因为')
    ? savedSentence.split('因为').slice(1).join('因为').replace(/[。.]$/, '')
    : '';
  const evidenceProblem = answers[keyFor(5, 'evidenceProblem')]
    ?? answers[keyFor(4, 'focusProblem')]
    ?? (problemOptions.length === 1 ? problemOptions[0] : '');
  const evidenceReason = answers[keyFor(5, 'evidenceReason')] ?? legacyReason;
  const evidenceSentence = evidenceProblem.trim() && evidenceReason.trim()
    ? `我可以帮你解决“${evidenceProblem.trim()}”的问题，因为${evidenceReason.trim().replace(/[。.]$/, '')}。`
    : '';
  const missingIds = [
    experience.trim() ? '' : 'evidenceFacts',
    evidenceSentence ? '' : 'evidenceSentence',
  ].filter(Boolean);

  const saveAndContinue = () => {
    onAnswer('evidenceProblem', evidenceProblem);
    onAnswer('evidenceReason', evidenceReason);
    onAnswer('evidenceSentence', evidenceSentence);
    onSubmit(missingIds);
  };

  return (
    <div className="single-day-form day-five-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>先列经验素材</h2>
          <p>列出与服务相关的过往经验，你做过什么、交付过什么。</p>
          <details className="worksheet-help">
            <summary>查看经验素材的例子</summary>
            <ul>
              <li>我自己从不会拍摄，到持续发布了 100 条视频。</li>
              <li>我帮助过 3 个朋友完成第一条视频。</li>
              <li>我整理过一套选题、脚本和拍摄流程。</li>
            </ul>
          </details>
          <label className="sr-only" htmlFor="day-five-experience">经验素材</label>
          <textarea
            id="day-five-experience"
            value={experience}
            placeholder="每行写一条与服务相关的经验"
            onChange={(event) => onAnswer('evidenceFacts', event.target.value)}
          />
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>从素材中选择你的实力担当</h2>
          <p>注释：先选择客户痛点，再结合你的经验素材完成句子。</p>
          <div className="evidence-builder">
            <span>我可以帮你解决</span>
            {problemOptions.length ? (
              <select value={evidenceProblem} onChange={(event) => onAnswer('evidenceProblem', event.target.value)}>
                <option value="">选择一个客户痛点</option>
                {problemOptions.map((problem) => <option value={problem} key={problem}>“{problem}”</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={evidenceProblem}
                placeholder="先写下客户痛点"
                onChange={(event) => onAnswer('evidenceProblem', event.target.value)}
              />
            )}
            <span>的问题，因为</span>
            <input
              type="text"
              value={evidenceReason}
              placeholder="结合上面的经验，说清楚为什么是你"
              onChange={(event) => onAnswer('evidenceReason', event.target.value)}
            />
          </div>
          <div className="evidence-preview">
            {evidenceSentence || '选好客户痛点并补充经验后，这里会生成一句完整证据。'}
          </div>
        </div>
      </section>

      <div className="single-day-submit">
        <p>{missingIds.length ? '没写完也可以继续，这一关会标记为待补充。' : '你的服务现在有了一句可以被验证的实力证据。'}</p>
        <button className="main-button" type="button" onClick={saveAndContinue}>
          保存证据，进入第 6 关 →
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
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState('');
  const [editingStatement, setEditingStatement] = useState(false);
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
  const optimizedStatement = answers[keyFor(6, 'optimizedStatement')] ?? '';
  const filledProblems = problemValues.map((item) => item.trim()).filter(Boolean);
  const assembled = [
    valueLine.trim(),
    fitAudience.trim() ? `适合：${fitAudience.trim()}` : '',
    filledProblems.length ? `常见卡点：${filledProblems.join('；')}` : '',
    evidence.trim(),
  ].filter(Boolean).join('\n');
  const displayedStatement = optimizedStatement.trim() || assembled;
  const complete = Boolean(valueLine.trim() && fitAudience.trim() && filledProblems.length && evidence.trim());

  const optimizeStatement = async () => {
    if (!assembled.trim() || optimizing) return;
    setOptimizing(true);
    setOptimizeError('');
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: assembled,
          context: {
            audience: answers[keyFor(2, 'selectedAudience')] ?? fitAudience,
            mainProblem: answers[keyFor(4, 'focusProblem')] ?? filledProblems[0] ?? '',
            outcome: answers[keyFor(4, 'valueOutcome')] ?? '',
            suitableFor: fitAudience,
            commonProblems: filledProblems,
            evidence,
          },
        }),
      });
      const result = await response.json() as { optimized?: string; error?: string };
      if (!response.ok || !result.optimized?.trim()) {
        throw new Error(result.error || '暂时无法优化，请稍后再试。');
      }
      onAnswer('optimizedStatement', result.optimized.trim());
    } catch (error) {
      setOptimizeError(error instanceof Error ? error.message : '暂时无法优化，请稍后再试。');
    } finally {
      setOptimizing(false);
    }
  };

  const saveAndContinue = () => {
    onAnswer('statementValue', valueLine);
    onAnswer('statementFit', fitAudience);
    problemValues.forEach((problem, index) => onAnswer(`statementProblem${index + 1}`, problem));
    onAnswer('statementEvidence', evidence);
    onAnswer('firstStatement', displayedStatement);
    onSubmit(complete ? [] : ['firstStatement']);
  };

  return (
    <div className="single-day-form day-six-form">
      <section className="assembly-intro">
        <p>让我们一起看看目前你的答案，你可以进行措辞上的优化。</p>
      </section>

      <section className="single-task-block day-six-part tone-rose">
        <span className="task-number">01</span>
        <div>
          <h2>我帮谁、解决什么，让他能做到什么</h2>
          <AutoGrowTextarea
            value={valueLine}
            placeholder="我帮……，解决……，让他能……"
            onChange={(event) => onAnswer('statementValue', event.target.value)}
          />
        </div>
      </section>

      <section className="single-task-block day-six-part tone-paper">
        <span className="task-number">02</span>
        <div>
          <h2>这项服务具体适合谁？</h2>
          <AutoGrowTextarea
            value={fitAudience}
            placeholder="例如：已经有服务经验和案例，但陌生客户仍看不懂他与同行有什么不同的独立顾问"
            onChange={(event) => onAnswer('statementFit', event.target.value)}
          />
        </div>
      </section>

      <section className="single-task-block day-six-part tone-rose">
        <span className="task-number">03</span>
        <div>
          <h2>这类客户常带着哪些具体问题来找你？</h2>
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

      <section className="single-task-block day-six-part tone-paper">
        <span className="task-number">04</span>
        <div>
          <h2>为什么是你？</h2>
          <p>这里不写“我很专业”，而是放入第 5 关的事实证据：你做过什么，证明你有能力推进这个问题。</p>
          <AutoGrowTextarea
            value={evidence}
            placeholder="例如：我已经为 3 位独立顾问重新整理过服务说明，并保留了修改前后的真实版本"
            onChange={(event) => onAnswer('statementEvidence', event.target.value)}
          />
        </div>
      </section>

      <section className="service-statement-result">
        <h2>你的服务说明</h2>
        <div className="assembly-preview">
          {editingStatement ? (
            <AutoGrowTextarea
              className="statement-result-editor"
              value={displayedStatement}
              aria-label="编辑你的服务说明"
              autoFocus
              onChange={(event) => onAnswer('optimizedStatement', event.target.value)}
            />
          ) : (
            <p>{displayedStatement || '上面的答案会在这里自动拼成一段完整说明。'}</p>
          )}
          <span>{displayedStatement.length} 字</span>
        </div>
        <div className="optimize-actions">
          <button
            className="secondary-button optimize-button"
            type="button"
            disabled={!assembled.trim() || optimizing}
            onClick={optimizeStatement}
          >
            {optimizing ? '正在优化…' : '不通顺？点击优化 →'}
          </button>
          <button
            className="secondary-button edit-statement-button"
            type="button"
            disabled={!displayedStatement.trim()}
            onClick={() => {
              if (!editingStatement && !optimizedStatement.trim()) {
                onAnswer('optimizedStatement', displayedStatement);
              }
              setEditingStatement((previous) => !previous);
            }}
          >
            {editingStatement ? '完成编辑' : '编辑'}
          </button>
          {optimizeError && <p role="alert">{optimizeError}</p>}
        </div>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={saveAndContinue}>
          保存服务说明，进入第 7 关 →
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
  const [copiedInitial, setCopiedInitial] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const testStatement = answers[keyFor(6, 'firstStatement')] ?? '';
  const legacyTesterNames = uniqueLines(answers[keyFor(7, 'testers')] ?? '');
  const testers = Array.from({ length: 5 }, (_, index) => {
    const number = index + 1;
    const legacyFeedback = [
      answers[keyFor(7, `tester-${number}-who`)] ?? '',
      answers[keyFor(7, `tester-${number}-problem`)] ?? '',
      answers[keyFor(7, `tester-${number}-timing`)] ?? '',
    ].filter(Boolean).join('\n');
    return {
      number,
      name: answers[keyFor(7, `tester-${number}-name`)] ?? legacyTesterNames[index] ?? '',
      feedback: answers[keyFor(7, `tester-${number}-feedback`)] ?? legacyFeedback,
    };
  });
  const namedCount = testers.filter((tester) => tester.name.trim()).length;
  const feedbackCount = testers.filter((tester) => tester.name.trim() && tester.feedback.trim()).length;
  const revisedStatement = answers[keyFor(7, 'revisedStatement')] ?? testStatement;
  const aiPrompt = `我正在优化一份服务说明。请不要直接替我重写，先帮我判断反馈中哪些属于表达不清、哪些只是个人偏好、哪些值得采纳。\n\n我的初稿：\n${testStatement || '【请粘贴你的初稿】'}\n\n测试对象的反馈：\n【请把收集到的反馈复制到这里】\n\n请按下面的顺序回答：\n1. 总结反馈中反复出现的误解；\n2. 区分值得采纳的反馈和不必采纳的个人偏好；\n3. 指出初稿中最需要调整的具体位置；\n4. 给出修改方向，但先不要直接生成最终稿。`;

  const copyText = async (text: string, type: 'initial' | 'prompt') => {
    if (!text || !testStatement) return;
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'initial') setCopiedInitial(true);
      else setCopiedPrompt(true);
      window.setTimeout(() => {
        setCopiedInitial(false);
        setCopiedPrompt(false);
      }, 1800);
    } catch {
      setCopiedInitial(false);
      setCopiedPrompt(false);
    }
  };

  const saveAndContinue = () => {
    const testerNames = testers.map((tester) => tester.name.trim()).filter(Boolean).join('\n');
    const feedback = testers
      .filter((tester) => tester.name.trim() || tester.feedback.trim())
      .map((tester) => `${tester.name.trim() || `测试对象 ${tester.number}`}：${tester.feedback.trim() || '未记录'}`)
      .join('\n\n');
    onAnswer('testers', testerNames);
    onAnswer('retellFeedback', feedback);
    onAnswer('revisedStatement', revisedStatement);
    const missingIds = [
      namedCount < 5 ? 'testers' : '',
      feedbackCount < 5 ? 'retellFeedback' : '',
      !revisedStatement.trim() ? 'revisedStatement' : '',
    ].filter(Boolean);
    onSubmit(missingIds);
  };

  return (
    <div className="single-day-form day-seven-form">
      <section className="test-message-panel">
        <div className="test-message-heading">
          <div>
            <span>你的初版服务说明</span>
            <strong>{testStatement ? '把这份说明发给身边的人' : '第 6 关暂时没有可用的服务说明'}</strong>
          </div>
        </div>
        <p className="test-statement">{testStatement || '请先回到第 6 关生成一份服务说明。'}</p>
        <button className="secondary-button statement-copy-button" type="button" disabled={!testStatement} onClick={() => copyText(testStatement, 'initial')}>
          {copiedInitial ? '✓ 已复制' : '复制服务说明'}
        </button>
      </section>

      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>记录测试对象和反馈原话</h2>
          <div className="feedback-record-list">
            {testers.map((tester) => (
              <div className="feedback-record" key={tester.number}>
                <span>{String(tester.number).padStart(2, '0')}</span>
                <label>
                  <strong>测试对象</strong>
                  <input
                    type="text"
                    value={tester.name}
                    placeholder="例如：小王 / 前同事"
                    onChange={(event) => onAnswer(`tester-${tester.number}-name`, event.target.value)}
                  />
                </label>
                <label>
                  <strong>反馈的原话</strong>
                  <textarea
                    value={tester.feedback}
                    placeholder="把对方的反馈原样记录在这里"
                    onChange={(event) => onAnswer(`tester-${tester.number}-feedback`, event.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>该如何调整？</h2>
          <p>先辨别反馈中哪部分可以优化——不是所有优化建议都要采纳。</p>
          <p>这个环节也可以把初稿、测试对象的反馈一同发给任意大模型，看看 AI 怎么说。</p>
          <details className="worksheet-help ai-prompt-panel">
            <summary>打开通用 AI 分析提示词</summary>
            <div className="copy-message">
              <p>{aiPrompt}</p>
              <button className="secondary-button" type="button" disabled={!testStatement} onClick={() => copyText(aiPrompt, 'prompt')}>
                {copiedPrompt ? '✓ 已复制' : '一键复制提示词'}
              </button>
            </div>
          </details>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">03</span>
        <div>
          <h2>确定最终稿</h2>
          <textarea
            value={revisedStatement}
            placeholder="第 6 关的初版服务说明会自动填入这里"
            onChange={(event) => onAnswer('revisedStatement', event.target.value)}
          />
        </div>
      </section>

      <div className="single-day-submit submit-only week-finish-submit">
        <button className="main-button" type="button" onClick={saveAndContinue}>
          这一关完成，我已收获一份可用的服务说明
        </button>
      </div>
    </div>
  );
}

function DayEightSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const storedWorks = parseWorkEvidence(
    answers[keyFor(8, 'workEvidence')] ?? '',
    answers[keyFor(8, 'works')] ?? '',
  );
  const works = storedWorks.length ? storedWorks : [{
    id: 'work-1',
    title: '',
    problem: '',
    proof: '',
    discarded: false,
  }];
  const namedWorks = works.filter((work) => work.title.trim());
  const keptWorks = namedWorks.filter((work) => !work.discarded);

  const saveWorks = (nextWorks: WorkEvidence[]) => {
    onAnswer('workEvidence', JSON.stringify(nextWorks));
  };

  const updateWork = (id: string, patch: Partial<WorkEvidence>) => {
    saveWorks(works.map((work) => (work.id === id ? { ...work, ...patch } : work)));
  };

  const missing = keptWorks.length === 0
    || keptWorks.some((work) => !work.problem.trim() || !work.proof.trim());

  return (
    <div className="single-day-form evidence-work-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>先写下来都做过什么</h2>
          <details className="worksheet-help work-example">
            <summary>示例</summary>
            <ul>
              <li>一篇讲“如何开始记账”的公众号文章</li>
              <li>一份帮助新同事快速上手的工作清单</li>
              <li>一次帮朋友梳理简历的咨询与修改</li>
            </ul>
          </details>

          <div className="work-title-list">
            {works.map((work, index) => (
              <div className="work-title-row" key={work.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <label className="sr-only" htmlFor={`work-title-${work.id}`}>作品 {index + 1}</label>
                <input
                  id={`work-title-${work.id}`}
                  type="text"
                  value={work.title}
                  placeholder="作品名称"
                  onChange={(event) => updateWork(work.id, { title: event.target.value })}
                />
              </div>
            ))}
          </div>

          <button
            className="add-work-button"
            type="button"
            onClick={() => saveWorks([
              ...works,
              {
                id: nextWorkId(works),
                title: '',
                problem: '',
                proof: '',
                discarded: false,
              },
            ])}
          >
            <span aria-hidden="true">＋</span> 新增一行
          </button>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>补充作品解决了什么问题、证明了什么？</h2>
          <details className="worksheet-help work-example">
            <summary>示例</summary>
            <div className="work-example-list">
              <p><strong>记账相关的文章</strong><span>解决：读者想开始记账，却不知道第一步该做什么。</span><span>证明：我能把一个复杂方法讲成普通人可以照着做的步骤。</span></p>
              <p><strong>新同事工作清单</strong><span>解决：新人刚加入团队时，不知道每天该做什么、找谁确认。</span><span>证明：我能把零散的工作经验整理成清楚的流程。</span></p>
              <p><strong>简历梳理与修改</strong><span>解决：朋友经历很多，但简历上看不出优势和重点。</span><span>证明：我能从大量信息中找到重点，并把价值表达清楚。</span></p>
            </div>
          </details>

          <div className="work-evidence-list">
            {namedWorks.length ? namedWorks.map((work, index) => (
              <article className={work.discarded ? 'work-evidence-row is-discarded' : 'work-evidence-row'} key={work.id}>
                <header>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{work.title}</h3>
                </header>
                <div className="work-evidence-fields">
                  <label>
                    <span>解决了什么问题</span>
                    <input
                      type="text"
                      value={work.problem}
                      disabled={work.discarded}
                      onChange={(event) => updateWork(work.id, { problem: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>能证明什么</span>
                    <input
                      type="text"
                      value={work.proof}
                      disabled={work.discarded}
                      onChange={(event) => updateWork(work.id, { proof: event.target.value })}
                    />
                  </label>
                </div>
                <button
                  className="discard-work-button"
                  type="button"
                  onClick={() => updateWork(work.id, { discarded: !work.discarded })}
                >
                  {work.discarded ? '恢复这一条' : '舍弃这一条'}
                </button>
              </article>
            )) : (
              <p className="empty-inline">先在上方写下作品名称。</p>
            )}
          </div>
        </div>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={() => onSubmit(missing ? ['workEvidence'] : [])}>
          保存，进入第 9 关 →
        </button>
      </div>
    </div>
  );
}

function DayNineSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const works = parseWorkEvidence(
    answers[keyFor(8, 'workEvidence')] ?? '',
    answers[keyFor(8, 'works')] ?? '',
  ).filter((work) => work.title.trim() && !work.discarded);
  const results = parseResultEvidence(answers[keyFor(9, 'resultEvidence')] ?? '', works);
  const missing = works.length === 0 || works.some((work) => !results[work.id]?.trim());

  const updateResult = (id: string, value: string) => {
    onAnswer('resultEvidence', JSON.stringify({ ...results, [id]: value }));
  };

  return (
    <div className="single-day-form result-work-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>这里怎么写？</h2>
          <div className="result-writing-guide">
            <p>这一部分我们要写每个具体作品为自己带来的变化，以证明自己做过这件事后的认知成长或心得。</p>
            <strong>变化部分可以写：</strong>
            <ul>
              <li><b>行为变化：</b>从一直想写但没有开始，到写完并发布第一篇公众号文章。</li>
              <li><b>能力变化：</b>从只能凭感觉修改简历，到能找到经历中的重点并重新组织表达。</li>
              <li><b>业务变化：</b>从别人不知道我能提供什么帮助，到有人带着具体问题来找我。</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>用“从——，到——”造句</h2>
          <div className="result-work-list">
            {works.length ? works.map((work) => (
              <article className="result-work-card" key={work.id}>
                <h3>{work.title}</h3>
                <ul>
                  <li><strong>解决了什么问题：</strong>{work.problem || '—'}</li>
                  <li><strong>能证明什么：</strong>{work.proof || '—'}</li>
                </ul>
                <label htmlFor={`work-result-${work.id}`}>带来了什么样的变化</label>
                <AutoGrowTextarea
                  id={`work-result-${work.id}`}
                  value={results[work.id] ?? ''}
                  placeholder="例如：从不知道第一条视频拍什么，到能够确定选题并完成拍摄。"
                  onChange={(event) => updateResult(work.id, event.target.value)}
                />
              </article>
            )) : (
              <p className="empty-inline">第 8 关还没有保留的作品。</p>
            )}
          </div>
        </div>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={() => onSubmit(missing ? ['resultEvidence'] : [])}>
          保存，进入第 10 关 →
        </button>
      </div>
    </div>
  );
}

function DayTenSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (status: 'waiting' | 'complete', missingIds: string[]) => void;
}) {
  const works = parseWorkEvidence(
    answers[keyFor(8, 'workEvidence')] ?? '',
    answers[keyFor(8, 'works')] ?? '',
  ).filter((work) => work.title.trim() && !work.discarded);
  const storedRecords = parseFeedbackRecords(answers[keyFor(10, 'specificFeedback')] ?? '', works);
  const records = storedRecords.length ? storedRecords : [{
    id: 'feedback-1',
    workId: '',
    feedback: '',
  }];
  const hasFeedback = records.some((record) => record.workId && record.feedback.trim());

  const saveRecords = (nextRecords: FeedbackRecord[]) => {
    onAnswer('specificFeedback', JSON.stringify(nextRecords));
  };

  const updateRecord = (id: string, patch: Partial<FeedbackRecord>) => {
    saveRecords(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  };

  return (
    <div className="single-day-form feedback-day-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>什么反馈值得收集？</h2>
          <p className="feedback-purpose">整理反馈，是为了证明你的作品不只是“自己觉得有用”，而是真的帮助别人解决过具体问题、产生过具体变化。</p>
          <p>找到别人的反馈。聊天记录、评论、转介绍、读者私信都可以，只收具体的反馈。多小的反馈都可以写，只要足够具体。</p>
          <ol className="feedback-guidance-list">
            <li>
              <strong>不要收空泛的评价</strong>
              <span>例如：“很专业”“很有帮助”“收获很大”。</span>
            </li>
            <li>
              <strong>收下能够说明具体变化的反馈</strong>
              <span>例如：“我终于知道怎么介绍自己的服务了”“你帮我把一堆散的卖点理顺了”“我第一次意识到问题不在内容，而在价值没说清”“这个版本发出去以后，客户问得更具体了”。</span>
            </li>
          </ol>

          <div className="feedback-empty-guide">
            <h3>暂时没有反馈怎么办？</h3>
            <ul>
              <li>仔细回顾一下。反馈不需要很正式，也不需要来自大型项目；朋友使用后的感受、别人日常给你的具体评价都可以。</li>
              <li>如果确实没有，选择一个小作品让朋友测试，现场收集反馈。你可以先把这一关标记为“反馈待补充”，继续后面的步骤。</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>填写反馈</h2>
          <div className="feedback-entry-list">
            {records.map((record, index) => (
              <div className="feedback-entry-row" key={record.id}>
                <label>
                  <span>作品</span>
                  <select
                    value={record.workId}
                    aria-label={`第 ${index + 1} 条反馈对应的作品`}
                    onChange={(event) => updateRecord(record.id, { workId: event.target.value })}
                  >
                    <option value="">选择作品</option>
                    {works.map((work) => <option value={work.id} key={work.id}>{work.title}</option>)}
                  </select>
                </label>
                <label>
                  <span>别人的反馈</span>
                  <AutoGrowTextarea
                    value={record.feedback}
                    aria-label={`第 ${index + 1} 条反馈内容`}
                    placeholder="把对方的原话写下来"
                    onChange={(event) => updateRecord(record.id, { feedback: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
          <button
            className="linked-add-button"
            type="button"
            onClick={() => saveRecords([
              ...records,
              { id: nextRecordId('feedback', records), workId: '', feedback: '' },
            ])}
          >
            <span aria-hidden="true">＋</span> 添加一条反馈
          </button>
        </div>
      </section>

      <div className="single-day-submit feedback-submit-actions">
        <button className="secondary-button" type="button" onClick={() => onSubmit('waiting', ['specificFeedback'])}>
          后续我会继续补充反馈
        </button>
        <button className="main-button" type="button" disabled={!hasFeedback} onClick={() => onSubmit('complete', [])}>
          已完成反馈，进入第 11 关 →
        </button>
      </div>
    </div>
  );
}

function DayElevenSinglePage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const works = parseWorkEvidence(
    answers[keyFor(8, 'workEvidence')] ?? '',
    answers[keyFor(8, 'works')] ?? '',
  ).filter((work) => work.title.trim() && !work.discarded);
  const storedRecords = parseCognitionRecords(answers[keyFor(11, 'stories')] ?? '', works);
  const records = storedRecords.length ? storedRecords : [{
    id: 'cognition-1',
    workId: '',
    story: '',
  }];
  const hasCognition = records.some((record) => record.workId && record.story.trim());

  const saveRecords = (nextRecords: CognitionRecord[]) => {
    onAnswer('stories', JSON.stringify(nextRecords));
  };

  const updateRecord = (id: string, patch: Partial<CognitionRecord>) => {
    saveRecords(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  };

  return (
    <div className="single-day-form cognition-day-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>从具体事情里，提炼你的认知变化</h2>
          <p>前面整理的是你做过什么，以及这些事情带来了什么变化。接下来要从具体事情中抽离出来，写清楚这段经历让你形成了什么判断。</p>
          <div className="cognition-formula">我以前……后来我发现……所以我现在……</div>
          <h3 className="example-section-title">下方是两个示例</h3>

          <div className="cognition-example-list">
            <article>
              <h4>写作场景</h4>
              <p className="negative-example"><strong>不要写：</strong>我以前不会写作，后来坚持练习，终于学会了写作。</p>
              <p className="positive-example"><strong>应该写：</strong>我以前以为写不出来是因为没有灵感，后来我发现真正让我卡住的是没有明确的问题和具体素材，所以我现在写文章前，会先确定一个真实问题，再去寻找相关经历和例子。</p>
            </article>
            <article>
              <h4>做产品场景</h4>
              <p className="negative-example"><strong>不要写：</strong>我从零开始学会了做产品，只要坚持就一定能成功。</p>
              <p className="positive-example"><strong>应该写：</strong>我以前总想等所有条件成熟再开始，后来我发现一个粗糙但能使用的版本，比停留在想法里更容易得到真实反馈，所以我现在会先做出最小版本，再根据使用情况继续修改。</p>
            </article>
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>接下来开始写吧</h2>
          <div className="cognition-formula compact-formula">我以前……后来我发现……所以我现在……</div>
          <div className="cognition-entry-list">
            {records.map((record, index) => (
              <div className="cognition-entry-row" key={record.id}>
                <select
                  value={record.workId}
                  aria-label={`第 ${index + 1} 条认知变化对应的作品`}
                  onChange={(event) => updateRecord(record.id, { workId: event.target.value })}
                >
                  <option value="">选择作品</option>
                  {works.map((work) => <option value={work.id} key={work.id}>{work.title}</option>)}
                </select>
                <span aria-hidden="true">：</span>
                <AutoGrowTextarea
                  value={record.story}
                  aria-label={`第 ${index + 1} 条认知变化`}
                  placeholder="我以前……后来我发现……所以我现在……"
                  onChange={(event) => updateRecord(record.id, { story: event.target.value })}
                />
              </div>
            ))}
          </div>
          <button
            className="linked-add-button"
            type="button"
            onClick={() => saveRecords([
              ...records,
              { id: nextRecordId('cognition', records), workId: '', story: '' },
            ])}
          >
            <span aria-hidden="true">＋</span> 再写一条
          </button>
        </div>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={() => onSubmit(hasCognition ? [] : ['stories'])}>
          保存，进入第 12 关 →
        </button>
      </div>
    </div>
  );
}

function DayTwelvePlaceholder({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className="single-day-form blank-day-form">
      <button className="main-button" type="button" onClick={onSubmit}>
        跳过第 12 关，进入第 13 关 →
      </button>
    </div>
  );
}

function DayThirteenCombinedPage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
}) {
  const works = parseWorkEvidence(
    answers[keyFor(8, 'workEvidence')] ?? '',
    answers[keyFor(8, 'works')] ?? '',
  ).filter((work) => work.title.trim() && !work.discarded);
  const selectedWorks = parseRepresentativeWorks(answers[keyFor(13, 'representativeWorks')] ?? '', works);
  const selectedIds = selectedWorks.map((work) => work.workId);
  const results = parseResultEvidence(answers[keyFor(9, 'resultEvidence')] ?? '', works);
  const cognition = parseCognitionRecords(answers[keyFor(11, 'stories')] ?? '', works);
  const mainProblem = firstFilled(
    answers[keyFor(4, 'focusProblem')],
    uniqueLines(answers[keyFor(3, 'topProblems')] ?? '')[0],
  );
  const notPromise = answers[keyFor(13, 'notPromise')] ?? '';
  const canHelp = answers[keyFor(13, 'canHelp')] ?? '';
  const trustPage = answers[keyFor(13, 'trustPage')] ?? '';

  const saveSelection = (nextSelection: RepresentativeWork[]) => {
    onAnswer('representativeWorks', JSON.stringify(nextSelection));
    onAnswer('trustPage', '');
  };

  const toggleWork = (work: WorkEvidence) => {
    if (selectedIds.includes(work.id)) {
      saveSelection(selectedWorks.filter((item) => item.workId !== work.id));
      return;
    }
    if (selectedWorks.length >= 3) return;
    saveSelection([
      ...selectedWorks,
      {
        workId: work.id,
        what: work.title,
        problem: work.problem,
        proof: work.proof,
      },
    ]);
  };

  const updateSelectedWork = (workId: string, patch: Partial<RepresentativeWork>) => {
    saveSelection(selectedWorks.map((work) => (
      work.workId === workId ? { ...work, ...patch } : work
    )));
  };

  const updateBoundary = (id: 'notPromise' | 'canHelp', value: string) => {
    onAnswer(id, value);
    onAnswer('trustPage', '');
  };

  const generateTrustPage = () => {
    const relatedWorks = selectedWorks
      .map((work) => work.what.trim())
      .filter(Boolean)
      .join('、');
    const changes = selectedWorks
      .map((work) => results[work.workId]?.trim())
      .filter(Boolean)
      .join('；');
    const judgments = cognition
      .filter((record) => selectedIds.includes(record.workId))
      .map((record) => record.story.trim())
      .filter(Boolean)
      .join('；');
    const generated = [
      `我主要解决的问题：${mainProblem || '________'}`,
      `我做过的相关作品：${relatedWorks || '________'}`,
      `我带来过的具体变化：${changes || '________'}`,
      `我反复形成的判断：${judgments || '________'}`,
      `我不承诺${notPromise.trim() || '________'}，但我能帮你${canHelp.trim() || '________'}。`,
    ].join('；\n');
    onAnswer('trustPage', generated);
  };

  const selectionComplete = selectedWorks.length > 0
    && selectedWorks.every((work) => work.what.trim() && work.problem.trim() && work.proof.trim());
  const missingIds = [
    selectionComplete ? '' : 'representativeWorks',
    trustPage.trim() ? '' : 'trustPage',
  ].filter(Boolean);

  return (
    <div className="single-day-form representative-day-form">
      <section className="current-problem-panel">
        <span>你现在要解决什么问题：</span>
        <strong>{mainProblem || '第一周还没有选定唯一的问题'}</strong>
      </section>

      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>选出与这个问题最相关的代表作品</h2>
          <p>从已有作品中选 1–3 个。</p>
          <div className="representative-choice-list">
            {works.length ? works.map((work) => {
              const selected = selectedIds.includes(work.id);
              const maxed = selectedWorks.length >= 3 && !selected;
              return (
                <button
                  className={selected ? 'is-selected' : ''}
                  type="button"
                  key={work.id}
                  aria-pressed={selected}
                  disabled={maxed}
                  onClick={() => toggleWork(work)}
                >
                  <span>{selected ? '✓' : '+'}</span>
                  <strong>{work.title}</strong>
                </button>
              );
            }) : <p className="empty-inline">第 8 关还没有可选择的作品。</p>}
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>把代表作品整理清楚</h2>
          <div className="representative-work-list">
            {selectedWorks.length ? selectedWorks.map((selected, index) => {
              const source = works.find((work) => work.id === selected.workId);
              return (
                <article key={selected.workId}>
                  <h3><span>{String(index + 1).padStart(2, '0')}</span>{source?.title}</h3>
                  <label>
                    <span>这是什么</span>
                    <AutoGrowTextarea
                      value={selected.what}
                      placeholder="用一句话说明这个作品是什么"
                      onChange={(event) => updateSelectedWork(selected.workId, { what: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>解决了什么问题</span>
                    <AutoGrowTextarea
                      value={selected.problem}
                      placeholder="它解决了什么具体问题"
                      onChange={(event) => updateSelectedWork(selected.workId, { problem: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>证明了什么</span>
                    <AutoGrowTextarea
                      value={selected.proof}
                      placeholder="它能证明你的什么能力或判断"
                      onChange={(event) => updateSelectedWork(selected.workId, { proof: event.target.value })}
                    />
                  </label>
                </article>
              );
            }) : <p className="empty-inline">先在上方选择 1–3 个作品。</p>}
          </div>
        </div>
      </section>

      <section className="single-task-block trust-boundary-block">
        <span className="task-number">03</span>
        <div>
          <h2>写清楚你的承诺边界</h2>
          <p className="boundary-example">例如：我不承诺某篇内容爆，也不承诺立刻成交；但我能帮你先把“别人为什么该找你”这件事说清楚。</p>
          <div className="boundary-fields">
            <label>
              <span>我不承诺</span>
              <AutoGrowTextarea
                value={notPromise}
                placeholder="例如：某篇内容一定爆、立刻成交"
                onChange={(event) => updateBoundary('notPromise', event.target.value)}
              />
            </label>
            <label>
              <span>但我能帮你</span>
              <AutoGrowTextarea
                value={canHelp}
                placeholder="例如：先把别人为什么该找你说清楚"
                onChange={(event) => updateBoundary('canHelp', event.target.value)}
              />
            </label>
          </div>
        </div>
      </section>

      <div className="trust-generate-action">
        <button className="main-button" type="button" disabled={!selectedWorks.length} onClick={generateTrustPage}>
          生成“为什么能信我” →
        </button>
      </div>

      <section className="trust-page-result">
        <h2>为什么能信我</h2>
        <AutoGrowTextarea
          value={trustPage}
          placeholder="点击上方按钮后，会把你前面填写的内容拼成一整段话。"
          onChange={(event) => onAnswer('trustPage', event.target.value)}
        />
        <span>{trustPage.length} 字</span>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={() => onSubmit(missingIds)}>
          保存，进入第 15 关 →
        </button>
      </div>
    </div>
  );
}

function DayFourteenMergedPage({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="single-day-form merged-day-form">
      <p>这一关的内容已经合并到第 13 关。</p>
      <div>
        <button className="secondary-button" type="button" onClick={onBack}>查看第 13 关</button>
        <button className="main-button" type="button" onClick={onContinue}>进入第 15 关 →</button>
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
      {day.day > 7 && <div className="preview-output">完成后会留下：{day.output}</div>}
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
  answers: AnswerMap,
  completed: BooleanMap,
  deferred: BooleanMap,
  firstIncomplete: number,
) {
  if (completed[String(dayNumber)]) {
    if (dayNumber === 10 && answers[keyFor(10, 'feedbackStatus')] === 'waiting') return '反馈待补充';
    return hasDeferredDay(deferred, dayNumber) ? '待补充' : '已完成';
  }
  if (dayNumber === firstIncomplete) return '进行中';
  return dayNumber > firstIncomplete ? '可预览' : '未完成';
}

function DaySidebar({
  currentDay,
  answers,
  completed,
  deferred,
  firstIncomplete,
  onHome,
  onSelect,
}: {
  currentDay: number;
  answers: AnswerMap;
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
            <h2><span>第{['一', '二', '三', '四'][stage.id - 1]}周</span>{stage.shortName}</h2>
            {days.filter((day) => day.stage === stage.id).map((day) => {
              const status = dayStatus(day.day, answers, completed, deferred, firstIncomplete);
              return (
                <button
                  type="button"
                  key={day.day}
                  className={`${day.day === currentDay ? 'is-current ' : ''}${status === '已完成' ? 'is-complete ' : ''}${status.includes('待补充') ? 'is-partial' : ''}`}
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
  answers,
  completed,
  deferred,
  firstIncomplete,
  onClose,
  onSelect,
}: {
  open: boolean;
  answers: AnswerMap;
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
            const status = dayStatus(day.day, answers, completed, deferred, firstIncomplete);
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
