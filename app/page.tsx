'use client';

import { useEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react';
import { days, stages, type Day, type Prompt } from './curriculum';
import {
  createProgressSnapshot,
  downloadProgressBackup,
  loadLatestSnapshot,
  loadLocalProgress,
  readProgressBackup,
  saveLocalProgress,
  type LocalProgressState,
} from './local-progress';

type View =
  | 'intro'
  | 'overview'
  | 'week-one-start'
  | 'day'
  | 'week-checklist'
  | 'week-complete'
  | 'week-two-checklist'
  | 'week-two-complete'
  | 'week-three-checklist'
  | 'week-three-complete'
  | 'week-four-checklist'
  | 'program-complete';
type AnswerMap = Record<string, string>;
type BooleanMap = Record<string, boolean>;

type SavedState = LocalProgressState;

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

type PurchaseEvidence = {
  id: string;
  title: string;
  proof: string;
};

type BuyerTestRecord = {
  id: string;
  name: string;
  feedback: string;
};

type ContentWritingSection = {
  id: string;
  label: string;
  placeholder: string;
};

type ContentWritingConfig = {
  name: string;
  purpose: string;
  formulaLabel: string;
  formula: string;
  titleId: string;
  titlePlaceholder: string;
  examples: string[];
  sections: ContentWritingSection[];
};

type FlowStep =
  | { kind: 'prompt'; prompt: Prompt }
  | { kind: 'clarity' }
  | SelectionStep
  | { kind: 'action'; text: string };

const keyFor = (day: number, id: string) => `${day}:${id}`;
const MERGED_DAY_NUMBERS = new Set([12, 14]);
const visibleDays = days.filter((day) => !MERGED_DAY_NUMBERS.has(day.day));
const weekNames = ['第一周', '第二周', '第三周', '第四周'];

function getVisibleStep(dayNumber: number) {
  const day = days.find((item) => item.day === dayNumber) ?? days[0];
  const stageDays = visibleDays.filter((item) => item.stage === day.stage);
  const index = Math.max(0, stageDays.findIndex((item) => item.day === dayNumber));
  return {
    stage: day.stage,
    index: index + 1,
    total: stageDays.length,
    label: `${day.stage}.${index + 1}`,
    weekName: weekNames[day.stage - 1],
  };
}

function nextVisibleDayNumber(dayNumber: number) {
  const index = visibleDays.findIndex((day) => day.day === dayNumber);
  return index >= 0 ? visibleDays[index + 1]?.day : undefined;
}

function visibleProgressIndex(dayNumber: number) {
  const index = visibleDays.findIndex((day) => day.day === dayNumber);
  return index >= 0 ? index + 1 : 1;
}

const clarityQuestions = [
  { id: 'clarityWho', label: '别人能看出你主要在帮助谁吗？' },
  { id: 'clarityProblem', label: '别人能看出你可以解决什么问题吗？' },
  { id: 'clarityTiming', label: '别人知道什么时候可以来找你吗？' },
];

const contentWritingConfigs: Record<number, ContentWritingConfig> = {
  15: {
    name: '问题型内容',
    purpose: '让读者觉得“这说的就是我”',
    formulaLabel: '标题句式',
    formula: '你不是____，你是____。',
    titleId: 'problemTitle',
    titlePlaceholder: '例如：你不是缺流量，你是还没有说清楚别人为什么该找你',
    examples: [
      '你不是没有才华，别人只是还看不懂你能解决什么问题。',
      '你不是缺流量，你是还没有说清楚别人为什么该找你。',
      '你不是不会写，你是还没有找到一个具体问题开始。',
    ],
    sections: [
      { id: 'problemBelief', label: '第一段：写读者以为的问题', placeholder: '例如：我一直没有客户，是因为我的流量太少。' },
      { id: 'problemTruth', label: '第二段：写真正的问题', placeholder: '例如：真正的问题不是流量，而是别人还看不懂我能解决什么。' },
      { id: 'problemReason', label: '第三段：写你为什么这样判断', placeholder: '例如：我看过很多人持续发内容，却仍然没有收到具体咨询。' },
      { id: 'problemAction', label: '第四段：写他现在先做什么', placeholder: '例如：先用一句话写清楚你帮谁、解决什么问题。' },
    ],
  },
  16: {
    name: '判断型内容',
    purpose: '让读者知道当你遇到这件事，你会怎么选',
    formulaLabel: '标题句式',
    formula: '别先____，先____。',
    titleId: 'judgmentTitle',
    titlePlaceholder: '例如：别先追热点，先写清楚你帮谁',
    examples: [
      '别先追热点，先写清楚你帮谁。',
      '别先做完整课程，先验证别人愿不愿意为一个小结果付费。',
      '别先发更多内容，先看看别人为什么没有继续问。',
    ],
    sections: [
      { id: 'judgmentCommon', label: '第一段：写大多数人会怎么做', placeholder: '例如：没有客户时，很多人会先追热点、增加更新频率。' },
      { id: 'judgmentProblem', label: '第二段：写这样做的问题是什么', placeholder: '例如：如果价值没有说清，更多流量只会让更多人看完后离开。' },
      { id: 'judgmentAdvice', label: '第三段：写你现在更建议怎么做', placeholder: '例如：我更建议先确定要反复回答的一个问题，再选平台和选题。' },
      { id: 'judgmentAction', label: '第四段：给一个具体动作', placeholder: '例如：今天先写出你最想帮助的一类人，以及他最急的一个问题。' },
    ],
  },
  17: {
    name: '故事型内容',
    purpose: '让读者知道你的判断从哪里来',
    formulaLabel: '正文结构',
    formula: '我以前____，后来我发现____，所以我现在____。',
    titleId: 'storyTitle',
    titlePlaceholder: '例如：我为什么不再先追热点',
    examples: [
      '我以前以为写不出来是没有灵感，后来我发现真正的问题是没有明确的问题和素材，所以我现在会先确定问题，再开始写。',
      '我以前总想等准备充分再做产品，后来我发现真实反馈只能来自一个能使用的版本，所以我现在会先做最小版本。',
      '我以前以为客户嫌贵是价格问题，后来我发现是结果没有说清楚，所以我现在会先解释客户最终能得到什么。',
    ],
    sections: [
      { id: 'storyBefore', label: '第一段：写“我以前……”', placeholder: '例如：我以前以为内容做不好，是因为选题不够好。' },
      { id: 'storyDiscovery', label: '第二段：写“后来我发现……”', placeholder: '例如：后来做了很多项目，我发现很多内容问题发生得更早：价值根本没有说清楚。' },
      { id: 'storyNow', label: '第三段：写“所以我现在……”', placeholder: '例如：所以我现在写内容前，会先问这篇到底为谁解决什么问题。' },
    ],
  },
  18: {
    name: '证据型内容',
    purpose: '让读者相信你不是只会说，你真的做过',
    formulaLabel: '正文结构',
    formula: '我做过____；它解决了____；它让我形成了____；这个判断对你意味着____。',
    titleId: 'evidenceTitle',
    titlePlaceholder: '例如：做完这份工作清单后，我更确定流程比提醒有用',
    examples: [
      '我整理过一份新人工作清单，它解决了重复询问的问题，也让我更确定：好的流程应该让人能够自己往下走。',
      '我连续写过 100 篇文章，它让我发现稳定表达不是等待灵感，而是不断回答真实问题。',
      '我帮朋友改过多份简历，这让我发现很多人不是没有经历，而是没有把经历和岗位需要连接起来。',
    ],
    sections: [
      { id: 'contentEvidenceDid', label: '第一段：写我做过什么', placeholder: '例如：我整理过一份新人工作清单，把入职后最常遇到的任务排成了步骤。' },
      { id: 'contentEvidenceSolved', label: '第二段：写它解决了什么问题', placeholder: '例如：它减少了新人反复询问、负责人反复解释的问题。' },
      { id: 'contentEvidenceJudgment', label: '第三段：写它让我形成了什么判断', placeholder: '例如：这件事让我更确定，好流程不是多提醒，而是让人能自己往下走。' },
      { id: 'contentEvidenceUse', label: '第四段：写这个判断对读者有什么用', placeholder: '例如：如果你的团队总在重复回答同类问题，先把第一次交付拆成清单。' },
    ],
  },
  19: {
    name: '产品入口型内容',
    purpose: '让读者知道怎么买你',
    formulaLabel: '正文结构',
    formula: '谁适合 → 现在卡在哪里 → 不解决会继续发生什么 → 我能帮你完成哪一步 → 交付什么 → 不适合谁 → 怎么开始',
    titleId: 'offerTitle',
    titlePlaceholder: '例如：如果你的服务很好，但客户还是看不懂你具体做什么',
    examples: [
      '如果你想开始做自媒体，却一直不知道第一条视频拍什么，我可以陪你完成选题、脚本和第一次拍摄。',
      '如果你做过很多项目，却说不清自己的优势，我可以帮你整理出一份清楚的服务说明。',
      '如果你总有目标却执行不下去，我可以帮你把目标拆成一周可以完成的具体安排。',
    ],
    sections: [
      { id: 'offerFit', label: '第一段：写谁适合', placeholder: '例如：这项服务适合已经有一些经验，却始终说不清自己能帮谁的独立顾问。' },
      { id: 'offerProblem', label: '第二段：写他现在卡在哪里', placeholder: '例如：你做过很多项目，但每次自我介绍时还是只能列一堆标签。' },
      { id: 'offerCost', label: '第三段：写这件事不解决会继续发生什么', placeholder: '例如：别人看完仍然不知道什么时候该找你，内容只能换来点赞，很难换来具体咨询。' },
      { id: 'offerHelp', label: '第四段：写我能帮你完成哪一步', placeholder: '例如：我可以帮你把零散经验整理成一份能直接发给客户的服务说明。' },
      { id: 'offerDeliverable', label: '第五段：写具体交付什么', placeholder: '例如：结束后，你会得到一句服务介绍、三个客户痛点和一页完整的服务说明。' },
      { id: 'offerNotFit', label: '第六段：写不适合谁', placeholder: '例如：如果你还没有任何想要提供的能力或服务，这一版暂时不适合你。' },
      { id: 'offerStart', label: '第七段：写怎么开始', placeholder: '例如：如果你想开始，请把你现在的自我介绍发给我，我会先判断这项服务是否适合你。' },
    ],
  },
};

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

function parseRepresentativeWorkDrafts(
  value: string,
  works: WorkEvidence[],
  selectedWorks: RepresentativeWork[],
): RepresentativeWork[] {
  let storedDrafts: RepresentativeWork[] = [];
  if (value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        storedDrafts = parsed.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const candidate = item as Partial<RepresentativeWork>;
          return typeof candidate.workId === 'string' ? [{
            workId: candidate.workId,
            what: typeof candidate.what === 'string' ? candidate.what : '',
            problem: typeof candidate.problem === 'string' ? candidate.problem : '',
            proof: typeof candidate.proof === 'string' ? candidate.proof : '',
          }] : [];
        });
      }
    } catch {
      storedDrafts = [];
    }
  }

  return works.map((work) => {
    const saved = storedDrafts.find((item) => item.workId === work.id)
      ?? selectedWorks.find((item) => item.workId === work.id);
    return {
      workId: work.id,
      what: saved?.what || work.title,
      problem: saved?.problem || work.problem,
      proof: saved?.proof || work.proof,
    };
  });
}

