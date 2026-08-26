import { env } from 'cloudflare:workers';

type OptimizeContext = {
  audience?: string;
  mainProblem?: string;
  outcome?: string;
  suitableFor?: string;
  commonProblems?: string[];
  evidence?: string;
};

type OptimizeRequest = {
  draft?: string;
  context?: OptimizeContext;
};

type KimiMessageResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: Request) {
  const now = Date.now();
  const client = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'local';
  const current = requestCounts.get(client);

  if (!current || current.resetAt <= now) {
    requestCounts.set(client, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function safeText(value: unknown, limit = 500) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== requestUrl.host) {
    return Response.json({ error: '请求来源无效。' }, { status: 403 });
  }

  if (isRateLimited(request)) {
    return Response.json({ error: '操作太频繁，请稍后再试。' }, { status: 429 });
  }

  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const apiKey = runtimeEnv.KIMI_API_KEY ?? process.env.KIMI_API_KEY;
  const baseUrl = (
    runtimeEnv.KIMI_BASE_URL
    ?? process.env.KIMI_BASE_URL
    ?? 'https://api.kimi.com/coding/v1'
  ).replace(/\/$/u, '');
  const model = runtimeEnv.KIMI_MODEL ?? process.env.KIMI_MODEL ?? 'kimi-k2.6';
  if (!apiKey) {
    return Response.json({ error: '优化服务尚未配置。' }, { status: 503 });
  }

  let body: OptimizeRequest;
  try {
    body = await request.json() as OptimizeRequest;
  } catch {
    return Response.json({ error: '提交内容无法读取。' }, { status: 400 });
  }

  const draft = safeText(body.draft, 1_200);
  if (!draft) {
    return Response.json({ error: '请先生成一份服务说明。' }, { status: 400 });
  }

  const context = body.context ?? {};
  const structuredContext = {
    目标客户: safeText(context.audience),
    主问题: safeText(context.mainProblem),
    希望客户得到的结果: safeText(context.outcome),
    适合的人: safeText(context.suitableFor),
    常见卡点: Array.isArray(context.commonProblems)
      ? context.commonProblems.slice(0, 5).map((item) => safeText(item)).filter(Boolean)
      : [],
    经验事实: safeText(context.evidence, 800),
  };

  try {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: [
          '你是一名中文服务产品文案编辑。',
          '把用户的服务说明改成一段自然、具体、容易理解的中文。',
          '保留已有事实，不新增成绩、数字、客户或能力。',
          '删掉重复的人群和问题，不要机械拼接。',
          '如果材料彼此不一致，以目标客户、主问题和结果为主，只保留与它们自然相关的经验。',
          '控制在 200 个汉字以内。只返回一段优化后的正文，不要多个版本，不要标题、解释、列表或 Markdown。',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: `已确认的信息：\n${JSON.stringify(structuredContext, null, 2)}\n\n当前服务说明：\n${draft}`,
          },
        ],
        ...(model === 'kimi-k2.6' ? { thinking: { type: 'disabled' } } : {}),
      }),
    });

    if (!response.ok) {
      const upstreamError = await response.text().catch(() => '');
      console.error('Kimi Messages response error', response.status, upstreamError.slice(0, 180));
      return Response.json({ error: '优化服务暂时不可用，请稍后再试。' }, { status: 502 });
    }

    const result = await response.json() as KimiMessageResponse;
    const optimized = result.content
      ?.filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text?.trim())
      .filter(Boolean)
      .join('\n')
      .trim()
      .replace(/^['“”]+|['“”]+$/g, '');
    if (!optimized) {
      return Response.json({ error: '这次没有生成有效结果，请再试一次。' }, { status: 502 });
    }

    return Response.json({ optimized: optimized.slice(0, 500) });
  } catch {
    return Response.json({ error: '网络暂时不可用，请稍后再试。' }, { status: 502 });
  }
}
