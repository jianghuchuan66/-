// ==================== 文案库 - 12种构图 × 多版本随机文案 ====================

export const KOUJUE: Record<string, string> = {
  symmetry:  '左右上下镜中映，画面均衡显稳重',
  contrast:  '明暗冷暖互碰撞，反差之中见张力',
  leading:   '线条引路入画深，目光随之探乾坤',
  frame:     '门窗洞口天然框，锁定主体聚目光',
  layering:  '远中近景叠三层，空间纵深自生成',
  point:     '万绿丛中一点红，极简主体最出众',
  thirds:    '两横两竖九宫分，交点落位定乾坤',
  repeat:    '重复元素排成阵，节奏韵律自呈现',
  dynamic:   '斜线倾斜破平衡，动感活力满画屏',
  center:    '主体居中最直接，稳定端庄显气节',
  whitespace:'留白胜于满填充，呼吸之间意境空',
  geometry:  '三角圆形藏画中，几何秩序显内功',
};

export const TIPS: Record<string, string[]> = {
  symmetry:   ['适合建筑、倒影、仪式感强的场景','确保对称轴两侧元素重量均衡','可加入微小不对称元素避免呆板'],
  contrast:   ['利用明暗、冷暖、大小对比制造冲突','对比越强烈，视觉冲击力越大','对比双方需要有内在联系'],
  leading:    ['寻找道路、栏杆、河流等天然引导线','引导线终点应放置视觉主体','从低角度拍摄效果更佳'],
  frame:      ['善用门、窗、拱门、树枝作为天然画框','框架不宜过厚，避免喧宾夺主','框架与主体之间应有空间感'],
  layering:   ['前景→中景→远景逐层展开','前景可虚化，远景可淡化，中景为核心','适合风光、街景类题材'],
  point:      ['主体越小、环境越简洁，效果越好','色彩反差是点构图的关键','极简背景+明显主体=高级感'],
  thirds:     ['最通用的构图法则，几乎适用所有场景','将主体关键部位（如眼睛）放在交点上','开启相机网格线辅助取景'],
  repeat:     ['找到重复的图案、形状、色彩','打破重复的一个元素会成为视觉焦点','注意保持画面整洁有序'],
  dynamic:    ['倾斜相机或从斜侧角度拍摄','适合运动、街头、活力场景','对角线角度越接近45°动感越强'],
  center:     ['主体居中，稳定有力','适合正式肖像、建筑、产品摄影','注意背景简洁，避免干扰'],
  whitespace: ['大面积空白让主体更突出','留白不是浪费，是高级的构图语言','空白方向应朝向主体'],
  geometry:   ['发现场景中的三角形、圆形、矩形','几何形状带来秩序感和稳定感','可用后期裁切强化几何结构'],
};

export const COMP_LABEL: Record<string, string> = {
  symmetry: '对称构图', contrast: '对比构图', leading: '引导线构图',
  frame: '框架构图', layering: '分层构图', point: '点构图',
  thirds: '三分构图', repeat: '重复元素构图', dynamic: '动态构图',
  center: '中央构图', whitespace: '留白构图', geometry: '几何形状构图',
};

export const SCENE_LABELS: Record<string, string> = {
  portrait: '👤 人像', landscape: '🏞️ 风光', arch: '🏛️ 建筑',
  still: '🍵 静物', sky: '🌤️ 极简/天空', street: '🚶 街景', unknown: '📷 通用',
};

export const SCENE_CLASS: Record<string, string> = {
  portrait: 'portrait', landscape: 'landscape', arch: 'arch',
  still: 'still', sky: 'sky', street: 'street', unknown: 'unknown',
};

// ---- 辅助 ----
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ---- 多版本文案库 ----
interface CopyEntry {
  great: string[];
  good: string[];
  issue: string[];
}

interface CopyLib {
  [key: string]: CopyEntry | {
    summary: string[];
    highlight: string[];
    suggestion: string[];
  } | {
    summary: string[];
    suggestion: string[];
  } | {
    crowded: string[];
    balanced: string[];
    airy: string[];
  } | {
    great: string;
    good: string;
    issue: string;
  };
}

function buildCopyLib(): CopyLib {
  const lib: CopyLib = {};
  const types = ['symmetry','contrast','leading','frame','layering','point','thirds','repeat','dynamic','center','whitespace','geometry'];
  for (const t of types) {
    const name = COMP_LABEL[t];
    lib[t] = {
      great: [
        `${name}运用纯熟，${KOUJUE[t].split('，')[0]}，整体表现专业到位。`,
        `${name}手法精准，画面视觉张力强，是典型的成功${name}案例。`,
        `${name}处理得当，${KOUJUE[t].split('，')[1]||'画面平衡协调'}，观感极为舒适。`,
      ],
      good: [
        `${name}效果呈现中上水平，整体不错，还可精益求精。`,
        `画面已有${name}雏形，微调后可进一步提升完成度。`,
      ],
      issue: [
        `${name}尚未形成明确框架，画面结构有待加强。`,
        `离${name}还有一段距离，建议拍摄时有意识地运用相关技巧。`,
      ],
    };
  }
  lib._minimal = {
    summary: [
      '画面以大面积留白为主，极简风格突出，无需刻意添加主体。',
      '整片画面干净简洁——留白本身就是最高级的构图。',
      '纯净的色调搭配克制的取景，呈现出高级的极简美学。',
    ],
    highlight: [
      '留白运用得当，画面通透感强，适合表达宁静、空旷的情绪。',
      '极简风格的高明之处在于"少即是多"，本图做到了。',
    ],
    suggestion: [
      '当前画面已是优秀的极简作品，保持这份干净就好。',
      '若想增加层次，在边缘引入微小点缀即可，但并非必须。',
    ],
  };
  lib._noSubject = {
    summary: ['这是一张氛围类照片，以整体色调和感受取胜，无需按传统标准评判主体位置。'],
    suggestion: ['无主体画面的魅力在于"感受"而非"焦点"，保持这种氛围就是最好的优化。'],
  };
  lib._spacing = {
    crowded: ['画面元素密集，视觉稍显拥挤。建议精简构图，给主体留出更多呼吸空间。'],
    balanced: ['画面疏密适中，留白与主体的比例关系良好，视觉舒适。'],
    airy: ['大面积留白营造出通透的高级感，画面呼吸感十足。'],
  };
  lib._tilt = {
    great: '画面水平线保持完美，稳定性出色。',
    good: '画面基本端正，观感舒适。',
    issue: '画面存在可见倾斜，建议后期旋转校正。',
  };
  return lib;
}

const CT = buildCopyLib();

export function getCopy(compType: string, quality: string): string {
  const c = CT[compType] as CopyEntry | undefined;
  if (!c) return '';
  const q = c[quality as keyof CopyEntry];
  return q ? pick(q as string[]) : '';
}

export function getMinimalCopy(field: string): string {
  const m = CT._minimal as { summary: string[]; highlight: string[]; suggestion: string[] };
  const arr = m[field as keyof typeof m];
  return arr ? pick(arr) : '';
}

export function getSpacingCopy(level: string): string {
  const s = CT._spacing as { crowded: string[]; balanced: string[]; airy: string[] };
  const arr = s[level as keyof typeof s] || s.balanced;
  return pick(arr);
}
