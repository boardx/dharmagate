/** Owned synthesis recipes, not Insight Timer recordings or a claim to its complete library. */
export const SOUNDS=Object.freeze([
 {id:'silent',name:'安静',group:'安静',description:'不播放合成声音，留意已有的环境。',continuous:false,original:true},
 {id:'basu-bowl',name:'低钵',group:'钟钵',description:'Basu 类低钵的原创合成示意；缓慢金属余韵，非原版录音。',continuous:false,original:true},
 {id:'bell',name:'清钟',group:'钟钵',description:'轻柔清亮的单次合成钟音。',continuous:false,original:true},
 {id:'wind-gong',name:'风锣',group:'钟钵',description:'低频起伏与非整数泛音的原创合成。',continuous:false,original:true},
 {id:'crystal-bowl',name:'E 调水晶钵',group:'钟钵',description:'E 调附近的长余韵与轻微拍频，非器物实录。',continuous:false,original:true},
 {id:'tuning-fork',name:'音叉',group:'钟钵',description:'近似纯音与短暂高泛音的原创示意。',continuous:false,original:true},
 {id:'church-bell',name:'教堂钟',group:'钟钵',description:'带次低音与非整数泛音的合成钟声。',continuous:false,original:true},
 {id:'frame-drum',name:'框鼓',group:'打击乐',description:'低鼓膜共鸣与短噪声敲击；原创合成。',continuous:false,original:true},
 {id:'rav-drum',name:'RAV 类钢舌鼓',group:'打击乐',description:'多个柔和音高的合成共鸣，非品牌录音。',continuous:false,original:true},
 {id:'handpan',name:'手碟',group:'打击乐',description:'短促起音与金属谐波的合成示意。',continuous:false,original:true},
 {id:'rainstick',name:'雨棍',group:'打击乐',description:'逐渐衰减的颗粒噪声，非实物录音。',continuous:false,original:true},
 {id:'rain',name:'雨意',group:'自然',description:'持续的细雨质感与稀疏颗粒；原创自然感合成。',continuous:true,original:true},
 {id:'ocean',name:'海浪',group:'自然',description:'缓慢涨落的宽带声景，非海边实录。',continuous:true,original:true},
 {id:'wild-wind',name:'旷野风',group:'自然',description:'低沉风声与缓慢起伏的气流质感。',continuous:true,original:true},
 {id:'brown',name:'棕噪声',group:'噪声',description:'偏低频的连续噪声；合成近似，不作疗效承诺。',continuous:true,original:true},
 {id:'pink',name:'粉红噪声',group:'噪声',description:'多频带混合的粉红噪声近似，与棕噪声分别生成。',continuous:true,original:true},
 {id:'a-major',name:'A 大调',group:'和声与持续音',description:'A 大调三和弦的持续合成声。',continuous:true,original:true},
 {id:'d-major',name:'D 大调',group:'和声与持续音',description:'D 大调三和弦的持续合成声。',continuous:true,original:true},
 {id:'om-drone',name:'Om 意象持续音',group:'和声与持续音',description:'低音谐波与缓慢起伏；不是人声、真言或传承修法。',continuous:true,original:true},
 {id:'humming',name:'哼鸣意象',group:'和声与持续音',description:'带轻微振动的谐波合成，不是人声录音。',continuous:true,original:true},
 {id:'solfeggio',name:'Solfeggio 类持续音',group:'和声与持续音',description:'数个音高的原创持续组合；不宣称频率疗效。',continuous:true,original:true}
].map(Object.freeze));
export const SOUND_IDS=Object.freeze(SOUNDS.map(sound=>sound.id));
export const PLAYABLE_SOUND_IDS=Object.freeze(SOUND_IDS.filter(id=>id!=='silent'));
export const SOUND_BY_ID=Object.freeze(Object.fromEntries(SOUNDS.map(sound=>[sound.id,sound])));
/** Timer cues are finite only; ambient and harmony loops cannot become timer reminders. */
export const CUE_CHOICES=Object.freeze([
 {...SOUND_BY_ID.silent,name:'无声'},
 {id:'soft-bell',name:'清钟',group:'钟钵',description:'清亮余韵 · 单次原创合成',continuous:false,original:true},
 {id:'deep-bell',name:'深钟',group:'钟钵',description:'低沉余韵 · 单次原创合成',continuous:false,original:true},
 {id:'wood',name:'木音',group:'打击乐',description:'短促敲击 · 单次原创合成',continuous:false,original:true},
 ...SOUNDS.filter(sound=>!sound.continuous&&!['silent','bell'].includes(sound.id))
].map(Object.freeze));
export const CUE_IDS=Object.freeze(CUE_CHOICES.map(cue=>cue.id));