function nextRecordId(prefix: string, records: Array<{ id: string }>) {
  let index = records.length + 1;
  while (records.some((record) => record.id === `${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function parsePurchaseEvidence(value: string, fallback: PurchaseEvidence[]): PurchaseEvidence[] {
  if (value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item, index) => {
          if (!item || typeof item !== 'object') return [];
          const candidate = item as Partial<PurchaseEvidence>;
          return [{
            id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `purchase-evidence-${index + 1}`,
            title: typeof candidate.title === 'string' ? candidate.title : '',
            proof: typeof candidate.proof === 'string' ? candidate.proof : '',
          }];
        });
      }
    } catch {
      return [{ id: 'purchase-evidence-1', title: value, proof: '' }];
    }
  }
  return fallback;
}

function parseBuyerTestRecords(value: string): BuyerTestRecord[] {
  if (value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item, index) => {
          if (!item || typeof item !== 'object') return [];
          const candidate = item as Partial<BuyerTestRecord>;
          return [{
            id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `buyer-${index + 1}`,
            name: typeof candidate.name === 'string' ? candidate.name : '',
            feedback: typeof candidate.feedback === 'string' ? candidate.feedback : '',
          }];
        });
      }
    } catch {
      return [{ id: 'buyer-1', name: '', feedback: value }];
    }
  }
  return [];
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

    if (day.day >= 22) return;

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
      <section className="week-checklist-card week-two-checklist-card">
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

function WeekThreeChecklistPage({
  items,
  onContinue,
}: {
  items: WeekTwoChecklistItem[];
  onContinue: () => void;
}) {
  return (
    <main className="week-transition-page week-checklist-page">
      <section className="week-checklist-card week-two-checklist-card week-three-checklist-card">
        <header className="week-checklist-heading">
          <span>WEEK 03 · CHECKLIST</span>
          <h1>第三周结束，请检查你已经写好的内容：</h1>
          <p>这 5 篇内容会成为你发布测试、建立连接和制作购买入口的素材。</p>
        </header>
        <div className="week-checklist-list week-two-checklist-list week-three-checklist-list">
          {items.map((item, index) => (
            <details className={`week-three-checklist-item ${item.value.trim() ? 'is-ready' : 'is-missing'}`} key={item.label}>
              <summary>
                <div className="week-checklist-label">
                  <span>0{index + 1}</span>
                  <div>
                    <h2>{item.label}：</h2>
                    <small>{item.value.trim() ? 'READY' : '待补充'}</small>
                  </div>
                  <span className="week-checklist-toggle">
                    <span className="when-closed">展开</span>
                    <span className="when-open">收起</span>
                  </span>
                </div>
              </summary>
              <div className="week-three-checklist-content">
                <p>{item.value || '这一项目前还没有内容，可以之后回到对应关卡补充。'}</p>
              </div>
            </details>
          ))}
        </div>
        <footer className="week-checklist-actions">
          <button className="main-button" type="button" onClick={onContinue}>
            确认，查看第三周成果 <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

function WeekFourChecklistPage({
  items,
  onContinue,
}: {
  items: WeekTwoChecklistItem[];
  onContinue: () => void;
}) {
  return (
    <main className="week-transition-page week-checklist-page">
      <section className="week-checklist-card week-two-checklist-card week-three-checklist-card week-four-checklist-card">
        <header className="week-checklist-heading">
          <span>WEEK 04 · CHECKLIST</span>
          <h1>第四周结束，请检查你的第一版是否已经 ready：</h1>
          <p>这些内容共同组成一页可以被看见、理解和购买的入口。</p>
        </header>
        <div className="week-checklist-list week-two-checklist-list week-three-checklist-list">
          {items.map((item, index) => (
            <details className={`week-three-checklist-item ${item.value.trim() ? 'is-ready' : 'is-missing'}`} key={item.label}>
              <summary>
                <div className="week-checklist-label">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{item.label}：</h2>
                    <small>{item.value.trim() ? 'READY' : '待补充'}</small>
                  </div>
                  <span className="week-checklist-toggle">
                    <span className="when-closed">展开</span>
                    <span className="when-open">收起</span>
                  </span>
                </div>
              </summary>
              <div className="week-three-checklist-content">
                <p>{item.value || '这一项目前还没有内容，可以之后回到对应关卡补充。'}</p>
              </div>
            </details>
          ))}
        </div>
        <footer className="week-checklist-actions">
          <button className="main-button" type="button" onClick={onContinue}>
            确认，查看四周成果 <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

function DataSafetyDialog({
  open,
  saveStatus,
  lastSavedAt,
  message,
  onClose,
  onDownload,
  onRestore,
  onImport,
}: {
  open: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string;
  message: string;
  onClose: () => void;
  onDownload: () => void;
  onRestore: () => void;
  onImport: (file: File) => void;
}) {
  if (!open) return null;
  const statusText = saveStatus === 'saving'
    ? '正在保存到本机……'
    : saveStatus === 'error'
      ? '本机保存失败，请立即下载备份。'
      : lastSavedAt
        ? `已保存到本机 · ${new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
        : '内容会自动保存在当前设备和浏览器中。';

  return (
    <div className="data-safety-overlay" role="dialog" aria-modal="true" aria-labelledby="data-safety-title">
      <section className="data-safety-dialog">
        <header>
          <div>
            <span>LOCAL BACKUP</span>
            <h2 id="data-safety-title">备份与恢复</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭备份与恢复">关闭</button>
        </header>
        <p className="data-safety-intro">你的内容不会上传。网页会自动保存当前进度、保留最近的本机快照；下载备份文件后，也可以在其他设备上导入。</p>
        <p className={`data-save-status is-${saveStatus}`}>{statusText}</p>
        <div className="data-safety-actions">
          <button className="main-button" type="button" onClick={onDownload}>下载全部备份</button>
          <label className="secondary-button data-import-button">
            导入备份
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = '';
              }}
            />
          </label>
          <button className="secondary-button" type="button" onClick={onRestore}>恢复最近快照</button>
        </div>
        <p className="data-safety-warning">清理浏览器数据前，请先下载备份文件。</p>
        {message && <p className="data-safety-message" role="status">{message}</p>}
      </section>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>('intro');
  const [currentDay, setCurrentDay] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [completed, setCompleted] = useState<BooleanMap>({});
  const [deferred, setDeferred] = useState<BooleanMap>({});
  const [hydrated, setHydrated] = useState(false);

  const activeDay = days[currentDay - 1];
  const activeStage = stages[activeDay.stage - 1];
  const flow = useMemo(() => getFlow(activeDay), [activeDay]);
  const completedCount = visibleDays.filter((day) => completed[String(day.day)]).length;
  const firstIncomplete = visibleDays.find((day) => !completed[String(day.day)])?.day ?? 30;
  const activeStep = getVisibleStep(currentDay);
  const activeDayIsPartial = (
    currentDay === 10 && answers[keyFor(10, 'feedbackStatus')] === 'waiting'
  ) || (
    currentDay === 28 && answers[keyFor(28, 'buyerTestStatus')] === 'waiting'
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
      label: '一组从经验中提炼出的判断',
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
  const weekThreeChecklist: WeekTwoChecklistItem[] = Object.entries(contentWritingConfigs).map(([day, config]) => {
    const dayNumber = Number(day);
    const finalArticle = answers[keyFor(20, `finalArticle${dayNumber}`)];
    const mergedDraft = [
      answers[keyFor(dayNumber, config.titleId)]?.trim() ?? '',
      ...config.sections.map((section) => answers[keyFor(dayNumber, section.id)]?.trim() ?? ''),
    ].filter(Boolean).join('\n\n');
    return {
      label: config.name,
      value: finalArticle === undefined ? mergedDraft : finalArticle,
    };
  });
  const weekFourBuyerRecords = parseBuyerTestRecords(answers[keyFor(28, 'purchaseResults')] ?? '');
  const weekFourEvidence = parsePurchaseEvidence(answers[keyFor(27, 'offerEvidence')] ?? '', []);
  const weekFourChecklist: WeekTwoChecklistItem[] = [
    {
      label: '一个明确、现在能够交付的小产品',
      value: answers[keyFor(22, 'chosenOffer')] ?? '',
    },
    {
      label: '清楚的适合对象与不适合对象',
      value: [
        answers[keyFor(23, 'fitAudience')] ? `适合：${answers[keyFor(23, 'fitAudience')]}` : '',
        answers[keyFor(23, 'notFitAudience')] ? `不适合：${answers[keyFor(23, 'notFitAudience')]}` : '',
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: '具体问题与交付物',
      value: [
        answers[keyFor(24, 'offerProblem')] ? `解决：${answers[keyFor(24, 'offerProblem')]}` : '',
        answers[keyFor(24, 'deliverables')] ? `交付：\n${answers[keyFor(24, 'deliverables')]}` : '',
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: '服务流程、边界与价格',
      value: [
        answers[keyFor(25, 'process')] ? `流程：\n${answers[keyFor(25, 'process')]}` : '',
        answers[keyFor(25, 'excluded')] ? `边界：\n${answers[keyFor(25, 'excluded')]}` : '',
        answers[keyFor(26, 'price')] ? `价格：${answers[keyFor(26, 'price')]}` : '',
        answers[keyFor(26, 'priceRationale')] ?? '',
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: '与这次购买最相关的证据',
      value: weekFourEvidence.map((item) => [item.title, item.proof ? `证明：${item.proof}` : ''].filter(Boolean).join('\n')).join('\n\n'),
    },
    {
      label: '一页可以直接发出的购买入口',
      value: firstFilled(
        answers[keyFor(30, 'finalPurchasePage')],
        answers[keyFor(29, 'purchasePageFinal')],
        answers[keyFor(27, 'purchasePageDraft')],
      ),
    },
    {
      label: '真实购买测试与反馈',
      value: weekFourBuyerRecords.map((record) => `${record.name || '未命名对象'}：${record.feedback || '等待反馈'}`).join('\n\n'),
    },
  ];

  /* eslint-disable react-hooks/set-state-in-effect -- restoring and reporting device-local progress is intentional */
  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const saved = await loadLocalProgress();
        if (active && saved) {
        const reconciled = reconcileSavedProgress(saved);
        const savedAnswers = reconciled.answers;
        const savedCompleted = reconciled.completed;
        const savedDeferred = reconciled.deferred;
        const nextDay = visibleDays.find((day) => !savedCompleted[String(day.day)]);
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
        if (active) setBackupMessage('没有读取到可用的本地进度，可以导入以前下载的备份。');
      } finally {
        if (active) setHydrated(true);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      void saveLocalProgress({ answers, completed, deferred, currentDay })
        .then((savedAt) => {
          setLastSavedAt(savedAt);
          setSaveStatus('saved');
        })
        .catch(() => {
          setSaveStatus('error');
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [answers, completed, currentDay, deferred, hydrated]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  useEffect(() => {
    if (view !== 'day' || !window.matchMedia('(max-width: 900px)').matches) return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentDay, view]);

  useEffect(() => {
    if (!backupOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBackupOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', close);
    };
  }, [backupOpen]);

  const progressState = (answerOverrides: AnswerMap = {}): SavedState => ({
    answers: { ...answers, ...answerOverrides },
    completed,
    deferred,
    currentDay,
  });

  const applyProgressState = (saved: SavedState, message: string) => {
    const reconciled = reconcileSavedProgress(saved);
    const nextDay = visibleDays.find((day) => !reconciled.completed[String(day.day)]);
    const resumeDay = nextDay?.day ?? 30;
    setAnswers(reconciled.answers);
    setCompleted(reconciled.completed);
    setDeferred(reconciled.deferred);
    setCurrentDay(resumeDay);
    setPreviewMode(false);
    setLevelsOpen(false);
    setBackupOpen(false);
    setBackupMessage(message);
    setView(nextDay ? 'day' : 'overview');
    window.scrollTo({ top: 0 });
  };

  const createManualBackup = async (label: string, download: boolean, answerOverrides: AnswerMap = {}) => {
    const state = progressState(answerOverrides);
    if (Object.keys(answerOverrides).length) setAnswers(state.answers ?? {});
    setSaveStatus('saving');
    let fileDownloaded = false;
    if (download) {
      try {
        downloadProgressBackup(state, label);
        fileDownloaded = true;
      } catch {
        fileDownloaded = false;
      }
    }
    try {
      const envelope = await createProgressSnapshot(state, label);
      setLastSavedAt(envelope.savedAt);
      setSaveStatus('saved');
      setBackupMessage(download
        ? fileDownloaded
          ? '备份文件已下载，同时已保存一份本机快照。'
          : '本机快照已保存，但浏览器没有完成文件下载，请再试一次。'
        : '已保存一份本机快照。');
    } catch {
      setSaveStatus('error');
      setBackupMessage(fileDownloaded
        ? '备份文件已下载，但本机快照保存失败，请保留刚刚下载的文件。'
        : '备份失败，请检查浏览器是否允许本地存储或文件下载。');
    }
  };

  const importBackup = async (file: File) => {
    try {
      const envelope = await readProgressBackup(file);
      if (!window.confirm('导入后会用备份内容替换当前页面中的进度，是否继续？')) return;
      await createProgressSnapshot(envelope.state, `导入：${envelope.label}`);
      applyProgressState(envelope.state, `已导入 ${new Date(envelope.savedAt).toLocaleString('zh-CN')} 的备份。`);
    } catch {
      setBackupMessage('无法导入：请选择由本工具导出的 JSON 备份文件。');
    }
  };

  const restorePreviousSnapshot = async () => {
    try {
      const snapshot = await loadLatestSnapshot();
      if (!snapshot) {
        setBackupMessage('目前还没有可以恢复的本机快照。');
        return;
      }
      if (!window.confirm(`将恢复“${snapshot.label}”（${new Date(snapshot.savedAt).toLocaleString('zh-CN')}），是否继续？`)) return;
      applyProgressState(snapshot.state, `已恢复“${snapshot.label}”。`);
    } catch {
      setBackupMessage('没有找到可恢复的本机快照。');
    }
  };

  const navigateToDay = (dayNumber: number) => {
    setCurrentDay(dayNumber);
    setPreviewMode(false);
    setLevelsOpen(false);
    setView('day');
    window.scrollTo({ top: 0 });
  };

  const navigateToStage = (stageId: number) => {
    setLevelsOpen(false);
    setPreviewMode(false);
    if (stageId === 1) {
      navigateToDay(1);
      return;
    }
    setView(
      stageId === 2
        ? 'week-checklist'
        : stageId === 3
          ? 'week-two-checklist'
          : 'week-three-checklist',
    );
    window.scrollTo({ top: 0 });
  };

  const setAnswer = (id: string, value: string) => {
    const previousValue = answers[keyFor(currentDay, id)] ?? '';
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
    if (completedCount === 0) {
      setView('week-one-start');
      window.scrollTo({ top: 0 });
    } else if (completedCount === visibleDays.length) {
      navigateToDay(1);
    } else {
      navigateToDay(firstIncomplete);
    }
  };

  const finishCurrentDay = (
    missingIds: string[],
    options?: { answerOverrides?: AnswerMap; snapshotLabel?: string },
  ) => {
    const missing = new Set(missingIds);
    const nextAnswers = { ...answers, ...(options?.answerOverrides ?? {}) };
    const nextDeferred = { ...deferred };
    if (currentDay >= 22 && currentDay <= 29) {
      Object.keys(nextDeferred).forEach((key) => {
        if (key.startsWith(`${currentDay}:`)) delete nextDeferred[key];
      });
      missingIds.forEach((id) => {
        nextDeferred[keyFor(currentDay, id)] = true;
      });
    } else {
      flow.forEach((step, index) => {
        const id = flowStepId(step, index);
        nextDeferred[keyFor(currentDay, id)] = missing.has(id);
      });
    }
    const nextCompleted = { ...completed, [String(currentDay)]: true };
    if (options?.answerOverrides) setAnswers(nextAnswers);
    setDeferred(nextDeferred);
    setCompleted(nextCompleted);
    if (options?.snapshotLabel) {
      setSaveStatus('saving');
      void createProgressSnapshot({
        answers: nextAnswers,
        completed: nextCompleted,
        deferred: nextDeferred,
        currentDay,
      }, options.snapshotLabel)
        .then((envelope) => {
          setLastSavedAt(envelope.savedAt);
          setSaveStatus('saved');
          setBackupMessage(`已保存“${options.snapshotLabel}”的本机快照。`);
        })
        .catch(() => {
          setSaveStatus('error');
          setBackupMessage('文章已保留在页面中，但创建独立快照失败，请立即下载备份。');
        });
    }
    if (currentDay === 30 && firstIncomplete < 30) {
      setCurrentDay(firstIncomplete);
      setPreviewMode(false);
      setView('day');
    } else if (currentDay < 30) {
      const nextVisibleDay = nextVisibleDayNumber(currentDay) ?? 30;
      setCurrentDay(nextVisibleDay);
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

  const finishThirdWeek = () => {
    setCompleted((previous) => ({ ...previous, '21': true }));
    setDeferred((previous) => {
      const next = { ...previous };
      Object.keys(next).forEach((key) => {
        if (key.startsWith('21:')) delete next[key];
      });
      return next;
    });
    setCurrentDay(22);
    setPreviewMode(false);
    setView('week-three-checklist');
    window.scrollTo({ top: 0 });
  };

  const finishFourthWeek = (status: 'waiting' | 'published', missingIds: string[]) => {
    const missing = new Set(missingIds);
    setDeferred((previous) => {
      const next = { ...previous };
      ['finalPurchasePage', 'launchLocations', 'launchCopy', 'marketResult'].forEach((id) => {
        next[keyFor(30, id)] = missing.has(id);
      });
      next[keyFor(30, 'marketResult')] = status === 'waiting' || missing.has('marketResult');
      return next;
    });
    setCompleted((previous) => ({ ...previous, '30': true }));
    setPreviewMode(false);
    setView('week-four-checklist');
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

  const backupDialog = (
    <DataSafetyDialog
      open={backupOpen}
      saveStatus={saveStatus}
      lastSavedAt={lastSavedAt}
      message={backupMessage}
      onClose={() => setBackupOpen(false)}
      onDownload={() => void createManualBackup('手动备份', true)}
      onRestore={() => void restorePreviousSnapshot()}
      onImport={(file) => void importBackup(file)}
    />
  );

  if (!hydrated) return <main className="mvp-home" aria-busy="true" />;

  if (view === 'intro') {
    return (
      <>
        <main className="mvp-home home-shell">
          <section className="editorial-home">
          <header className="home-masthead">
            <span>TALENT TO VALUE · 四周计划</span>
            <span>能力 → 服务 → 产品</span>
          </header>
          <div className="home-hero">
            <div className="home-hero-copy">
              <span className="home-eyebrow">一套可以真正动手完成的引导工具</span>
              <h1>教你如何把才华变成钱</h1>
              <p>把脑子里模糊的能力，一步步整理成别人看得懂、愿意相信、可以买到的服务或产品。</p>
            </div>
            <aside className="home-question-card" aria-label="你可能正在面对的问题">
              <span className="home-card-label">从你的真实需求开始</span>
              <ul className="pain-list">
                <li>你有没有想过把自己的能力变成一个服务或者一项产品？</li>
                <li>到底是什么阻碍了你？还是说你已经在做了但效果不好？</li>
                <li>今天我们可以通过这个工具来理清楚。</li>
              </ul>
            </aside>
            <button className="main-button home-start-button" type="button" onClick={() => setView('overview')}>
              开始 <span aria-hidden="true">→</span>
            </button>
          </div>
            <button className="data-safety-trigger" type="button" onClick={() => setBackupOpen(true)}>备份与恢复</button>
          </section>
        </main>
        {backupDialog}
      </>
    );
  }

  if (view === 'overview') {
    return (
      <>
        <main className="mvp-home overview-shell">
          <section className="overview-frame">
          <header className="home-masthead">
            <button type="button" onClick={() => setView('intro')}>← 返回首页</button>
            <span>THE ROUTE · 04 STAGES</span>
          </header>
          <div className="overview-heading">
            <h1>四步把才华变成钱</h1>
          </div>
          <div className="stage-card-grid">
            {stages.map((stage) => {
              const weekLabels = ['第一周', '第二周', '第三周', '第四周'];
              return (
                <article className={`stage-card stage-card-${stage.id}`} key={stage.id}>
                  <div className="stage-card-top">
                    <span>0{stage.id}</span>
                    <small>{weekLabels[stage.id - 1]}</small>
                  </div>
                  <h2>{stage.id === 1 ? <>一份清晰的服务<br />说明</> : stage.shortName}</h2>
                  <p>{stage.title}</p>
                </article>
              );
            })}
          </div>
          <div className="overview-actions overview-actions-only">
            <div className="home-actions">
              <button className="main-button" type="button" onClick={startOrContinue}>
                {completedCount === visibleDays.length
                  ? '进入 1.1'
                  : completedCount
                    ? `继续 ${getVisibleStep(firstIncomplete).label}`
                    : '进入 1.1'}
              </button>
              <button className="text-button" type="button" onClick={() => setLevelsOpen(true)}>
                查看全部步骤
              </button>
            </div>
          </div>
            <button className="data-safety-trigger" type="button" onClick={() => setBackupOpen(true)}>备份与恢复</button>
          </section>
          <LevelList
            open={levelsOpen}
            answers={answers}
            completed={completed}
            deferred={deferred}
            firstIncomplete={firstIncomplete}
            onClose={() => setLevelsOpen(false)}
            onSelect={navigateToDay}
            onBackup={() => {
              setLevelsOpen(false);
              setBackupOpen(true);
            }}
          />
        </main>
        {backupDialog}
      </>
    );
  }

  if (view === 'week-one-start') {
    return (
      <main className="week-transition-page week-complete-page">
        <section className="week-complete-card week-start-card">
          <span>WEEK 01 · START</span>
          <h1>让我们进入第一周的任务</h1>
          <div className="next-week-preview">
            <strong>第一周计划</strong>
            <p>这一周我们将回答用户“你能帮我解决什么问题？”的问题，结束后你将获得：</p>
            <ul>
              <li>一类本轮最想服务的客户</li>
              <li>1–3 个客户最想解决的问题</li>
              <li>一句清楚、容易被复述的自我介绍</li>
              <li>一句“为什么是我”的事实证据</li>
              <li>一份可以拿去测试的服务说明</li>
            </ul>
          </div>
          <button className="main-button next-week-button" type="button" onClick={() => navigateToDay(1)}>
            进入第一周 <span aria-hidden="true">→</span>
          </button>
        </section>
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
          <div className="next-week-preview">
            <strong>第二周计划</strong>
            <p>这一周我们将回答用户“我为什么信你？”的问题，结束后你将获得：</p>
            <ul>
              <li>一份作品与证据清单</li>
              <li>一组从经验中提炼出的判断</li>
              <li>1–3 个代表作品</li>
              <li>一页“为什么能信我”</li>
            </ul>
          </div>
          <button className="main-button next-week-button" type="button" onClick={() => navigateToDay(8)}>
            进入第二周 <span aria-hidden="true">→</span>
          </button>
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
          <div className="next-week-preview">
            <strong>第三周计划</strong>
            <p>这一周我们将创作五篇内容，来回答用户“<b>你看见了什么问题，又能给我什么帮助？</b>”的问题。结束后你将获得：</p>
            <ul>
              <li>1 篇问题型内容：让读者觉得“这说的就是我”</li>
              <li>1 篇判断型内容：让读者知道当你遇到这件事，你会怎么选</li>
              <li>1 篇故事型内容：让读者知道你的判断从哪里来</li>
              <li>1 篇证据型内容：让读者相信你不是只会说，你真的做过</li>
              <li>1 篇产品入口型内容：让读者知道怎么买你</li>
            </ul>
          </div>
          <button className="main-button next-week-button" type="button" onClick={() => navigateToDay(15)}>
            进入第三周 <span aria-hidden="true">→</span>
          </button>
        </section>
      </main>
    );
  }

  if (view === 'week-three-checklist') {
    return (
      <WeekThreeChecklistPage
        items={weekThreeChecklist}
        onContinue={() => setView('week-three-complete')}
      />
    );
  }

  if (view === 'week-three-complete') {
    return (
      <main className="week-transition-page week-complete-page">
        <section className="week-complete-card week-three-complete-card">
          <span>WEEK 03 · COMPLETE</span>
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
          <h1>恭喜你完成了第三周的任务</h1>
          <div className="next-week-preview week-four-preview">
            <strong>第四周计划</strong>
            <p>这一周我们将回答用户“现在怎么买，买完能得到什么？”的问题，结束后你将获得：</p>
            <ul>
              <li>一个现在就能够交付的最小产品</li>
              <li>清楚的适合对象与服务边界</li>
              <li>具体的交付方式、流程和价格</li>
              <li>一页可以直接发出去的购买入口</li>
              <li>一轮真实购买测试与修改</li>
            </ul>
          </div>
          <button className="main-button next-week-button" type="button" onClick={() => navigateToDay(22)}>
            进入第四周 <span aria-hidden="true">→</span>
          </button>
        </section>
      </main>
    );
  }

  if (view === 'week-four-checklist') {
    return (
      <WeekFourChecklistPage
        items={weekFourChecklist}
        onContinue={() => setView('program-complete')}
      />
    );
  }

  if (view === 'program-complete') {
    return (
      <main className="week-transition-page program-complete-page">
        <section className="program-complete-card">
          <span>FOUR WEEKS · COMPLETE</span>
          <div className="week-firework" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
            <b />
          </div>
          <h1>恭喜你完成了全部四周</h1>
          <p>你已经把一项能力整理成了第一版可以进入真实世界的产品。</p>
          <div className="program-result-list">
            <article><span>01</span><strong>一份清晰的服务说明</strong></article>
            <article><span>02</span><strong>一套可以被相信的证据</strong></article>
            <article><span>03</span><strong>五篇与用户建立连接的内容</strong></article>
            <article><span>04</span><strong>一页可以直接发布的购买入口</strong></article>
          </div>
          <p className="program-complete-note">这不是最终版，而是一版可以开始被看见、被询问和被购买的产品。</p>
          <div className="program-complete-actions">
            <button className="secondary-button" type="button" onClick={() => setView('overview')}>回到总览</button>
            <button className="secondary-button" type="button" onClick={() => void createManualBackup('四周最终成果', true)}>下载全部备份</button>
            <button className="main-button" type="button" onClick={() => navigateToDay(30)}>查看我的购买入口 →</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
    <main className="mvp-day">
      <DaySidebar
        currentDay={currentDay}
        answers={answers}
        completed={completed}
        deferred={deferred}
        firstIncomplete={firstIncomplete}
        onHome={() => setView('intro')}
        onSelectStage={navigateToStage}
        onSelect={navigateToDay}
        onBackup={() => setBackupOpen(true)}
      />

      <section className="day-workspace">
        <header className="day-header">
          <button className="mobile-menu-button" type="button" onClick={() => setLevelsOpen(true)}>☰ 目录</button>
          <button className="day-brand" type="button" onClick={() => setView('intro')}>把才华变成钱</button>
          <span>{activeStep.weekName} · {activeStep.index} / {activeStep.total}</span>
        </header>
        <div className="day-progress" aria-hidden="true">
          <span style={{ width: `${(visibleProgressIndex(currentDay) / visibleDays.length) * 100}%` }} />
        </div>

        <div className="day-scroll">
          <div className="day-sheet">
          <section className={`day-orientation day-orientation-${currentDay}`}>
            <div className="day-kicker-row">
              <span>第 {activeStage.id} 周 · {activeStage.title}</span>
              {activeDayIsPartial && (
                <strong>{(
                  (currentDay === 10 && answers[keyFor(10, 'feedbackStatus')] === 'waiting')
                  || (currentDay === 28 && answers[keyFor(28, 'buyerTestStatus')] === 'waiting')
                ) ? '反馈待补充' : '待补充'}</strong>
              )}
            </div>
            <h1>{activeDay.title}</h1>
            {currentDay === 5 ? (
              <div className="day-orientation-copy day-orientation-copy-single">
                <p>{activeDay.principle}</p>
              </div>
            ) : ![1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].includes(currentDay) && (
              <div className="day-orientation-copy">
                <p>{shortReason(activeDay)}</p>
                <strong>完成后：{activeDay.output}</strong>
              </div>
            )}
          </section>

          <section className="day-content">
            {currentDay >= 15 && currentDay <= 19 ? (
              <ThirdWeekWritingPage
                dayNumber={currentDay}
                answers={answers}
                previewMode={previewMode}
                firstIncomplete={firstIncomplete}
                onAnswer={setAnswer}
                onBackup={(answerOverrides, download) => createManualBackup(
                  `${getVisibleStep(currentDay).label} ${contentWritingConfigs[currentDay].name}`,
                  download,
                  answerOverrides,
                )}
                onSubmit={(missingIds, answerOverrides) => {
                  if (previewMode) navigateToDay(firstIncomplete);
                  else finishCurrentDay(missingIds, {
                    answerOverrides,
                    snapshotLabel: `${getVisibleStep(currentDay).label} ${contentWritingConfigs[currentDay].name}`,
                  });
                }}
              />
            ) : currentDay === 21 ? (
              <DayTwentyOnePublishPage
                buttonLabel={previewMode ? `返回 ${getVisibleStep(firstIncomplete).label}` : '进入下一关 →'}
                onSubmit={() => {
                  if (previewMode) navigateToDay(firstIncomplete);
                  else finishThirdWeek();
                }}
              />
            ) : currentDay >= 22 && currentDay <= 30 ? (
              <FourthWeekPage
                dayNumber={currentDay}
                answers={answers}
                previewMode={previewMode}
                firstIncomplete={firstIncomplete}
                onAnswer={setAnswer}
                onSubmit={(missingIds) => {
                  if (previewMode) navigateToDay(firstIncomplete);
                  else finishCurrentDay(missingIds);
                }}
                onFinish={(status, missingIds) => {
                  if (previewMode) navigateToDay(firstIncomplete);
                  else finishFourthWeek(status, missingIds);
                }}
              />
            ) : previewMode ? (
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
            ) : currentDay === 13 ? (
              <DayThirteenCombinedPage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={finishCombinedDaysThirteenAndFourteen}
              />
            ) : currentDay === 20 ? (
              <DayTwentyAuditPage
                answers={answers}
                onAnswer={setAnswer}
                onSubmit={(answerOverrides) => finishCurrentDay([], {
                  answerOverrides,
                  snapshotLabel: '3.6 五篇内容最终版',
                })}
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
        onBackup={() => {
          setLevelsOpen(false);
          setBackupOpen(true);
        }}
      />
    </main>
    {backupDialog}
    </>
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
          <p>注：需要猜或者追问，就要选“不清楚”</p>
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
          进入下一关 →
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
              <summary>查看我在 1.1 写的自我介绍</summary>
              <p className="saved-answer">{previousIntro}</p>
            </details>
          )}
        </div>
      </section>

      <div className="single-day-submit">
        <p>{hasDirection ? '之后的练习会先围绕这类人展开，随时可以回来修改。' : '暂时不确定也可以继续，这一关会标记为待补充。'}</p>
        <button className="main-button" type="button" onClick={onSubmit}>
          进入下一关 →
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
          <span>最想服务的客户是：</span>
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
          进入下一关 →
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
  const versions = uniqueLines(answers[keyFor(4, 'valueVersions')] ?? '');
  const removedVersions = uniqueLines(answers[keyFor(4, 'removedValueVersions')] ?? '')
    .filter((version) => versions.includes(version));
  const selectedValue = answers[keyFor(4, 'selectedValue')] ?? '';
  const [editingCandidate, setEditingCandidate] = useState('');
  const [candidateEdit, setCandidateEdit] = useState('');
  const draft = answers[keyFor(4, 'generatedDraft')] || selectedValue;
  const activeVersions = versions.filter((version) => !removedVersions.includes(version));
  const orderedVersions = [
    ...activeVersions,
    ...versions.filter((version) => removedVersions.includes(version)),
  ];
  const draftIsRemoved = removedVersions.includes(draft.trim());
  const draftIsActive = versions.includes(draft.trim()) && !draftIsRemoved;
  const missingIds = [
    !activeVersions.length ? 'valueVersions' : '',
    !selectedValue.trim() || !versions.includes(selectedValue.trim()) || removedVersions.includes(selectedValue.trim()) ? 'selectedValue' : '',
  ].filter(Boolean);

  const addCandidate = () => {
    const sentence = draft.trim();
    if (!sentence) return;
    if (removedVersions.includes(sentence)) {
      onAnswer('removedValueVersions', removedVersions.filter((version) => version !== sentence).join('\n'));
      return;
    }
    if (versions.includes(sentence) || activeVersions.length >= 10) return;
    onAnswer('valueVersions', [...versions, sentence].join('\n'));
  };

  const startCandidateEdit = (version: string) => {
    setEditingCandidate(version);
    setCandidateEdit(version);
  };

  const saveCandidateEdit = () => {
    const nextValue = candidateEdit.trim();
    if (!editingCandidate || !nextValue || (nextValue !== editingCandidate && versions.includes(nextValue))) return;
    onAnswer('valueVersions', versions.map((version) => version === editingCandidate ? nextValue : version).join('\n'));
    if (removedVersions.includes(editingCandidate)) {
      onAnswer('removedValueVersions', removedVersions.map((version) => version === editingCandidate ? nextValue : version).join('\n'));
    }
    if (selectedValue.trim() === editingCandidate) onAnswer('selectedValue', nextValue);
    if (draft.trim() === editingCandidate) onAnswer('generatedDraft', nextValue);
    setEditingCandidate('');
    setCandidateEdit('');
  };

  const removeCandidate = (version: string) => {
    if (removedVersions.includes(version)) return;
    onAnswer('removedValueVersions', [...removedVersions, version].join('\n'));
    if (selectedValue.trim() === version) onAnswer('selectedValue', '');
    if (editingCandidate === version) {
      setEditingCandidate('');
      setCandidateEdit('');
    }
  };

  return (
    <div className="single-day-form day-four-form">
      <section className="single-task-block compact-task-block">
        <span className="task-number">01</span>
        <div>
          <div className="answer-row">
            <span>最想服务的客户是：</span>
            <strong>{audience || '暂未填写'}</strong>
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">02</span>
        <div>
          <h2>开始造句（建议多写，要写得具体）</h2>
          <div className="sentence-formula" aria-label="自我介绍句子公式">
            <span>造句公式是：</span>
            <p>我帮助【本轮服务的人】解决【选择的问题】，让他能够【得到的结果】。</p>
          </div>
          <label className="sr-only" htmlFor="day-four-draft">编辑这句自我介绍</label>
          <textarea
            id="day-four-draft"
            className="candidate-draft-textarea"
            value={draft}
            placeholder="按照上面的公式写一句具体的价值句。"
            onChange={(event) => onAnswer('generatedDraft', event.target.value)}
          />
          <div className="center-action">
            <button
              className="secondary-button"
              type="button"
              disabled={!draft.trim() || draftIsActive || (activeVersions.length >= 10 && !draftIsRemoved)}
              onClick={addCandidate}
            >
              {draftIsRemoved ? <>重新加入候选池 <span aria-hidden="true">→</span></> : activeVersions.length >= 10 ? '候选池已满 10 条' : draftIsActive ? '已加入候选池' : <>加入候选池 <span aria-hidden="true">→</span></>}
            </button>
          </div>
        </div>
      </section>

      <section className="single-task-block">
        <span className="task-number">03</span>
        <div>
          <h2>候选池</h2>
          <p>先选一版你最想立刻开始的。</p>
          {versions.length ? (
            <div className="introduction-pool">
              {orderedVersions.map((version, index) => {
                const removed = removedVersions.includes(version);
                const editing = editingCandidate === version;
                return (
                <div
                  key={`${version}-${index}`}
                  className={`introduction-candidate${selectedValue.trim() === version ? ' selected' : ''}${removed ? ' removed' : ''}`}
                >
                  <span>{index + 1}</span>
                  {editing ? (
                    <input
                      type="text"
                      value={candidateEdit}
                      autoFocus
                      onChange={(event) => setCandidateEdit(event.target.value)}
                    />
                  ) : (
                    <button
                      className="candidate-select-button"
                      type="button"
                      disabled={removed}
                      aria-pressed={selectedValue.trim() === version}
                      onClick={() => onAnswer('selectedValue', version)}
                    >
                      <strong>{version}</strong>
                      <small>{removed ? '已移除' : selectedValue.trim() === version ? '最终选择' : '点击选择'}</small>
                    </button>
                  )}
                  <div className="candidate-actions">
                    {editing ? (
                      <>
                        <button type="button" onClick={saveCandidateEdit}>保存</button>
                        <button type="button" onClick={() => setEditingCandidate('')}>取消</button>
                      </>
                    ) : (
                      <>
                        <button type="button" disabled={removed} onClick={() => startCandidateEdit(version)}>编辑</button>
                        <button type="button" disabled={removed} onClick={() => removeCandidate(version)}>{removed ? '已移除' : '移除'}</button>
                      </>
                    )}
                  </div>
                </div>
              );})}
            </div>
          ) : (
            <p className="empty-inline">生成并完善句子后，把它加入候选池。</p>
          )}
        </div>
      </section>

      <div className="single-day-submit">
        <p>{missingIds.length ? `还有 ${missingIds.length} 项未确定，会标记为待补充。` : '这一关已经填写完整。'}</p>
        <button className="main-button" type="button" onClick={() => onSubmit(missingIds)}>
          进入下一关 →
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
  const selectedProblems = uniqueLines(answers[keyFor(3, 'topProblems')] ?? '');
  const allProblems = uniqueLines(answers[keyFor(3, 'problemCandidates')] ?? '');
  const problems = (selectedProblems.length ? selectedProblems : allProblems).slice(0, 3);
  const savedEvidenceSentence = answers[keyFor(5, 'evidenceSentence')] ?? '';
  const legacyReason = savedEvidenceSentence.includes('因为')
    ? savedEvidenceSentence.split('因为').slice(1).join('因为').replace(/[。.]$/, '')
    : savedEvidenceSentence.replace(/[。.]$/, '');
  const evidenceReason = answers[keyFor(5, 'evidenceReason')] ?? legacyReason;
  const evidenceSentence = evidenceReason.trim()
    ? problems[0]
      ? `我可以帮你解决“${problems[0]}”的问题，因为${evidenceReason.trim().replace(/[。.]$/, '')}。`
      : `我能做这件事，是因为${evidenceReason.trim().replace(/[。.]$/, '')}。`
    : '';
  const missingIds = [
    experience.trim() ? '' : 'evidenceFacts',
    evidenceSentence.trim() ? '' : 'evidenceSentence',
  ].filter(Boolean);

  const saveAndContinue = () => {
    onAnswer('evidenceReason', evidenceReason);
    onAnswer('evidenceSentence', evidenceSentence);
    onSubmit(missingIds);
  };

  return (
    <div className="single-day-form day-five-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>列出你的经验</h2>
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
          <h2>开始造句</h2>
          <div className="evidence-formula" aria-label="服务说明句子公式">
            <span>句子公式是：</span>
            <p>我帮【谁】，解决【什么问题】，让他能【得到什么结果】；</p>
            <p>我适合服务的人是【谁】；</p>
            <p>他们常见的问题是【问题 1】、【问题 2】、【问题 3】；</p>
            <p>我能做这件事，是因为【你的经验】。</p>
          </div>
          <label htmlFor="day-five-evidence">把最后一句证据写下来</label>
          <textarea
            id="day-five-evidence"
            className="evidence-sentence-textarea"
            value={evidenceReason}
            placeholder="例如：我结合自己的需求做过很多小产品，知道怎样让 AI 按照我的意思执行"
            onChange={(event) => onAnswer('evidenceReason', event.target.value)}
          />
        </div>
      </section>

      <div className="single-day-submit">
        <p>{missingIds.length ? '没写完也可以继续，这一关会标记为待补充。' : '你的服务现在有了一句可以被验证的实力证据。'}</p>
        <button className="main-button" type="button" onClick={saveAndContinue}>
          进入下一关 →
        </button>
      </div>
    </div>
  );
}

function StructuredServiceStatement({
  valueLine,
  fitAudience,
  problems,
  evidence,
  emptyText = '上面的答案会在这里自动拼成一段完整说明。',
}: {
  valueLine: string;
  fitAudience: string;
  problems: string[];
  evidence: string;
  emptyText?: string;
}) {
  return (
    <div className="structured-statement">
      <p className="statement-value-line">{valueLine || emptyText}</p>
      {fitAudience && (
        <div className="statement-detail-row">
          <strong>适合：</strong>
          <span>{fitAudience}</span>
        </div>
      )}
      {problems.length > 0 && (
        <div className="statement-detail-row statement-problem-row">
          <strong>常见卡点：</strong>
          <ul>
            {problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        </div>
      )}
      {evidence && <p className="statement-evidence-line">{evidence}</p>}
    </div>
  );
}

function parseStructuredServiceStatement(
  text: string,
  fallback: { valueLine: string; fitAudience: string; problems: string[]; evidence: string },
) {
  if (!text.trim()) return fallback;
  const lines = text.split('\n').map((line) => line.trim());
  const fitIndex = lines.findIndex((line) => /^适合[：:]/.test(line));
  const problemIndex = lines.findIndex((line) => /^常见卡点[：:]/.test(line));
  if (fitIndex < 0 || problemIndex < 0 || problemIndex <= fitIndex) return fallback;

  const valueLine = lines.slice(0, fitIndex).filter(Boolean).join(' ') || fallback.valueLine;
  const fitLead = lines[fitIndex].replace(/^适合[：:]\s*/, '');
  const fitAudience = [fitLead, ...lines.slice(fitIndex + 1, problemIndex)]
    .filter(Boolean)
    .join(' ') || fallback.fitAudience;
  const inlineProblems = lines[problemIndex].replace(/^常见卡点[：:]\s*/, '');
  const problemLines: string[] = inlineProblems
    ? inlineProblems.split(/[；;、]/).map((item) => item.trim()).filter(Boolean)
    : [];
  const evidenceLines: string[] = [];
  let reachedEvidence = false;
  lines.slice(problemIndex + 1).forEach((line) => {
    if (!line) return;
    if (!reachedEvidence && /^[·•*-]\s*/.test(line)) {
      problemLines.push(line.replace(/^[·•*-]\s*/, '').trim());
      return;
    }
    reachedEvidence = true;
    evidenceLines.push(line);
  });

  return {
    valueLine,
    fitAudience,
    problems: problemLines.length ? problemLines.slice(0, 3) : fallback.problems,
    evidence: evidenceLines.join(' ') || fallback.evidence,
  };
}

function formatStructuredServiceStatement({
  valueLine,
  fitAudience,
  problems,
  evidence,
}: {
  valueLine: string;
  fitAudience: string;
  problems: string[];
  evidence: string;
}) {
  return [
    valueLine.trim(),
    fitAudience.trim() ? `适合：${fitAudience.trim()}` : '',
    problems.length ? `常见卡点：\n${problems.map((problem) => `· ${problem}`).join('\n')}` : '',
    evidence.trim(),
  ].filter(Boolean).join('\n\n');
}

function StructuredServiceStatementEditor({
  valueLine,
  fitAudience,
  problems,
  evidence,
  onAnswer,
}: {
  valueLine: string;
  fitAudience: string;
  problems: string[];
  evidence: string;
  onAnswer: (id: string, value: string) => void;
}) {
  const problemValues = Array.from({ length: 3 }, (_, index) => problems[index] ?? '');
  return (
    <div className="structured-statement structured-statement-editor">
      <AutoGrowTextarea
        className="statement-value-editor"
        value={valueLine}
        aria-label="编辑服务介绍"
        onChange={(event) => onAnswer('statementValue', event.target.value)}
      />
      <div className="statement-detail-row">
        <strong>适合：</strong>
        <AutoGrowTextarea
          value={fitAudience}
          aria-label="编辑适合的人"
          onChange={(event) => onAnswer('statementFit', event.target.value)}
        />
      </div>
      <div className="statement-detail-row statement-problem-row">
        <strong>常见卡点：</strong>
        <div className="statement-problem-editor-list">
          {problemValues.map((problem, index) => (
            <input
              type="text"
              value={problem}
              aria-label={`编辑常见卡点 ${index + 1}`}
              placeholder={`常见卡点 ${index + 1}`}
              key={`statement-editor-problem-${index + 1}`}
              onChange={(event) => onAnswer(`statementProblem${index + 1}`, event.target.value)}
            />
          ))}
        </div>
      </div>
      <AutoGrowTextarea
        className="statement-evidence-editor"
        value={evidence}
        aria-label="编辑为什么是你"
        onChange={(event) => onAnswer('statementEvidence', event.target.value)}
      />
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
  const [editingStatement, setEditingStatement] = useState(false);
  const earlierProblems = uniqueLines(answers[keyFor(3, 'topProblems')] ?? '');
  const latestValueLine = answers[keyFor(4, 'selectedValue')]
    || answers[keyFor(4, 'generatedDraft')]
    || '';
  const latestFitAudience = answers[keyFor(2, 'selectedAudience')] ?? '';
  const latestEvidence = answers[keyFor(5, 'evidenceSentence')] ?? '';
  const valueLine = answers[keyFor(6, 'statementValue')]
    || latestValueLine
    || answers[keyFor(6, 'firstStatement')]
    || '';
  const fitAudience = answers[keyFor(6, 'statementFit')]
    || latestFitAudience;
  const problemValues = [0, 1, 2].map((index) => (
    answers[keyFor(6, `statementProblem${index + 1}`)] || earlierProblems[index] || ''
  ));
  const evidence = answers[keyFor(6, 'statementEvidence')]
    || latestEvidence;
  const optimizedStatement = answers[keyFor(6, 'optimizedStatement')] ?? '';
  const filledProblems = problemValues.map((item) => item.trim()).filter(Boolean);
  const baseStatement = { valueLine, fitAudience, problems: filledProblems, evidence };
  const visibleStatement = optimizedStatement.trim()
    ? parseStructuredServiceStatement(optimizedStatement, baseStatement)
    : baseStatement;
  const displayedStatement = formatStructuredServiceStatement(visibleStatement);
  const complete = Boolean(
    visibleStatement.valueLine.trim()
    && visibleStatement.fitAudience.trim()
    && visibleStatement.problems.length
    && visibleStatement.evidence.trim(),
  );

  const refreshFromPrevious = () => {
    if (!window.confirm('重新获取会替换当前服务说明中的内容，是否继续？')) return;
    onAnswer('statementValue', latestValueLine);
    onAnswer('statementFit', latestFitAudience);
    [0, 1, 2].forEach((index) => onAnswer(`statementProblem${index + 1}`, earlierProblems[index] ?? ''));
    onAnswer('statementEvidence', latestEvidence);
    onAnswer('optimizedStatement', '');
    onAnswer('firstStatement', '');
    setEditingStatement(false);
  };

  const saveAndContinue = () => {
    onAnswer('statementValue', visibleStatement.valueLine);
    onAnswer('statementFit', visibleStatement.fitAudience);
    Array.from({ length: 3 }, (_, index) => visibleStatement.problems[index] ?? '')
      .forEach((problem, index) => onAnswer(`statementProblem${index + 1}`, problem));
    onAnswer('statementEvidence', visibleStatement.evidence);
    onAnswer('optimizedStatement', '');
    onAnswer('firstStatement', displayedStatement);
    onSubmit(complete ? [] : ['firstStatement']);
  };

  return (
    <div className="single-day-form day-six-form">
      <section className="assembly-intro">
        <p>让我们一起看看目前你的答案，你可以进行措辞上的优化。</p>
        <button className="secondary-button refresh-previous-button" type="button" onClick={refreshFromPrevious}>
          重新获取前序数据 <span aria-hidden="true">↻</span>
        </button>
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
          <p>这里不写“我很专业”，而是放入 1.5 的事实证据：你做过什么，证明你有能力推进这个问题。</p>
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
            <StructuredServiceStatementEditor
              valueLine={valueLine}
              fitAudience={fitAudience}
              problems={filledProblems}
              evidence={evidence}
              onAnswer={onAnswer}
            />
          ) : (
            <StructuredServiceStatement
              valueLine={visibleStatement.valueLine}
              fitAudience={visibleStatement.fitAudience}
              problems={visibleStatement.problems}
              evidence={visibleStatement.evidence}
            />
          )}
          <span>{displayedStatement.length} 字</span>
        </div>
        <div className="statement-edit-actions">
          <button
            className="secondary-button edit-statement-button"
            type="button"
            disabled={!displayedStatement.trim()}
            onClick={() => {
              if (!editingStatement && optimizedStatement.trim()) {
                onAnswer('statementValue', visibleStatement.valueLine);
                onAnswer('statementFit', visibleStatement.fitAudience);
                Array.from({ length: 3 }, (_, index) => visibleStatement.problems[index] ?? '')
                  .forEach((problem, index) => onAnswer(`statementProblem${index + 1}`, problem));
                onAnswer('statementEvidence', visibleStatement.evidence);
                onAnswer('optimizedStatement', '');
              }
              setEditingStatement((previous) => !previous);
            }}
          >
            {editingStatement ? '完成编辑' : '编辑'}
          </button>
        </div>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={saveAndContinue}>
          进入下一关 →
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
  const earlierProblems = uniqueLines(answers[keyFor(3, 'topProblems')] ?? '');
  const statementValue = answers[keyFor(6, 'statementValue')]
    || answers[keyFor(4, 'selectedValue')]
    || answers[keyFor(4, 'generatedDraft')]
    || '';
  const statementAudience = answers[keyFor(6, 'statementFit')]
    || answers[keyFor(2, 'selectedAudience')]
    || '';
  const statementProblems = [0, 1, 2]
    .map((index) => answers[keyFor(6, `statementProblem${index + 1}`)] || earlierProblems[index] || '')
    .map((problem) => problem.trim())
    .filter(Boolean);
  const statementEvidence = answers[keyFor(6, 'statementEvidence')]
    || answers[keyFor(5, 'evidenceSentence')]
    || '';
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
  const savedRevisedStatement = answers[keyFor(7, 'revisedStatement')] ?? '';
  const revisedSourceStatement = answers[keyFor(7, 'revisedSourceStatement')] ?? '';
  const revisedStatement = !savedRevisedStatement.trim() || revisedSourceStatement !== testStatement
    ? testStatement
    : savedRevisedStatement;
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
    onAnswer('revisedSourceStatement', testStatement);
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
      <section className="day-seven-purpose">
        <h2>为什么要做这一步？</h2>
        <p>你自己觉得说清楚了，不代表别人真的能理解。把服务说明发给身边的人，是为了验证他们能不能说出你服务谁、解决什么问题，以及什么情况下会想到找你。记录对方的原话，才能知道需要调整的是表达，还是服务本身。</p>
      </section>

      <section className="day-seven-instructions">
        <h2>具体要做什么？</h2>
        <p>复制下方服务说明，发给五个测试对象，然后问他们下方问题：</p>
        <ul>
          <li>你觉得我是帮谁的？</li>
          <li>你觉得我解决什么问题？</li>
          <li>什么情况下你会想到找我？</li>
        </ul>
        <p>记录他们反馈的原话，如果他们复述不出来，就需要修改。</p>
      </section>

      <section className="test-message-panel">
        <div className="test-message-heading">
          <div>
            <span>你的初版服务说明</span>
            <strong>{testStatement ? '把这份说明发给身边的人' : '1.6 暂时没有可用的服务说明'}</strong>
          </div>
        </div>
        <div className="assembly-preview test-statement-preview">
          {statementValue || statementAudience || statementProblems.length || statementEvidence ? (
            <StructuredServiceStatement
              valueLine={statementValue}
              fitAudience={statementAudience}
              problems={statementProblems}
              evidence={statementEvidence}
              emptyText="请先回到 1.6 生成一份服务说明。"
            />
          ) : (
            <p>{testStatement || '请先回到 1.6 生成一份服务说明。'}</p>
          )}
        </div>
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
            <summary>点击展开，一键复制 AI 分析提示词</summary>
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
          <div className="test-message-panel final-statement-panel">
            <div className="test-message-heading">
              <div>
                <span>你的最终服务说明</span>
                <strong>结合测试反馈，在这里修改出最终版</strong>
              </div>
            </div>
            <div className="assembly-preview test-statement-preview final-statement-preview">
              <AutoGrowTextarea
                className="statement-result-editor final-statement-editor"
                value={revisedStatement}
                aria-label="编辑最终服务说明"
                placeholder="1.6 的初版服务说明会自动填入这里"
                onChange={(event) => {
                  onAnswer('revisedSourceStatement', testStatement);
                  onAnswer('revisedStatement', event.target.value);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="single-day-submit submit-only week-finish-submit">
        <button className="main-button" type="button" onClick={saveAndContinue}>
          第一周完成 →
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
  const savedWorkEvidence = answers[keyFor(8, 'workEvidence')] ?? '';
  const legacyWorks = answers[keyFor(8, 'works')] ?? '';
  const storedWorks = parseWorkEvidence(
    savedWorkEvidence,
    legacyWorks,
  );
  const carriedWorkTitles = uniqueLines(
    answers[keyFor(5, 'evidenceFacts')]
      || answers[keyFor(6, 'statementEvidence')]
      || answers[keyFor(5, 'evidenceSentence')]
      || '',
  );
  const seededWorks = carriedWorkTitles.map((title, index) => ({
    id: `work-${index + 1}`,
    title,
    problem: '',
    proof: '',
    discarded: false,
  }));
  const hasSavedWorks = Boolean(savedWorkEvidence.trim() || legacyWorks.trim());
  const works = hasSavedWorks
    ? storedWorks
    : seededWorks.length
      ? seededWorks
      : [{ id: 'work-1', title: '', problem: '', proof: '', discarded: false }];
  const namedWorks = works.filter((work) => work.title.trim());

  const saveWorks = (nextWorks: WorkEvidence[]) => {
    onAnswer('workEvidence', JSON.stringify(nextWorks));
  };

  const updateWork = (id: string, patch: Partial<WorkEvidence>) => {
    saveWorks(works.map((work) => (work.id === id ? { ...work, ...patch } : work)));
  };

  const deleteWork = (id: string) => {
    saveWorks(works.filter((work) => work.id !== id));
  };

  const missing = namedWorks.length === 0
    || namedWorks.some((work) => !work.problem.trim() || !work.proof.trim());

  const saveAndContinue = () => {
    saveWorks(works);
    onSubmit(missing ? ['workEvidence'] : []);
  };

  return (
    <div className="single-day-form evidence-work-form">
      <section className="single-task-block">
        <span className="task-number">01</span>
        <div>
          <h2>写下已完成的作品/创作</h2>
          <div className="task-purpose-box">你做过哪些作品、项目或实际行动？</div>
          <details className="worksheet-help work-example">
            <summary>示例</summary>
            <ul>
              <li>一篇讲“如何开始记账”的公众号文章</li>
              <li>一份帮助新同事快速上手的工作清单</li>
              <li>一次帮朋友梳理简历的咨询与修改</li>
            </ul>
          </details>

          <div className="work-title-list">
            {works.length ? works.map((work, index) => (
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
                <button className="delete-work-button" type="button" onClick={() => deleteWork(work.id)}>删除</button>
              </div>
            )) : <p className="empty-inline">还没有作品，点击下方按钮新增。</p>}
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
          <h2>让你的“证明”更完整</h2>
          <div className="task-purpose-box">对每一个作品补充它解决的问题、能证明什么。</div>
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
              <article className="work-evidence-row" key={work.id}>
                <header>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{work.title}</h3>
                </header>
                <div className="work-evidence-fields">
                  <label>
                    <span>解决了什么问题</span>
                    <AutoGrowTextarea
                      value={work.problem}
                      placeholder="这个作品解决了什么具体问题？"
                      onChange={(event) => updateWork(work.id, { problem: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>能证明什么</span>
                    <AutoGrowTextarea
                      value={work.proof}
                      placeholder="这个作品能证明你具备什么能力或判断？"
                      onChange={(event) => updateWork(work.id, { proof: event.target.value })}
                    />
                  </label>
                </div>
              </article>
            )) : (
              <p className="empty-inline">先在上方写下作品名称。</p>
            )}
          </div>
        </div>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={saveAndContinue}>
          进入下一关 →
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
            <p>这一部分要写每个具体作品带来的实际变化，让别人看见你做完这件事后，行为、能力或业务发生了什么。</p>
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
          <h2>用“从……到……”造句</h2>
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
              <p className="empty-inline">2.1 还没有填写作品。</p>
            )}
          </div>
        </div>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={() => onSubmit(missing ? ['resultEvidence'] : [])}>
          进入下一关 →
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
          <h2>整理什么样的反馈？</h2>
          <p className="feedback-purpose key-explanation">整理反馈，是为了证明你的作品不只是“自己觉得有用”，而是真的帮助别人解决过具体问题、产生过具体变化。</p>
          <p>找到别人的反馈。聊天记录、评论、转介绍、读者私信都可以，只收具体的反馈。多小的反馈都可以写，只要足够具体。</p>
          <ol className="feedback-guidance-list">
            <li>
              <strong>不要收空泛的评价</strong>
              <span>例如：“很专业”“很有帮助”“收获很大”。</span>
            </li>
            <li>
              <strong>收下能够说明具体变化的反馈</strong>
              <span>例如：“我终于知道怎么介绍自己的服务了”、“你帮我把一堆散的卖点理顺了”、“我第一次意识到问题不在内容，而在价值没说清”、“这个版本发出去以后，客户问得更具体了”。</span>
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
          进入下一关 →
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
          <h2>从具体事情里，提炼你的判断</h2>
          <div className="cognition-intro-panel">
            <p className="key-explanation">前面整理的是你做过什么，以及这些事情带来了什么变化。接下来要从具体事情中抽离出来，写清楚这段经历让你形成了什么判断。</p>
            <div className="cognition-formula"><span>句式是：</span><strong>“我以前……后来我发现……所以我现在……”</strong></div>
          </div>
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
          <div className="cognition-formula compact-formula"><span>句式是：</span><strong>“我以前……后来我发现……所以我现在……”</strong></div>
          <div className="cognition-entry-list">
            {records.map((record, index) => (
              <div className="cognition-entry-row" key={record.id}>
                <select
                  value={record.workId}
                  aria-label={`第 ${index + 1} 条判断对应的作品`}
                  onChange={(event) => updateRecord(record.id, { workId: event.target.value })}
                >
                  <option value="">选择作品</option>
                  {works.map((work) => <option value={work.id} key={work.id}>{work.title}</option>)}
                </select>
                <span aria-hidden="true">：</span>
                <AutoGrowTextarea
                  value={record.story}
                  aria-label={`第 ${index + 1} 条判断`}
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
          进入下一关 →
        </button>
      </div>
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
  const workDrafts = parseRepresentativeWorkDrafts(
    answers[keyFor(13, 'representativeWorkDrafts')] ?? '',
    works,
    selectedWorks,
  );
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
    const draft = workDrafts.find((item) => item.workId === work.id);
    saveSelection([
      ...selectedWorks,
      {
        workId: work.id,
        what: draft?.what || work.title,
        problem: draft?.problem || work.problem,
        proof: draft?.proof || work.proof,
      },
    ]);
  };

  const updateWorkDraft = (workId: string, patch: Partial<RepresentativeWork>) => {
    const nextDrafts = workDrafts.map((work) => (
      work.workId === workId ? { ...work, ...patch } : work
    ));
    onAnswer('representativeWorkDrafts', JSON.stringify(nextDrafts));
    if (selectedIds.includes(workId)) {
      saveSelection(selectedWorks.map((work) => (
        work.workId === workId ? { ...work, ...patch } : work
      )));
    }
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
      <section className="representative-page-intro">
        <h2>这一页要做什么？</h2>
        <p>把前面整理的作品、实际变化和判断合在一起，再补充你的能力边界，生成一份让客户看懂“为什么可以信你”的说明。</p>
      </section>

      <section className="single-task-block representative-selection-block">
        <span className="task-number">01</span>
        <div>
          <h2>选出与「你要解决的问题」最相关的代表作品</h2>
          <div className="representative-selected-problem">
            <span>你选择解决的问题是：</span>
            <strong>{mainProblem || '第一周还没有选定唯一的问题'}</strong>
          </div>
          <p>从已有作品中选 1–3 个。这里主要做选择；需要确认或修改时，再展开作品详情。</p>
          <div className="representative-picker-list">
            {works.length ? works.map((work) => {
              const selected = selectedIds.includes(work.id);
              const maxed = selectedWorks.length >= 3 && !selected;
              const draft = workDrafts.find((item) => item.workId === work.id) ?? {
                workId: work.id,
                what: work.title,
                problem: work.problem,
                proof: work.proof,
              };
              return (
                <article className={selected ? 'is-selected' : ''} key={work.id}>
                  <button
                    className="representative-select-button"
                    type="button"
                    aria-pressed={selected}
                    disabled={maxed}
                    onClick={() => toggleWork(work)}
                  >
                    <span>{selected ? '✓' : '+'}</span>
                    <strong>{draft.what || work.title}</strong>
                    <small>{selected ? '已选择' : maxed ? '最多选择 3 个' : '点击选择'}</small>
                  </button>
                  <details className="representative-detail-panel">
                    <summary>查看已填写的作品详情</summary>
                    <div>
                      <label>
                        <span>作品名称</span>
                        <AutoGrowTextarea
                          value={draft.what}
                          onChange={(event) => updateWorkDraft(work.id, { what: event.target.value })}
                        />
                      </label>
                      <label>
                        <span>解决了什么问题</span>
                        <AutoGrowTextarea
                          value={draft.problem}
                          onChange={(event) => updateWorkDraft(work.id, { problem: event.target.value })}
                        />
                      </label>
                      <label>
                        <span>证明了什么</span>
                        <AutoGrowTextarea
                          value={draft.proof}
                          onChange={(event) => updateWorkDraft(work.id, { proof: event.target.value })}
                        />
                      </label>
                    </div>
                  </details>
                </article>
              );
            }) : <p className="empty-inline">2.1 还没有可选择的作品。</p>}
          </div>
        </div>
      </section>

      <section className="single-task-block trust-boundary-block">
        <span className="task-number">02</span>
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
          进入下一关 →
        </button>
      </div>
    </div>
  );
}

function ThirdWeekWritingPage({
  dayNumber,
  answers,
  previewMode,
  firstIncomplete,
  onAnswer,
  onBackup,
  onSubmit,
}: {
  dayNumber: number;
  answers: AnswerMap;
  previewMode: boolean;
  firstIncomplete: number;
  onAnswer: (id: string, value: string) => void;
  onBackup: (answerOverrides: AnswerMap, download: boolean) => Promise<void>;
  onSubmit: (missingIds: string[], answerOverrides: AnswerMap) => void;
}) {
  const config = contentWritingConfigs[dayNumber];
  const title = answers[keyFor(dayNumber, config.titleId)] ?? '';
  const mergedDraft = [
    title.trim(),
    ...config.sections.map((section) => answers[keyFor(dayNumber, section.id)]?.trim() ?? ''),
  ].filter(Boolean).join('\n\n');
  const savedMergedArticle = answers[keyFor(dayNumber, 'mergedArticle')];
  const savedMergedSource = answers[keyFor(dayNumber, 'mergedArticleSource')] ?? '';
  const mergedArticle = savedMergedArticle === undefined || savedMergedSource !== mergedDraft
    ? mergedDraft
    : savedMergedArticle;
  const missingIds = [
    title.trim() ? '' : config.titleId,
    ...config.sections.map((section) => (
      answers[keyFor(dayNumber, section.id)]?.trim() ? '' : section.id
    )),
    mergedArticle.trim() ? '' : 'mergedArticle',
  ].filter(Boolean);

  const updateMergedArticle = (value: string) => {
    onAnswer('mergedArticleSource', mergedDraft);
    onAnswer('mergedArticle', value);
  };

  const articleOverrides = {
    [keyFor(dayNumber, 'mergedArticleSource')]: mergedDraft,
    [keyFor(dayNumber, 'mergedArticle')]: mergedArticle,
  };

  const saveAndContinue = () => onSubmit(missingIds, articleOverrides);
  return (
    <div className="single-day-form third-week-writing-form">
      <section className="single-task-block content-writing-guide">
        <span className="task-number">01</span>
        <div>
          <div className="content-writing-heading">
            <h2>“{config.name}”—— {config.purpose}</h2>
          </div>
          <div className="content-title-formula">
            <span>{config.formulaLabel}：</span>
            <strong>{config.formula}</strong>
          </div>
          <ul className="content-title-examples">
            {config.examples.map((example, index) => (
              <li key={example}><span>示例 {index + 1}</span>{example}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="single-task-block content-title-section">
        <span className="task-number">02</span>
        <div>
          <h2>写下你的标题</h2>
          <label className="content-title-input">
            <span className="sr-only">写下你的标题</span>
            <input
              type="text"
              value={title}
              placeholder={config.titlePlaceholder}
              onChange={(event) => onAnswer(config.titleId, event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="single-task-block content-draft-section">
        <span className="task-number">03</span>
        <div>
          <h2>开始写正文</h2>
          <p className="content-word-guide">总字数建议：200–500 字</p>
          <div className="content-paragraph-list">
            {config.sections.map((section) => (
              <label key={section.id}>
                <span>{section.label}</span>
                <AutoGrowTextarea
                  value={answers[keyFor(dayNumber, section.id)] ?? ''}
                  placeholder={section.placeholder}
                  onChange={(event) => onAnswer(section.id, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="single-task-block content-merged-section">
        <span className="task-number">04</span>
        <div>
          <h2>整理成一篇完整文章</h2>
          <p>标题和正文已经按照文章格式合并，你可以在这里继续修改。</p>
          <AutoGrowTextarea
            className="content-merged-editor"
            value={mergedArticle}
            aria-label={`${config.name}完整文章`}
            placeholder="完成上方标题和正文后，这里会自动合并成一篇完整文章。"
            onChange={(event) => updateMergedArticle(event.target.value)}
          />
          <small className="content-ai-polish-note">也可以使用 AI 辅助润色。</small>
        </div>
      </section>

      <div className="single-day-submit third-week-backup-actions">
        <button className="secondary-button" type="button" onClick={() => void onBackup(articleOverrides, true)}>
          下载本篇备份
        </button>
        <button className="main-button" type="button" onClick={saveAndContinue}>
          {previewMode ? `保存草稿，返回 ${getVisibleStep(firstIncomplete).label} →` : '保存并备份，进入下一关 →'}
        </button>
      </div>
    </div>
  );
}

function DayTwentyAuditPage({
  answers,
  onAnswer,
  onSubmit,
}: {
  answers: AnswerMap;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (answerOverrides: AnswerMap) => void;
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sourceArticles = Object.entries(contentWritingConfigs).map(([day, config]) => {
    const dayNumber = Number(day);
    const mergedDraft = [
      answers[keyFor(dayNumber, config.titleId)]?.trim() ?? '',
      ...config.sections.map((section) => answers[keyFor(dayNumber, section.id)]?.trim() ?? ''),
    ].filter(Boolean).join('\n\n');
    const savedMergedArticle = answers[keyFor(dayNumber, 'mergedArticle')];
    const savedMergedSource = answers[keyFor(dayNumber, 'mergedArticleSource')] ?? '';
    return {
      dayNumber,
      name: config.name,
      value: savedMergedArticle === undefined || savedMergedSource !== mergedDraft
        ? mergedDraft
        : savedMergedArticle,
    };
  });
  const finalArticles = sourceArticles.map((article) => {
    const finalId = `finalArticle${article.dayNumber}`;
    return {
      ...article,
      finalId,
      value: answers[keyFor(20, finalId)] === undefined
        ? article.value
        : answers[keyFor(20, finalId)],
    };
  });
  const articles = finalArticles.map((article) => {
    return `【${article.name}】\n${article.value.trim() || '（未填写）'}`;
  }).join('\n\n--------------------\n\n');

  const auditPrompt = `请帮我对下面 5 篇内容做一次宽松的整体检查。

这不是逐字逐句的文案审校。请不要吹毛求疵，也不要为了提建议而强行找问题。只要五篇内容的方向大致一致，没有明显冲突或跑偏，就请明确告诉我：“整体方向一致，可以继续使用。”

请检查四件事：
1. 五篇内容是否大致指向同一类问题？
2. 每篇内容是否都能让读者看见我的判断？
3. 每篇内容是否都有具体、可理解的行动或帮助？
4. 五篇放在一起，是否能让读者更清楚“什么时候可以来找我”？

判断时请注意：
- 大致一致即可，不要求五篇使用完全相同的词语、观点或结构。
- 如果没有特别明显的问题，保留原稿就好，并简单说明为什么是 OK 的。
- 只有当某篇明显不符合上述检查时，才指出具体是哪一篇、哪一段、哪个标准没有满足。
- 优先给出最小修改建议，不要整篇重写；除非某篇完全跑偏。

请按以下结构回答：
A. 整体结论：是否方向一致
B. 四项检查：逐项给出简短判断
C. 明显问题：只列真正影响方向的部分；如果没有，就写“没有明显问题”
D. 最小修改建议：只针对 C 中的问题给建议

以下是我的 5 篇内容：

${articles}`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(auditPrompt);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = auditPrompt;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    onAnswer('contentAudit', 'prompt-copied');
    window.setTimeout(() => setCopied(false), 1800);
  };

  const finishAudit = () => {
    const answerOverrides = Object.fromEntries([
      ...finalArticles.map((article) => [keyFor(20, article.finalId), article.value]),
      [keyFor(20, 'contentAudit'), 'completed'],
    ]);
    onSubmit(answerOverrides);
  };

  const refreshFromPrevious = () => {
    if (!window.confirm('重新获取会替换下面五篇最终版当前的内容，是否继续？')) return;
    sourceArticles.forEach((article) => {
      onAnswer(`finalArticle${article.dayNumber}`, article.value);
    });
  };

  return (
    <div className="single-day-form day-twenty-audit-form">
      <section className="single-task-block audit-purpose-section">
        <span className="task-number">01</span>
        <div>
          <h2>这一天要做什么？</h2>
          <p>把前面写好的 5 篇内容放在一起，检查它们是否在共同说明你能为读者解决什么问题。</p>
          <div className="audit-check-list">
            <div><span>01</span><strong>是否指向同一类问题？</strong></div>
            <div><span>02</span><strong>是否都有你的判断？</strong></div>
            <div><span>03</span><strong>是否都有具体行动？</strong></div>
            <div><span>04</span><strong>是否让读者知道什么时候该找你？</strong></div>
          </div>
          <p className="audit-purpose-result">这 5 篇内容最终要共同完成一件事：让别人理解你的价值。</p>
        </div>
      </section>

      <section className="single-task-block audit-usage-section">
        <span className="task-number">02</span>
        <div>
          <h2>怎么使用？</h2>
          <ol className="audit-usage-steps">
            <li><span>1</span><p>点击“一键复制”，工具会自动把你前面写好的 5 篇内容带入 Prompt。</p></li>
            <li><span>2</span><p>打开任意一个大模型，粘贴并发送。</p></li>
            <li><span>3</span><p>查看整体方向是否一致；只处理模型指出的明显问题。</p></li>
          </ol>

          <div className={`audit-prompt-panel${promptOpen ? ' is-open' : ''}`}>
            <div className="audit-prompt-toolbar">
              <button type="button" className="audit-expand-button" onClick={() => setPromptOpen((open) => !open)}>
                <span aria-hidden="true">{promptOpen ? '−' : '+'}</span>
                {promptOpen ? '收起 Prompt' : '展开 Prompt'}
              </button>
              <button type="button" className="audit-copy-button" onClick={copyPrompt}>
                {copied ? '✓ 已复制' : '一键复制'}
              </button>
            </div>
            {promptOpen && <pre className="audit-prompt-content">{auditPrompt}</pre>}
          </div>
        </div>
      </section>

      <section className="single-task-block audit-final-section">
        <span className="task-number">03</span>
        <div>
          <div className="audit-final-heading">
            <h2>最终版保存</h2>
            <button className="secondary-button refresh-previous-button" type="button" onClick={refreshFromPrevious}>
              重新获取前序数据 <span aria-hidden="true">↻</span>
            </button>
          </div>
          <p className="audit-final-note">在这里优化出最终版，可以利用 AI 来优化。</p>
          <div className="audit-final-article-list">
            {finalArticles.map((article) => (
              <article className="audit-final-article" key={article.dayNumber}>
                <h3>{article.name}</h3>
                <div className="audit-final-editor">
                  <AutoGrowTextarea
                    value={article.value}
                    aria-label={`${article.name}最终版`}
                    placeholder={`前面的${article.name}还没有内容。`}
                    onChange={(event) => onAnswer(article.finalId, event.target.value)}
                  />
                  <span>{article.value.replace(/\s/g, '').length} 字</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={finishAudit}>
          进入下一关 →
        </button>
      </div>
    </div>
  );
}

function DayTwentyOnePublishPage({
  buttonLabel,
  onSubmit,
}: {
  buttonLabel: string;
  onSubmit: () => void;
}) {
  return (
    <div className="single-day-form day-twenty-one-form">
      <div className="day-twenty-one-intro">
        在这里你可以任选 2 到 3 篇去分享在公开的网络里，同时记录具体的问题、私信、转介绍和购买意向，有任何反馈你都可以记录下来。
      </div>

      <details className="day-twenty-one-feedback">
        <summary>记录什么样的反馈</summary>
        <ul>
          <li><strong>读者认出了自己：</strong>“这说的就是我，我一直以为自己只是缺流量。”</li>
          <li><strong>读者提出具体问题：</strong>“如果我已经有服务，但介绍还是很散，应该先改哪里？”</li>
          <li><strong>读者私信或转介绍：</strong>“我把这篇转给了一个正准备做咨询的朋友。”</li>
          <li><strong>读者表达购买意向：</strong>“你现在能不能帮我一起整理？怎么收费？”</li>
        </ul>
      </details>

      <p className="day-twenty-one-followup">可以根据一些反馈来进行修改优化。</p>

      <div className="single-day-submit submit-only">
        <button className="main-button" type="button" onClick={onSubmit}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function LineListEditor({
  value,
  onChange,
  placeholder,
  addLabel = '新增一行',
  minRows = 1,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  addLabel?: string;
  minRows?: number;
}) {
  const storedLines = value ? value.split('\n') : [];
  const lines = storedLines.length >= minRows
    ? storedLines
    : [...storedLines, ...Array(minRows - storedLines.length).fill('')];

  const updateLine = (index: number, nextValue: string) => {
    onChange(lines.map((line, lineIndex) => (lineIndex === index ? nextValue : line)).join('\n'));
  };

  const removeLine = (index: number) => {
    const next = lines.filter((_, lineIndex) => lineIndex !== index);
    onChange((next.length ? next : ['']).join('\n'));
  };

  return (
    <div className="compact-line-editor">
      {lines.map((line, index) => (
        <div className="compact-line-row" key={`${index}-${lines.length}`}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <input
            type="text"
            value={line}
            aria-label={`${placeholder} ${index + 1}`}
            placeholder={placeholder}
            onChange={(event) => updateLine(index, event.target.value)}
          />
          {lines.length > 1 && (
            <button type="button" aria-label={`删除第 ${index + 1} 行`} onClick={() => removeLine(index)}>×</button>
          )}
        </div>
      ))}
      <button className="linked-add-button" type="button" onClick={() => onChange([...lines, ''].join('\n'))}>
        <span aria-hidden="true">＋</span> {addLabel}
      </button>
    </div>
  );
}

function FourthWeekPage({
  dayNumber,
  answers,
  previewMode,
  firstIncomplete,
  onAnswer,
  onSubmit,
  onFinish,
}: {
  dayNumber: number;
  answers: AnswerMap;
  previewMode: boolean;
  firstIncomplete: number;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (missingIds: string[]) => void;
  onFinish: (status: 'waiting' | 'published', missingIds: string[]) => void;
}) {
  const getAnswer = (day: number, id: string) => answers[keyFor(day, id)] ?? '';
  const [copiedField, setCopiedField] = useState('');
  const audience = firstFilled(getAnswer(2, 'selectedAudience'), getAnswer(6, 'statementFit'));
  const earlierProblems = uniqueLines(getAnswer(3, 'topProblems'));
  const earlierProblem = firstFilled(
    getAnswer(22, 'offerSolvedProblem'),
    getAnswer(4, 'focusProblem'),
    earlierProblems[0],
  );
  const chosenOffer = getAnswer(22, 'chosenOffer');
  const fitAudience = firstFilled(getAnswer(23, 'fitAudience'), audience);
  const notFitAudience = getAnswer(23, 'notFitAudience');
  const offerProblem = firstFilled(getAnswer(24, 'offerProblem'), earlierProblem);
  const deliverables = getAnswer(24, 'deliverables');
  const process = getAnswer(25, 'process');
  const excluded = getAnswer(25, 'excluded');
  const price = getAnswer(26, 'price');
  const priceRationale = getAnswer(26, 'priceRationale');
  const startAction = getAnswer(27, 'startAction');
  const purchasePageDraft = getAnswer(27, 'purchasePageDraft');
  const purchasePageFinal = firstFilled(getAnswer(29, 'purchasePageFinal'), purchasePageDraft);
  const nextButtonLabel = previewMode
    ? `返回 ${getVisibleStep(firstIncomplete).label}`
    : '进入下一关 →';
  const works = parseWorkEvidence(
    getAnswer(8, 'workEvidence'),
    getAnswer(8, 'works'),
  ).filter((work) => work.title.trim() && !work.discarded);
  const representativeWorks = parseRepresentativeWorks(getAnswer(13, 'representativeWorks'), works);
  const evidenceFallback = (representativeWorks.length
    ? representativeWorks.map((work, index) => ({
      id: `purchase-evidence-${index + 1}`,
      title: work.what,
      proof: work.proof,
    }))
    : works.slice(0, 3).map((work, index) => ({
      id: `purchase-evidence-${index + 1}`,
      title: work.title,
      proof: work.proof,
    })));
  const privateTestMessage = [
    '你好，我最近整理了一项小服务。',
    chosenOffer ? `它叫“${chosenOffer}”` : '',
    fitAudience ? `，主要适合${fitAudience}` : '',
    offerProblem ? `，解决“${offerProblem}”的问题。` : '',
    '我想请你从真实购买者的角度看一下：你是否看得懂会得到什么？如果暂时不会购买，最犹豫或最看不懂的地方是什么？不用客气，直接说真实感受就可以。',
  ].join('');
  const copyText = async (value: string, field: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => current === field ? '' : current), 1800);
    } catch {
      setCopiedField('copy-error');
    }
  };

  const submit = (missingIds: string[]) => onSubmit(missingIds);

  if (dayNumber === 22) {
    const candidates = uniqueLines(getAnswer(22, 'offerCandidates'));
    const selectedProblem = getAnswer(22, 'offerSolvedProblem');
    const missing = [
      chosenOffer.trim() ? '' : 'chosenOffer',
      getAnswer(22, 'offerProof').trim() ? '' : 'offerProof',
      selectedProblem.trim() ? '' : 'offerSolvedProblem',
      getAnswer(22, 'offerTime').trim() ? '' : 'offerTime',
    ].filter(Boolean);
    return (
      <div className="single-day-form fourth-week-form">
        <section className="single-task-block fourth-week-intro">
          <span className="task-number">01</span>
          <div>
            <h2>先做一个现在就能交付的小产品</h2>
            <p>这里不是设计完整产品线。先选一个客户看得懂、你在 1–2 周内能够交付的小结果。</p>
            <div className="carried-summary">
              <span>你目前想服务的人</span><strong>{audience || '前面还没有确定客户'}</strong>
              <span>他们最想解决的问题</span><strong>{earlierProblem || '前面还没有确定问题'}</strong>
            </div>
          </div>
        </section>

        <section className="single-task-block">
          <span className="task-number">02</span>
          <div>
            <h2>写下 1–3 个现在可以卖的小结果</h2>
            <details className="worksheet-help"><summary>示例</summary><ul>
              <li>陪一个完全不会拍摄的人完成第一条视频</li>
              <li>帮一个有目标但总拖延的人整理一周执行计划</li>
              <li>帮一个经历很多却说不清优势的人重写服务介绍</li>
            </ul></details>
            <LineListEditor
              value={getAnswer(22, 'offerCandidates')}
              minRows={2}
              placeholder="例如：陪你完成第一条视频"
              addLabel="再加一个想法"
              onChange={(value) => onAnswer('offerCandidates', value)}
            />
          </div>
        </section>

        <section className="single-task-block">
          <span className="task-number">03</span>
          <div>
            <h2>选一个，并确认它现在能够交付</h2>
            <div className="fourth-week-field-list">
              <label><span>这一轮卖什么</span><select value={chosenOffer} onChange={(event) => onAnswer('chosenOffer', event.target.value)}>
                <option value="">选择一个小产品</option>
                {candidates.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
                {chosenOffer && !candidates.includes(chosenOffer) && <option value={chosenOffer}>{chosenOffer}</option>}
              </select></label>
              <label><span>它解决哪个具体问题</span><input type="text" value={selectedProblem} placeholder={earlierProblem || '客户现在最想解决的问题'} onChange={(event) => onAnswer('offerSolvedProblem', event.target.value)} /></label>
              <label><span>你凭什么能交付</span><AutoGrowTextarea value={getAnswer(22, 'offerProof')} placeholder="写一条最直接的经验或证据" onChange={(event) => onAnswer('offerProof', event.target.value)} /></label>
              <label><span>多久可以完成</span><input type="text" value={getAnswer(22, 'offerTime')} placeholder="例如：7 天内 / 两次沟通后" onChange={(event) => onAnswer('offerTime', event.target.value)} /></label>
            </div>
          </div>
        </section>

        <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => submit(missing)}>{nextButtonLabel}</button></div>
      </div>
    );
  }

  if (dayNumber === 23) {
    const missing = [getAnswer(23, 'fitAudience').trim() ? '' : 'fitAudience', notFitAudience.trim() ? '' : 'notFitAudience'].filter(Boolean);
    return (
      <div className="single-day-form fourth-week-form">
        <section className="single-task-block fourth-week-intro"><span className="task-number">01</span><div>
          <h2>先让客户判断：这是不是为我准备的？</h2>
          <p>“适合谁”帮助对的人认出自己；“不适合谁”减少错配，让后面的交付更稳定。</p>
          <div className="current-offer-strip"><span>本轮产品</span><strong>{chosenOffer || '4.1 还没有选择产品'}</strong></div>
        </div></section>
        <section className="single-task-block"><span className="task-number">02</span><div>
          <h2>写清楚适合谁</h2>
          <details className="worksheet-help"><summary>示例</summary><p>已经有专业能力，但介绍自己和服务时总是很散的人。</p></details>
          <AutoGrowTextarea value={getAnswer(23, 'fitAudience')} placeholder={audience ? `适合：${audience}` : '适合：正处在什么情况、想解决什么问题的人'} onChange={(event) => onAnswer('fitAudience', event.target.value)} />
        </div></section>
        <section className="single-task-block"><span className="task-number">03</span><div>
          <h2>写清楚不适合谁</h2>
          <details className="worksheet-help"><summary>示例</summary><p>只想快速涨粉、追热点，或者希望别人长期代运营的人。</p></details>
          <AutoGrowTextarea value={notFitAudience} placeholder="不适合：期待什么结果、需要什么服务方式的人" onChange={(event) => onAnswer('notFitAudience', event.target.value)} />
        </div></section>
        <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => submit(missing)}>{nextButtonLabel}</button></div>
      </div>
    );
  }

  if (dayNumber === 24) {
    const missing = [offerProblem.trim() ? '' : 'offerProblem', uniqueLines(deliverables).length ? '' : 'deliverables'].filter(Boolean);
    return (
      <div className="single-day-form fourth-week-form day-twenty-four-form">
        <section className="day-twenty-four-intro">
          <h2>客户不是购买一个服务名，而是购买一个具体结果</h2>
          <p>这一页只回答两件事：你重点解决什么问题，结束后客户手里会多出哪些可以清点的东西。</p>
          <div className="current-offer-strip"><span>本轮产品</span><strong>{chosenOffer || '4.1 还没有选择产品'}</strong></div>
        </section>
        <section className="day-twenty-four-field">
          <h2>重点解决什么问题</h2>
          <AutoGrowTextarea value={offerProblem} placeholder={earlierProblem || '例如：别人看完介绍，仍然不知道什么时候该找你'} onChange={(event) => onAnswer('offerProblem', event.target.value)} />
        </section>
        <section className="day-twenty-four-field">
          <h2>客户结束后会拿到什么</h2>
          <p className="compact-note">写具体的文档、页面、修改稿、清单或已经完成的动作，不写“策略建议”这类宽词。</p>
          <LineListEditor value={deliverables} minRows={3} placeholder="例如：一版可以直接使用的服务介绍" addLabel="新增一个交付物" onChange={(value) => onAnswer('deliverables', value)} />
        </section>
        <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => submit(missing)}>{nextButtonLabel}</button></div>
      </div>
    );
  }

  if (dayNumber === 25) {
    const missing = [uniqueLines(process).length ? '' : 'process', uniqueLines(excluded).length ? '' : 'excluded'].filter(Boolean);
    return (
      <div className="single-day-form fourth-week-form">
        <section className="single-task-block fourth-week-intro"><span className="task-number">01</span><div>
          <h2>让客户知道接下来会发生什么</h2>
          <p>流程越清楚，购买风险越低。边界不是减少价值，而是提前说明哪些事情不在本次服务里。</p>
          <details className="worksheet-help"><summary>流程示例</summary><ol><li>填写一份简单问卷</li><li>提交现有资料</li><li>进行一次沟通</li><li>收到整理后的文档</li><li>完成一次修改</li></ol></details>
        </div></section>
        <section className="single-task-block"><span className="task-number">02</span><div>
          <h2>服务怎么进行</h2>
          <LineListEditor value={process} minRows={3} placeholder="写一个真实会发生的步骤" addLabel="新增一步" onChange={(value) => onAnswer('process', value)} />
        </div></section>
        <section className="single-task-block"><span className="task-number">03</span><div>
          <h2>本次服务不包含什么、不承诺什么</h2>
          <LineListEditor value={excluded} minRows={2} placeholder="例如：不包含长期代写 / 不承诺立刻成交" addLabel="新增一条边界" onChange={(value) => onAnswer('excluded', value)} />
        </div></section>
        <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => submit(missing)}>{nextButtonLabel}</button></div>
      </div>
    );
  }

  if (dayNumber === 26) {
    const missing = [price.trim() ? '' : 'price', priceRationale.trim() ? '' : 'priceRationale'].filter(Boolean);
    return (
      <div className="single-day-form fourth-week-form">
        <section className="single-task-block fourth-week-intro"><span className="task-number">01</span><div>
          <h2>价格不是孤零零的数字</h2>
          <p>客户需要先看懂会拿到什么、服务如何进行、边界在哪里，再判断这个价格是否成立。</p>
          <div className="price-context"><span>客户会拿到</span><p>{uniqueLines(deliverables).join('；') || '4.3 还没有填写交付物'}</p></div>
        </div></section>
        <section className="single-task-block"><span className="task-number">02</span><div>
          <h2>写下一个你现在能站得住的价格</h2>
          <label className="price-input"><span>价格</span><input type="text" value={price} placeholder="例如：¥899 / 次" onChange={(event) => onAnswer('price', event.target.value)} /></label>
        </div></section>
        <section className="single-task-block"><span className="task-number">03</span><div>
          <h2>为什么值这个价格</h2>
          <details className="worksheet-help"><summary>这里怎么写？</summary><p>这个价格不是购买一段聊天时间，而是购买一个具体结果。说明客户会拿到什么，这件事解决后会少走什么弯路。</p></details>
          <AutoGrowTextarea value={priceRationale} placeholder="这个价格不是购买……而是购买……你会拿到……并少走……" onChange={(event) => onAnswer('priceRationale', event.target.value)} />
        </div></section>
        <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => submit(missing)}>{nextButtonLabel}</button></div>
      </div>
    );
  }

  if (dayNumber === 27) {
    const evidence = parsePurchaseEvidence(getAnswer(27, 'offerEvidence'), evidenceFallback);
    const rows = evidence.length ? evidence : [{ id: 'purchase-evidence-1', title: '', proof: '' }];
    const saveEvidence = (next: PurchaseEvidence[]) => onAnswer('offerEvidence', JSON.stringify(next));
    const updateEvidence = (id: string, patch: Partial<PurchaseEvidence>) => saveEvidence(rows.map((item) => item.id === id ? { ...item, ...patch } : item));
    const generatePurchasePage = () => {
      const bullets = (value: string) => uniqueLines(value).map((line) => `- ${line}`).join('\n');
      const evidenceText = rows.filter((item) => item.title.trim()).map((item) => `- ${item.title}${item.proof.trim() ? `：${item.proof}` : ''}`).join('\n');
      onAnswer('purchasePageDraft', [
        chosenOffer ? `# ${chosenOffer}` : '',
        fitAudience ? `【适合谁】\n${fitAudience}` : '',
        notFitAudience ? `【不适合谁】\n${notFitAudience}` : '',
        offerProblem ? `【重点解决的问题】\n${offerProblem}` : '',
        deliverables ? `【你会拿到】\n${bullets(deliverables)}` : '',
        process ? `【服务怎么进行】\n${bullets(process)}` : '',
        excluded ? `【服务边界】\n${bullets(excluded)}` : '',
        price ? `【价格】\n${price}` : '',
        priceRationale,
        evidenceText ? `【为什么可以相信我】\n${evidenceText}` : '',
        startAction ? `【怎么开始】\n${startAction}` : '',
      ].filter(Boolean).join('\n\n'));
    };
    const missing = [rows.some((item) => item.title.trim() && item.proof.trim()) ? '' : 'offerEvidence', startAction.trim() ? '' : 'startAction', purchasePageDraft.trim() ? '' : 'purchasePageDraft'].filter(Boolean);
    return (
      <div className="single-day-form fourth-week-form">
        <section className="single-task-block fourth-week-intro"><span className="task-number">01</span><div>
          <h2>只放最相关的证据</h2>
          <p>证据不需要多。每一条都要替客户解释：它证明了什么，为什么和这次购买有关。</p>
          <div className="purchase-evidence-list">{rows.map((item, index) => <div className="purchase-evidence-row" key={item.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <label><span>证据</span><input type="text" value={item.title} placeholder="相关作品、经验或具体反馈" onChange={(event) => updateEvidence(item.id, { title: event.target.value })} /></label>
            <label><span>它证明什么</span><input type="text" value={item.proof} placeholder="替客户解释它为什么相关" onChange={(event) => updateEvidence(item.id, { proof: event.target.value })} /></label>
          </div>)}</div>
          <button className="linked-add-button" type="button" onClick={() => saveEvidence([...rows, { id: nextRecordId('purchase-evidence', rows), title: '', proof: '' }])}><span aria-hidden="true">＋</span> 再加一条证据</button>
        </div></section>
        <section className="single-task-block"><span className="task-number">02</span><div>
          <h2>客户要怎么开始</h2>
          <input className="full-width-input" type="text" value={startAction} placeholder="例如：私信我“诊断”，我会先确认这项服务是否适合你" onChange={(event) => onAnswer('startAction', event.target.value)} />
        </div></section>
        <section className="single-task-block purchase-page-builder"><span className="task-number">03</span><div>
          <h2>生成一页可以直接发出的购买说明</h2>
          <p>这页购买说明就是你的第一版购买入口。它不负责收款，但要让客户看懂怎么买、如何联系或报名。</p>
          <button className="main-button centered-action" type="button" onClick={generatePurchasePage}>生成购买说明 <span aria-hidden="true">→</span></button>
          <div className="purchase-page-editor"><AutoGrowTextarea value={purchasePageDraft} placeholder="点击上方按钮生成购买说明" onChange={(event) => onAnswer('purchasePageDraft', event.target.value)} /><span>{purchasePageDraft.replace(/\s/g, '').length} 字</span></div>
        </div></section>
        <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => submit(missing)}>{nextButtonLabel}</button></div>
      </div>
    );
  }

  if (dayNumber === 28) {
    const storedRecords = parseBuyerTestRecords(getAnswer(28, 'purchaseResults'));
    const records = storedRecords.length ? storedRecords : [{ id: 'buyer-1', name: '', feedback: '' }];
    const saveRecords = (next: BuyerTestRecord[]) => onAnswer('purchaseResults', JSON.stringify(next));
    const updateRecord = (id: string, patch: Partial<BuyerTestRecord>) => saveRecords(records.map((record) => record.id === id ? { ...record, ...patch } : record));
    const hasFeedback = records.some((record) => record.name.trim() && record.feedback.trim());
    return (
      <div className="single-day-form fourth-week-form">
        <section className="single-task-block fourth-week-intro"><span className="task-number">01</span><div>
          <h2>先私下测试，不要公开发布</h2>
          <p>4.7 只发给少量最可能需要的人；4.9 才会把它放进主页、置顶内容等公开位置。先发 1 位也可以，最多记录 5 位。</p>
          <details className="worksheet-help"><summary>查看准备发送的购买说明</summary><pre className="purchase-page-preview">{purchasePageDraft || '4.6 还没有生成购买说明。'}</pre></details>
          <div className="purchase-share-actions">
            <button className="secondary-button" type="button" disabled={!purchasePageDraft.trim()} onClick={() => copyText(purchasePageDraft, 'purchase-page')}>
              {copiedField === 'purchase-page' ? '✓ 已复制购买说明' : '复制购买说明'}
            </button>
            <button className="secondary-button" type="button" onClick={() => copyText(privateTestMessage, 'private-message')}>
              {copiedField === 'private-message' ? '✓ 已复制私信开场白' : '复制私信开场白'}
            </button>
          </div>
          {copiedField === 'copy-error' && <p className="copy-message">复制失败，请展开内容后手动复制。</p>}
        </div></section>
        <section className="single-task-block"><span className="task-number">02</span><div>
          <h2>记录真实反应</h2>
          <p className="compact-note">不要急着说服。记录对方是否愿意购买；如果不买，把对方的原话写下来。</p>
          <div className="buyer-test-list">{records.map((record, index) => <div className="buyer-test-row" key={record.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <label><span>测试对象</span><input type="text" value={record.name} placeholder="写别名即可" onChange={(event) => updateRecord(record.id, { name: event.target.value })} /></label>
            <label><span>购买意愿与原因</span><AutoGrowTextarea value={record.feedback} placeholder="愿意购买 / 暂不购买，以及对方的原话" onChange={(event) => updateRecord(record.id, { feedback: event.target.value })} /></label>
          </div>)}</div>
          {records.length < 5 && <button className="linked-add-button" type="button" onClick={() => saveRecords([...records, { id: nextRecordId('buyer', records), name: '', feedback: '' }])}><span aria-hidden="true">＋</span> 添加一个测试对象</button>}
        </div></section>
        {previewMode ? <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => submit([])}>{nextButtonLabel}</button></div> : <div className="single-day-submit feedback-submit-actions">
          <button className="secondary-button" type="button" onClick={() => { onAnswer('buyerTestStatus', 'waiting'); submit(['purchaseResults']); }}>等待反馈，稍后补充</button>
          <button className="main-button" type="button" onClick={() => { onAnswer('buyerTestStatus', 'complete'); submit(hasFeedback ? [] : ['purchaseResults']); }}>进入下一关 →</button>
        </div>}
      </div>
    );
  }

  if (dayNumber === 29) {
    const records = parseBuyerTestRecords(getAnswer(28, 'purchaseResults'));
    const noFeedbackSignal = '暂时没有足够反馈';
    const signalOptions = ['不知道会拿到什么', '不知道自己是否适合', '证据还不够', '不知道怎么开始', '误解了服务边界', '觉得有启发但不愿付费', noFeedbackSignal];
    const selectedSignals = uniqueLines(getAnswer(29, 'repeatedSignals'));
    const toggleSignal = (signal: string) => {
      if (selectedSignals.includes(signal)) {
        onAnswer('repeatedSignals', selectedSignals.filter((item) => item !== signal).join('\n'));
        return;
      }
      onAnswer('repeatedSignals', signal === noFeedbackSignal
        ? noFeedbackSignal
        : [...selectedSignals.filter((item) => item !== noFeedbackSignal), signal].join('\n'));
    };
    const waitingForFeedback = selectedSignals.includes(noFeedbackSignal);
    const finalPage = purchasePageFinal;
    const missing = [
      selectedSignals.length ? '' : 'repeatedSignals',
      waitingForFeedback || getAnswer(29, 'offerRevision').trim() ? '' : 'offerRevision',
      finalPage.trim() ? '' : 'purchasePageFinal',
    ].filter(Boolean);
    return (
      <div className="single-day-form fourth-week-form">
        <section className="single-task-block fourth-week-intro"><span className="task-number">01</span><div>
          <h2>只改重复出现的问题</h2>
          <p>不要因为一个人的意见推翻全部。先把反馈放在一起，只处理反复出现的理解障碍和购买障碍。</p>
          <details className="worksheet-help"><summary>查看测试反馈</summary>{records.length ? <ul>{records.map((record) => <li key={record.id}><b>{record.name || '未命名对象'}：</b>{record.feedback || '尚未填写反馈'}</li>)}</ul> : <p>4.7 还没有反馈，可以先标记待补充并继续整理页面。</p>}</details>
        </div></section>
        <section className="single-task-block"><span className="task-number">02</span><div>
          <h2>哪些问题重复出现了？</h2>
          <div className="revision-signal-grid">{signalOptions.map((signal) => <button className={selectedSignals.includes(signal) ? 'is-selected' : ''} type="button" key={signal} onClick={() => toggleSignal(signal)}>{signal}</button>)}</div>
          {!waitingForFeedback && <AutoGrowTextarea value={getAnswer(29, 'offerRevision')} placeholder="根据重复反馈，这一次具体准备改什么？" onChange={(event) => onAnswer('offerRevision', event.target.value)} />}
          {waitingForFeedback && <p className="waiting-feedback-note">可以先保存现有购买说明，等收到更多真实反馈后再回来修改。</p>}
        </div></section>
        <section className="single-task-block"><span className="task-number">03</span><div>
          <h2>修改并保存最终购买说明</h2>
          <div className="purchase-page-editor"><AutoGrowTextarea value={finalPage} placeholder="4.6 的购买入口会自动带到这里" onChange={(event) => onAnswer('purchasePageFinal', event.target.value)} /><span>{finalPage.replace(/\s/g, '').length} 字</span></div>
        </div></section>
        <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => submit(missing)}>{nextButtonLabel}</button></div>
      </div>
    );
  }

  const finalPurchasePage = firstFilled(getAnswer(30, 'finalPurchasePage'), purchasePageFinal);
  const locationOptions = ['个人主页', '置顶内容', '公众号文末', '小红书简介', '私信自动回复', '朋友圈或即刻'];
  const selectedLocations = uniqueLines(getAnswer(30, 'launchLocations'));
  const toggleLocation = (location: string) => onAnswer('launchLocations', selectedLocations.includes(location) ? selectedLocations.filter((item) => item !== location).join('\n') : [...selectedLocations, location].join('\n'));
  const generatedLaunchCopy = [
    chosenOffer ? `我做了一个“${chosenOffer}”` : '',
    fitAudience ? `，主要帮助${fitAudience}` : '',
    offerProblem ? `，解决“${offerProblem}”的问题。` : '。',
    startAction ? `如果你正卡在这里，${startAction}。` : '',
  ].join('');
  const launchCopy = firstFilled(getAnswer(30, 'launchCopy'), generatedLaunchCopy);
  const finish = (status: 'waiting' | 'published') => {
    onAnswer('finalPurchasePage', finalPurchasePage);
    onAnswer('launchCopy', launchCopy);
    onAnswer('launchStatus', status);
    onFinish(status, [
      finalPurchasePage.trim() ? '' : 'finalPurchasePage',
      selectedLocations.length ? '' : 'launchLocations',
      launchCopy.trim() ? '' : 'launchCopy',
      status === 'published' ? '' : 'marketResult',
    ].filter(Boolean));
  };
  return (
    <div className="single-day-form fourth-week-form">
      <section className="single-task-block fourth-week-intro"><span className="task-number">01</span><div>
        <h2>现在正式公开你的第一版</h2>
        <p>4.7 是私下发给少量对象测试；这一步才是把购买说明放到公开入口，观察有没有人带着具体问题来找你。</p>
        <details className="worksheet-help"><summary>查看最终购买说明</summary><pre className="purchase-page-preview">{finalPurchasePage || '前面还没有保存购买说明。'}</pre></details>
      </div></section>
      <section className="single-task-block"><span className="task-number">02</span><div>
        <h2>准备放在哪里</h2>
        <div className="revision-signal-grid launch-location-grid">{locationOptions.map((location) => <button className={selectedLocations.includes(location) ? 'is-selected' : ''} type="button" key={location} onClick={() => toggleLocation(location)}>{location}</button>)}</div>
      </div></section>
      <section className="single-task-block"><span className="task-number">03</span><div>
        <h2>写一段发布说明</h2>
        <p className="compact-note">不要只说“终于上线了一个新产品”。直接写清楚它帮谁、解决什么，以及怎么开始。</p>
        <AutoGrowTextarea value={launchCopy} placeholder="说明帮谁、解决什么、怎么开始" onChange={(event) => onAnswer('launchCopy', event.target.value)} />
      </div></section>
      <details className="market-result-details">
        <summary>发布后回来记录真实反应（可稍后填写）</summary>
        <div>
          <p>有人咨询、购买或拒绝了吗？这些结果不影响你先完成本轮。</p>
          <AutoGrowTextarea value={getAnswer(30, 'marketResult')} placeholder="记录咨询、购买、拒绝或暂时没有反应" onChange={(event) => onAnswer('marketResult', event.target.value)} />
        </div>
      </details>
      {previewMode ? <div className="single-day-submit submit-only"><button className="main-button" type="button" onClick={() => onSubmit([])}>{`返回 ${getVisibleStep(firstIncomplete).label}`}</button></div> : <div className="single-day-submit feedback-submit-actions">
        <button className="secondary-button" type="button" onClick={() => finish('waiting')}>先保存，稍后公开发布</button>
        <button className="main-button" type="button" onClick={() => finish('published')}>进入下一关 →</button>
      </div>}
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
        <p>{missingIds.length ? `还有 ${missingIds.length} 项未填写，会标记为待补充。` : '这一步已经填写完整。'}</p>
        <button className="main-button" type="button" onClick={() => onSubmit(missingIds)}>
          进入下一关 →
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
      <h1>这一步会怎样进行</h1>
      {day.day > 7 && <div className="preview-output">完成后会留下：{day.output}</div>}
      <p>你会按下面的顺序完成：</p>
      <ol>
        {labels.map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}
      </ol>
      <button className="main-button" type="button" onClick={onReturn}>回到 {getVisibleStep(currentDay).label}</button>
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
    if (dayNumber === 28 && answers[keyFor(28, 'buyerTestStatus')] === 'waiting') return '反馈待补充';
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
  onSelectStage,
  onSelect,
  onBackup,
}: {
  currentDay: number;
  answers: AnswerMap;
  completed: BooleanMap;
  deferred: BooleanMap;
  firstIncomplete: number;
  onHome: () => void;
  onSelectStage: (stage: number) => void;
  onSelect: (day: number) => void;
  onBackup: () => void;
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current?.querySelector('.is-current')?.scrollIntoView({ block: 'center' });
  }, [currentDay]);

  return (
    <aside className="day-sidebar" aria-label="四周任务导航">
      <header>
        <button type="button" onClick={onHome}>教你如何把才华变成钱</button>
        <span>{visibleDays.filter((day) => completed[String(day.day)]).length} / {visibleDays.length} 已推进</span>
        <button className="sidebar-backup-button" type="button" onClick={onBackup}>备份与恢复</button>
      </header>
      <div className="sidebar-progress" aria-hidden="true">
        <span style={{ width: `${(visibleDays.filter((day) => completed[String(day.day)]).length / visibleDays.length) * 100}%` }} />
      </div>
      <nav ref={navRef}>
        {stages.map((stage) => (
          <section className="sidebar-stage" key={stage.id}>
            <button className="sidebar-stage-heading" type="button" onClick={() => onSelectStage(stage.id)}>
              <span>第{['一', '二', '三', '四'][stage.id - 1]}周</span>
              <strong>{stage.id === 3 ? '与用户产生连接' : stage.shortName}</strong>
            </button>
            {visibleDays.filter((day) => day.stage === stage.id).map((day) => {
              const status = dayStatus(day.day, answers, completed, deferred, firstIncomplete);
              return (
                <button
                  type="button"
                  key={day.day}
                  className={`${day.day === currentDay ? 'is-current ' : ''}${status === '已完成' ? 'is-complete ' : ''}${status.includes('待补充') ? 'is-partial' : ''}`}
                  onClick={() => onSelect(day.day)}
                >
                  <span>{getVisibleStep(day.day).label}</span>
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
  onBackup,
}: {
  open: boolean;
  answers: AnswerMap;
  completed: BooleanMap;
  deferred: BooleanMap;
  firstIncomplete: number;
  onClose: () => void;
  onSelect: (day: number) => void;
  onBackup: () => void;
}) {
  if (!open) return null;
  return (
    <div className="level-overlay" role="dialog" aria-modal="true" aria-labelledby="level-list-title">
      <section className="level-panel">
        <header>
          <div>
            <h2 id="level-list-title">全部步骤</h2>
            <p>前面的关卡可以随时回来修改，后面的关卡可以先预览。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭关卡列表">关闭</button>
        </header>
        <button className="level-backup-button" type="button" onClick={onBackup}>备份与恢复</button>
        <div className="level-list">
          {visibleDays.map((day) => {
            const status = dayStatus(day.day, answers, completed, deferred, firstIncomplete);
            return (
              <button type="button" key={day.day} onClick={() => onSelect(day.day)}>
                <span>{getVisibleStep(day.day).label}</span>
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
