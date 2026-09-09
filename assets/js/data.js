/* ============================================================
   数字文娱智库 — 模拟数据（基于 2026 年 9 月真实公开信息）
   数据来源：猫眼专业版 / DataEye / 国家广电总局 / 文旅部 /
             人民网 / 新浪娱乐 / 第一财经 / 各地文旅局 等
   说明：热度数值为演示用相对值，事件本身均为真实发生。
   ============================================================ */
(function(){
const rnd = (a,b)=>Math.round(a+Math.random()*(b-a));
const curve = (base, n, vol, drift)=>{
  let v=base, out=[];
  for(let i=0;i<n;i++){ v = Math.max(5, v + rnd(-vol,vol) + drift); out.push(Math.round(v)); }
  return out;
};
const now = Date.now();
/* 数据时效计算的“基准现在”。在线模式下前端用服务端实时时间覆盖本值；
   此处仅在离线/file:// 回退时使用真实当前时间，避免时效冻死在旧日期。 */
const REF_NOW = Date.now();
/* 数据版本号：每次更新/新增情报后请手动 +1（如 .1 → .2）。
   前端每 60s 校验此版本号，变化即自动刷新，使所有被分享者实时获取最新情报。 */
window.DATA_VERSION = '2026-09-08.1';
/* 距现在 N 天/小时/分钟前的 ISO 时间，用于生成 updatedAt */
const upd = (d=0,h=0,m=0)=> new Date(REF_NOW - ((d*24+h)*60+m)*60000).toISOString();
const mins = m => new Date(now - m*60000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
const days = d => { const t=new Date(now + d*86400000); return `${t.getMonth()+1}月${t.getDate()}日`; };

const PLATFORMS = [
  {key:'weibo', name:'微博', color:'#ff5a6a'},
  {key:'douyin', name:'抖音', color:'#2ee6e6'},
  {key:'bilibili', name:'B站', color:'#4d8dff'},
  {key:'xhs', name:'小红书', color:'#ff7ac0'},
  {key:'news', name:'新闻媒体', color:'#aab6d4'},
];

/* ---------- DEI 数字文娱指数 ---------- */
const DEI = {
  value: 76.8, delta: +2.1,
  weights: [
    {name:'搜索热度', w:20, on:true},
    {name:'社交讨论', w:20, on:true},
    {name:'视频传播', w:20, on:true},
    {name:'媒体报道', w:15, on:true},
    {name:'增长速度', w:15, on:true},
    {name:'跨平台扩散', w:10, on:true},
  ],
  modelVersion:'DEI-v1.2',
  window:'滚动 7 天',
  note:'权重变更须保留版本号；正式上线前用历史样本回测。',
  sub: [
    {name:'AI漫剧指数', key:'ai', value: 82.3, delta:+9.7, color:'#a855f7'},
    {name:'电影声量',   key:'movie', value: 79.5, delta:+1.8, color:'#4d8dff'},
    {name:'演唱会热度', key:'concert', value: 71.2, delta:+3.6, color:'#2ee6e6'},
    {name:'短剧声量',   key:'short', value: 74.6, delta:+2.3, color:'#ffb547'},
  ],
  curve: curve(58, 40, 4, 0.38),
};

/* ---------- 实时热点（基于 2026 年 9 月真实事件）---------- */
function srcs(pairs){
  return pairs.map(([k,c])=>({...PLATFORMS.find(p=>p.key===k), count:c}));
}
const HOTSPOTS = [
  {
    id:'h1', rank:1, title:'《欢迎来龙餐馆》票房突破 20 亿，豆瓣从 8.4 逆袭至 8.7', category:'电影',
    heat:968, growth1h:+8.2, status:'boom', firstSeen:mins(120), lastUpdate:mins(3), updatedAt:upd(0,0,3),
    platforms:['weibo','douyin','bilibili','news'],
    summary:'文牧野执导、沈腾/蒋奇明主演的《欢迎来龙餐馆》截至 9 月 4 日累计票房突破 20 亿元，豆瓣评分从开分的 8.4 逆势上涨至 8.7，成为 2026 年暑期档唯一评分逆势上涨的头部影片，连续 20 天蝉联单日票房冠军。',
    keywords:['欢迎来龙餐馆','沈腾','票房破20亿','豆瓣逆袭','文牧野'],
    heatCurve: curve(380, 48, 18, 9),
    sourceMatrix: srcs([['weibo',2150],['douyin',2890],['bilibili',1120],['news',680]]),
    related:[
      {type:'作品', name:'《欢迎来龙餐馆》', id:'p_huanying'},
      {type:'人物', name:'沈腾', id:'a_shenteng'},
      {type:'人物', name:'文牧野（导演）', id:'a_wenmuye'},
    ],
    timeline:[
      {t:mins(120), text:'暑期档上映，首日票房破亿'},
      {t:mins(80), text:'连续多日单日票房冠军'},
      {t:mins(36), text:'豆瓣评分从 8.4 逆袭至 8.7', active:true},
      {t:mins(3), text:'累计票房突破 20 亿大关'},
    ],
    originals:[
      {title:'《欢迎来龙餐馆》票房破20亿口碑逆袭', src:'大皖新闻/腾讯娱乐', url:'https://view.inews.qq.com/a/20260905A079VJ00', published:mins(30), status:'ok'},
      {title:'当前热映电影票房榜', src:'网易订阅/猫眼专业版', url:'https://dy.163.com/article/L62OJTPF0556C2DW.html', published:mins(45), status:'ok'},
      {title:'影视日报：暑期档124亿收官', src:'腾讯新闻/影视日报', url:'https://new.qq.com/rain/a/20260905A07TWT00', published:mins(60), status:'ok'},
    ],
  },
  {
    id:'h2', rank:2, title:'人人影视变正版冲上热搜第一，月费 25 元引发讨论', category:'平台',
    heat:923, growth1h:+15.6, status:'boom', firstSeen:mins(180), lastUpdate:mins(5), updatedAt:upd(0,0,5),
    platforms:['weibo','douyin','news','bilibili'],
    summary:'9 月 4 日"人人影视变正版了"登热搜第一。新版 APP 由华数传媒发行、片源正版购买，月费 25 元、季费 60 元、年费 175 元，老用户赠 1 个月会员。官方回应称仍处前期公测，月底正式发布。',
    keywords:['人人影视','正版化','华数传媒','字幕组','追剧'],
    heatCurve: curve(200, 48, 24, 14),
    sourceMatrix: srcs([['weibo',3420],['douyin',1980],['news',1560],['bilibili',890]]),
    related:[
      {type:'公司', name:'华数传媒', id:'co_huashu'},
    ],
    timeline:[
      {t:mins(180), text:'人人影视新版 APP 上线消息传出'},
      {t:mins(60), text:'登微博热搜第一，引发热议'},
      {t:mins(10), text:'官方回应：仍处公测期', active:true},
      {t:mins(5), text:'讨论持续发酵，定价争议与情怀并存'},
    ],
    originals:[
      {title:'人人影视变正版冲上热搜第一', src:'经视直播/腾讯新闻', url:'https://view.inews.qq.com/a/20260904A0620500', published:mins(20), status:'ok'},
      {title:'人人影视App上线力争激活三千万存量用户', src:'IT时代网', url:'https://new.qq.com/rain/a/20260905A07RZU00', published:mins(40), status:'ok'},
    ],
  },
  {
    id:'h3', rank:3, title:'AI 剧首登湖南卫视黄金档，《后西游记》打破影视圈旧玩法', category:'AI漫剧',
    heat:891, growth1h:+11.3, status:'boom', firstSeen:mins(240), lastUpdate:mins(2), updatedAt:upd(0,0,2),
    platforms:['douyin','weibo','news','bilibili'],
    summary:'继安徽卫视播出 AIGC 中剧《桃花潭记》后，《后西游记》登陆湖南卫视黄金档，AI 剧从网络试水走向卫视大屏。西影、TVB 等老牌厂牌全面拥抱 AI，影视行业大变局拉开帷幕。',
    keywords:['AI剧','后西游记','湖南卫视','上星','西影','TVB'],
    heatCurve: curve(320, 48, 16, 11),
    sourceMatrix: srcs([['douyin',2650],['weibo',1420],['news',1180],['bilibili',760]]),
    related:[
      {type:'作品', name:'《后西游记》（AI 剧）', id:'p_houxiyouji'},
      {type:'作品', name:'《桃花潭记》（AI 剧）', id:'p_taohuatangji'},
    ],
    timeline:[
      {t:mins(240), text:'安徽卫视播出《桃花潭记》'},
      {t:mins(120), text:'《后西游记》登陆湖南卫视黄金档'},
      {t:mins(30), text:'第一财经深度报道：AI 剧打破旧玩法', active:true},
      {t:mins(2), text:'西影、TVB 拥抱 AI 引发行业讨论'},
    ],
    originals:[
      {title:'AI剧上星打破影视圈旧玩法', src:'第一财经', url:'https://mp.weixin.qq.com/s?__biz=MjM5MTM3NTMwNA==&mid=2661799951&idx=2', published:mins(28), status:'ok'},
      {title:'影视热榜：AI剧上星', src:'腾讯新闻/影视热榜', url:'https://new.qq.com/rain/a/20260904A076XH00', published:mins(50), status:'ok'},
    ],
  },
  {
    id:'h4', rank:4, title:'AI 偶像剧《漂亮的恶意》单集播放近 5000 万，涨粉 70 万', category:'AI漫剧',
    heat:856, growth1h:+18.7, status:'boom', firstSeen:mins(300), lastUpdate:mins(1), updatedAt:upd(0,0,1),
    platforms:['douyin','xhs','bilibili','weibo'],
    summary:'AI 偶像剧《漂亮的恶意》和《The Accident》突然走红。截至发稿前，《漂亮的恶意》仅发布一集就在抖音获赞 331 万、播放量超 4679 万、涨粉超 70 万；《The Accident》发布 4 集后收获 5499 万播放量。网友留言："告诉内娱，我在短剧 AI 世界不回去了。"',
    keywords:['漂亮的恶意','The Accident','AI偶像剧','抖音','涨粉'],
    heatCurve: curve(280, 48, 20, 14),
    sourceMatrix: srcs([['douyin',3120],['xhs',1340],['bilibili',980],['weibo',620]]),
    related:[
      {type:'作品', name:'《漂亮的恶意》（AI 剧）', id:'p_piaoliang'},
      {type:'作品', name:'《The Accident》（AI 剧）', id:'p_accident'},
    ],
    timeline:[
      {t:mins(300), text:'《漂亮的恶意》首集发布'},
      {t:mins(120), text:'抖音播放量突破 4000 万'},
      {t:mins(30), text:'《The Accident》4 集累计 5499 万播放', active:true},
      {t:mins(1), text:'持续霸榜，"不回内娱"评论刷屏'},
    ],
    originals:[
      {title:'首集涨粉70万、播放近5000万，AI偶像剧开始接管内娱', src:'新榜/腾讯新闻', url:'https://ima.qq.com/wiki/?shareId=a24aea08c234f4607c60de19e4adf38e145c0c157675d1c5c275fe76948d5993', published:mins(25), status:'ok'},
    ],
  },
  {
    id:'h5', rank:5, title:'《微短剧发展管理办法》9 月 1 日施行，行业告别野蛮生长', category:'政策',
    heat:834, growth1h:+5.4, status:'rise', firstSeen:mins(360), lastUpdate:mins(8), updatedAt:upd(0,0,8),
    platforms:['weibo','news','douyin'],
    summary:'国家广播电视总局令第 16 号《微短剧发展管理办法》于 9 月 1 日正式施行，共八章五十四条。同日"微短剧统一标识"（苔花灵感、红底金色）正式启用。办法明确分类分层审核、AI 生成内容标识、算法治理等要求。',
    keywords:['微短剧管理办法','总局令第16号','分类分层','AI标识','统一标识'],
    heatCurve: curve(500, 48, 12, 5),
    sourceMatrix: srcs([['weibo',1280],['news',1680],['douyin',720]]),
    related:[
      {type:'政策', name:'《微短剧发展管理办法》', id:'pol_weiduanju'},
      {type:'政策', name:'微短剧精品创作传播计划', id:'pol_jingpin'},
    ],
    timeline:[
      {t:mins(360), text:'办法全文公布，定于 9/1 施行'},
      {t:mins(200), text:'各地广电局开展细则落地与培训'},
      {t:mins(8), text:'施行一周后，行业反馈平稳过渡', active:true},
    ],
    originals:[
      {title:'《微短剧发展管理办法》9月1日施行:政策要点解读', src:'广东省广播电视局', url:'https://gbdsj.gd.gov.cn/zxzx/hydt/content/post_4949660.html', published:mins(360), status:'ok'},
      {title:'微短剧有了统一"身份证"', src:'人民网', url:'https://ent-app.people.cn/n1/2026/0903/c1012-40791494.html', published:mins(200), status:'ok'},
      {title:'微短剧新规实施：加强监管与扶持', src:'腾讯新闻/北京青年报', url:'https://gu.qq.com/resources/shy/news/detail-v2/index.html', published:mins(100), status:'ok'},
    ],
  },
  {
    id:'h6', rank:6, title:'李荣浩成都巡演首场售罄加场，9 月演出市场全面井喷', category:'演唱会',
    heat:789, growth1h:+6.8, status:'rise', firstSeen:mins(420), lastUpdate:mins(10), updatedAt:upd(0,0,10),
    platforms:['weibo','douyin','xhs','news'],
    summary:'9 月演出市场迎来井喷期。李荣浩"黑马"世界巡回演唱会 9 月 5 日在成都东安湖体育公园首场售罄，9 月 6 日加场又售罄。同期罗云熙回归家乡开唱、单依纯 9/12 成都连开两天、汪峰 9/19、王源 9/19-20 连开两场、那英 9/26 时隔 7 年重开巡演。',
    keywords:['李荣浩','成都','演唱会','售罄','演出市场井喷'],
    heatCurve: curve(450, 48, 14, 6),
    sourceMatrix: srcs([['weibo',1580],['douyin',1120],['xhs',940],['news',520]]),
    related:[
      {type:'活动', name:'李荣浩"黑马"世界巡回演唱会', id:'ev_lironghao'},
      {type:'人物', name:'李荣浩', id:'a_lironghao'},
      {type:'活动', name:'王源 2026 巡回演唱会', id:'ev_wangyuan'},
    ],
    timeline:[
      {t:mins(420), text:'9 月演出阵容陆续官宣'},
      {t:mins(200), text:'李荣浩成都站开票即售罄'},
      {t:mins(30), text:'宣布 9/6 加场，再次秒罄', active:true},
      {t:mins(10), text:'多家媒体盘点 9 月演出热潮'},
    ],
    originals:[
      {title:'李荣浩、那英、王源、汪峰……人气唱将齐聚四川开启9月演出热潮', src:'川观新闻/今日头条', url:'https://www.toutiao.com/article/7680510082559263272/', published:mins(420), status:'ok'},
      {title:'演唱会、音乐会、音乐节扎堆来袭!9月成都令人期待', src:'搜狐', url:'https://www.sohu.com/a/1070562947_355475', published:mins(200), status:'ok'},
    ],
  },
  {
    id:'h7', rank:7, title:'AI 漫剧《砚边青梅》以《祭侄文稿》为蓝本走红，传统文化 + AI 引热议', category:'AI漫剧',
    heat:745, growth1h:+7.2, status:'rise', firstSeen:mins(480), lastUpdate:mins(12), updatedAt:upd(0,0,12),
    platforms:['douyin','xhs','bilibili','news'],
    summary:'AI 漫剧《砚边青梅》火爆全网。剧集以颜真卿传世名作《祭侄文稿》为蓝本，嫁接穿越叙事，将安史之乱搬上屏幕。红果短剧平台热度超 4000 万、收藏突破 80 万，抖音相关话题总播放量达 2 亿次。网友评价："看完主动去查史料。"',
    keywords:['砚边青梅','祭侄文稿','颜真卿','AI漫剧','传统文化'],
    heatCurve: curve(380, 48, 13, 7),
    sourceMatrix: srcs([['douyin',1860],['xhs',1240],['bilibili',780],['news',340]]),
    related:[
      {type:'作品', name:'《砚边青梅》（AI 漫剧）', id:'p_yanbian'},
    ],
    timeline:[
      {t:mins(480), text:'《砚边青梅》上线'},
      {t:mins(200), text:'红果热度突破 4000 万'},
      {t:mins(60), text:'湖南日报发文探讨 AI 漫剧与传统文化', active:true},
      {t:mins(12), text:'抖音话题播放量达 2 亿'},
    ],
    originals:[
      {title:'AI漫剧能否承载传统文化之重——以《砚边青梅》为例', src:'湖南日报/今日头条', url:'https://www.toutiao.com/article/7680485015389602354/', published:mins(60), status:'ok'},
    ],
  },
  {
    id:'h8', rank:8, title:'广州超级草莓音乐节全阵容官宣，三天三十余组艺人', category:'音乐节',
    heat:698, growth1h:+4.1, status:'stable', firstSeen:mins(540), lastUpdate:mins(18), updatedAt:upd(0,0,18),
    platforms:['weibo','douyin','xhs'],
    summary:'2026 广州超级草莓音乐节定档 9 月 25-27 日，南沙音乐秀场。三日阵容包括：AURORA、告五人、回春丹、薛凯琪、卫兰、Supper Moment、吴克群、徐佳莹、许钧、曾轶可、Phum Viphurit、Belle & Sebastian、痛仰等三十余组艺人。',
    keywords:['草莓音乐节','广州','南沙','阵容官宣','音乐节'],
    heatCurve: curve(520, 48, 10, 4),
    sourceMatrix: srcs([['weibo',920],['douyin',780],['xhs',650]]),
    related:[
      {type:'活动', name:'2026 广州超级草莓音乐节', id:'v_caomei'},
    ],
    timeline:[
      {t:mins(540), text:'广州超级草莓音乐节定档官宣'},
      {t:mins(120), text:'全阵容公布，引发乐迷讨论'},
      {t:mins(18), text:'预售票务信息公布', active:true},
    ],
    originals:[
      {title:'9月的广州：超级草莓音乐节等演出清单', src:'广州市文化广电旅游局', url:'https://www.gz.gov.cn/', published:mins(540), status:'ok'},
    ],
  },
];

/* ---------- 文娱榜单（基于真实票房/热度数据）---------- */
const RANKINGS = {
  movies:[
    {name:'欢迎来龙餐馆', sub:'剧情 · 热映中', heat:968, meta:'累计 20.21 亿 / 豆瓣 8.7 ↑ / 沈腾 蒋奇明', trend:'up'},
    {name:'空枪', sub:'犯罪 · 热映中', heat:812, meta:'累计 4.56 亿 / 朱一龙 檀健次 梁家辉', trend:'up'},
    {name:'奥德赛', sub:'冒险 · 热映中', heat:789, meta:'累计 6.24 亿 / 豆瓣 8.6 / 马特·达蒙 汤姆·赫兰德', trend:'stable'},
    {name:'八仙!', sub:'国产动画 · 热映中', heat:745, meta:'累计 18.56 亿 / 复购率 6.9% 暑期档第三', trend:'stable'},
    {name:'蜘蛛侠：崭新之日', sub:'超级英雄 · 热映中', heat:702, meta:'累计 15.49 亿 / 汤姆·赫兰德 赞达亚', trend:'down'},
    {name:'痴迷', sub:'爱情 · 热映中', heat:621, meta:'累计 2.19 亿 / 上映 42 天', trend:'down'},
  ],
  concerts:[
    {name:'李荣浩"黑马"世界巡演', sub:'流行 · 多城 · 售罄加场', heat:912, meta:'成都 9/5-6 东安湖体育公园 / 首场售罄', trend:'up'},
    {name:'王源"宇宙超级无敌大大狂欢"', sub:'流行 · 体育场', heat:867, meta:'成都 9/19-20 连开两场 / 曲目容量 70+', trend:'up'},
    {name:'那英"我来，因为你在"', sub:'流行 · 时隔 7 年重开', heat:823, meta:'成都 9/26 凤凰山体育馆 / 三十余首金曲', trend:'up'},
    {name:'单依纯"纯妹妹 2.0"', sub:'流行 · 剧场', heat:756, meta:'成都 9/12-13 凤凰山 / 连续两年蓉城开唱', trend:'stable'},
    {name:'汪峰"相信未来"巡演', sub:'摇滚 · 体育场', heat:698, meta:'成都 9/19 金融城演艺中心 / 出道三十年', trend:'stable'},
    {name:'张韶涵"玩家"巡演', sub:'流行 · 体育场', heat:674, meta:'宜昌 9/5 / 黄石 9/12 / 万人 KTV 现场', trend:'up'},
  ],
  festivals:[
    {name:'广州超级草莓音乐节', sub:'9/25-27 南沙 · 30+ 组艺人', heat:856, meta:'AURORA / 告五人 / 薛凯琪 / 痛仰 / 许钧', trend:'up'},
    {name:'葫芦果音乐节', sub:'9/26-27 成都非遗博览园', heat:723, meta:'陶喆 / 范晓萱 / 杨乃文 / 揽佬', trend:'up'},
    {name:'武汉 X 乐园音乐节', sub:'9/12-13 空港音乐广场', heat:654, meta:'任嘉伦 / 宝石Gem / 欧豪 / 张远', trend:'up'},
    {name:'BAZAARGALA 芭莎之夜', sub:'9/25-26 武汉空港广场', heat:512, meta:'时尚大刊打造 / 双日狂欢', trend:'new'},
  ],
  shortdramas:[
    {name:'好雨知时节', sub:'都市情感 · 断层顶流', heat:901, meta:'热度 6073 万 / 全网播放 3.77 亿 / 红果短剧', trend:'up'},
    {name:'以爱为家 第四季', sub:'生活流群像 · 热播', heat:834, meta:'热度 5967 万 / 评分 9.3→9.4 / 第四季', trend:'up'},
    {name:'回家认亲，我拿百万测试人心', sub:'豪门测试 · 新剧', heat:778, meta:'热度 5734 万 / 评分 9.0 / 新剧上榜', trend:'new'},
    {name:'破笼', sub:'大女主逆袭 · 黑马', heat:712, meta:'余茵 张翅二搭 / 热度飙升 / 爽剧', trend:'up'},
    {name:'狂徒', sub:'悬疑刑侦 · 男频', heat:656, meta:'话题播放 2.1 亿 / 写实悬疑 / 全程高能', trend:'stable'},
  ],
  aimanga:[
    {name:'漂亮的恶意', sub:'AI 偶像剧 · 爆款', heat:891, meta:'抖音播放 4679 万 / 涨粉 70 万 / 单集', trend:'up'},
    {name:'The Accident', sub:'AI 偶像剧 · 爆款', heat:845, meta:'抖音播放 5499 万 / 涨粉 53 万 / 4 集', trend:'up'},
    {name:'砚边青梅', sub:'传统文化 AI 漫剧 · 热议', heat:778, meta:'红果热度 4000 万+ / 抖音话题 2 亿', trend:'up'},
    {name:'烫嘴的免费午饭', sub:'3D 漫 · 日榜冠军', heat:723, meta:'DataEye 日播 2.5 亿 / 9/4 登顶', trend:'up'},
    {name:'万妖图录传', sub:'国风玄幻 · 长线 IP', heat:667, meta:'全网播放破 60 亿 / 单季热度 1.24 亿', trend:'stable'},
  ],
  music:[
    {name:'《黑马》（李荣浩专辑主打）', sub:'李荣浩 · 单曲', heat:856, meta:'巡演核心曲目 / 播放量持续攀升', trend:'up'},
    {name:'《隐形的翅膀》（张韶涵巡演曲目）', sub:'张韶涵 · 经典翻红', heat:723, meta:'巡演必唱曲目 / DNA 动了', trend:'up'},
    {name:'《Take Me To Your Heart》', sub:'迈克学摇滚 · 经典', heat:645, meta:'迈克学摇滚广州站 9/26', trend:'stable'},
  ],
  artists:[
    {name:'沈腾', sub:'演员', heat:968, meta:'声量 9.8 / 《欢迎来龙餐馆》20 亿主演', trend:'up'},
    {name:'李荣浩', sub:'歌手 / 创作人', heat:912, meta:'声量 9.4 / "黑马"巡演售罄加场', trend:'up'},
    {name:'王源', sub:'歌手 / 演员', heat:867, meta:'声量 9.1 / 成都连开两场 / 曲目 70+', trend:'up'},
    {name:'那英', sub:'歌手', heat:823, meta:'声量 8.9 / 时隔 7 年重开巡演', trend:'up'},
  ],
};

/* ---------- 项目/IP 库 ---------- */
const PROJECTS = [
  {id:'p_huanying', type:'作品', name:'《欢迎来龙餐馆》', subject:'中国电影股份有限公司等', time:'2026-08-11 上映', updatedAt:upd(0,1,20),
   heat:968, curve:curve(380,40,18,9), rankChange:'↑ 1',
   platforms:['微博','抖音','B站','新闻'], news:['票房破20亿','豆瓣8.7逆袭','连续20天日冠'],
   topics:['#欢迎来龙餐馆#','#沈腾#','#文牧野#'], related:[{t:'人物',n:'沈腾'},{t:'人物',n:'文牧野（导演）'}],
   official:'https://piaofang.maoyan.com', desc:'文牧野执导、沈腾/蒋奇明主演的剧情片，以反战为主题，截至 9 月 4 日累计票房突破 20 亿元，豆瓣评分 8.7。'},
  {id:'p_houxiyouji', type:'作品', name:'《后西游记》（AI 剧）', subject:'湖南卫视 / AI 制作团队', time:'2026-09 湖南卫视黄金档', updatedAt:upd(0,1,5),
   heat:891, curve:curve(320,40,16,11), rankChange:'↑ 5',
   platforms:['抖音','微博','新闻','B站'], news:['首登湖南卫视黄金档','AI剧上星打破旧玩法'],
   topics:['#后西游记#','#AI剧上星#'], related:[{t:'作品',n:'《桃花潭记》（AI 剧）'}],
   official:'', desc:'AIGC 生成的《后西游记》登陆湖南卫视黄金档，标志着 AI 剧从网络试水走向卫视大屏。'},
  {id:'p_piaoliang', type:'作品', name:'《漂亮的恶意》（AI 偶像剧）', subject:'AI 制作团队', time:'2026-09 抖音上线', updatedAt:upd(0,0,40),
   heat:856, curve:curve(280,40,20,14), rankChange:'NEW',
   platforms:['抖音','小红书','B站','微博'], news:['单集播放4679万','涨粉70万','AI偶像剧爆火'],
   topics:['#漂亮的恶意#','#AI偶像剧#'], related:[{t:'作品',n:'《The Accident》（AI 剧）'}],
   official:'https://ima.qq.com/wiki/', desc:'AI 生成的韩式偶像剧风格短剧，凭借财阀/霸凌/校园明星等经典元素迅速出圈，单集抖音播放超 4679 万。'},
  {id:'ev_lironghao', type:'活动', name:'李荣浩"黑马"世界巡回演唱会', subject:'梦响当然/李荣浩工作室', time:'2026-09 起 多城', updatedAt:upd(0,2,0),
   heat:912, curve:curve(450,40,14,6), rankChange:'↑ 3',
   platforms:['微博','抖音','小红书','新闻'], news:['成都首场售罄','加场再售罄'],
   topics:['#李荣浩巡演#','#黑马专辑#'], related:[{t:'人物',n:'李荣浩'}],
   official:'https://www.damai.cn', desc:'李荣浩第五轮大型世界巡演，以第八张个人专辑《黑马》为核心，成都东安湖首场及加场均售罄。'},
  {id:'pol_weiduanju', type:'政策', name:'《微短剧发展管理办法》', subject:'国家广播电视总局', time:'2026-09-01 施行', updatedAt:upd(0),
   heat:834, curve:curve(500,40,12,5), rankChange:'↑ 2',
   platforms:['微博','新闻','抖音'], news:['9/1 正式施行','统一标识启用','分类分层审核'],
   topics:['#微短剧管理办法#','#总局令16号#'], related:[{t:'政策',n:'微短剧精品创作传播计划'}],
   official:'https://www.nrta.gov.cn', desc:'国家广播电视总局令第 16 号，共八章五十四条，我国首部专门针对微短剧发展的管理办法。'},
];

/* ---------- 政策智库（基于真实政策文件）---------- */
const POLICIES = [
  {id:'pol_weiduanju', title:'《微短剧发展管理办法》', docNo:'国家广播电视总局令 第 16 号',
   dept:'国家广播电视总局', pubDate:'2026-09-01', effDate:'2026-09-01', status:'现行有效', updatedAt:upd(0),
   tags:['备案/许可','微短剧监管','人工智能应用','算法治理','消费者权益'], level:'国家',
   aiSummary:'我国首部专门针对微短剧发展的管理办法，共八章五十四条。实行分类分层审核（一类特殊题材/大投资、二类一般题材、三类小投资），要求 AI 生成内容添加标识，将算法治理纳入约束，同时鼓励精品创作与出海。',
   clauses:['单集时长少于 20 分钟、主题主线明确、故事情节连续完整的剧集属于微短剧','实行一类/二类/三类分类分层审核与许可管理','使用 AI 技术生成制作的微短剧须在每集明显位置添加提示标识','播出单位应定期审核评估算法机制，优先推荐优质微短剧','建立重点账号信用评价体系与违规主体退出机制','违规最高可处十万元罚款'],
   impact:'行业从"野蛮生长"转向"合规+精品"双轮驱动。每 77 部新剧仅 1 部回本的现状下，合规成本抬升将加速出清低质产能。',
   support:'17 个省级广电部门投入财政资金，全年计划扶持精品微短剧项目已超 500 个；重点平台储备项目近 600 个。',
   related:[{n:'微短剧精品创作传播计划',id:'pol_jingpin'},{n:'北京市"人工智能+文旅"行动计划',id:'pol_beijing_ai'}],
   source:{source_name:'国家广播电视总局', source_url:'https://www.nrta.gov.cn', publisher:'国家广播电视总局', published_at:'2026-09-01', fetched_at:mins(20), status:'ok', last_checked_at:mins(20)},
   official:'https://www.nrta.gov.cn',
  },
  {id:'pol_jingpin', title:'微短剧精品创作传播计划"五个一批工程"', docNo:'广电总局网视司〔2026〕',
   dept:'国家广播电视总局 网络视听节目管理司', pubDate:'2026-08-27', effDate:'2026-08-27', status:'推进中', updatedAt:upd(0),
   tags:['精品扶持','微短剧','创作引导','资金扶持'], level:'国家',
   aiSummary:'广电总局部署实施的微短剧精品创作工程，分"五个一批"方向推进。第一批扶持项目 16 个，第二批质量显著提升。17 省投入财政资金，全年计划扶持超 500 个项目，平台储备近 600 个。',
   clauses:['坚持"内容为王"，推动思想内涵与艺术表达向更高品质看齐','发挥横屏/竖屏微短剧优势，善用新技术赋能创作','省级广电局紧扣"五个一批"创作方向统筹','播出平台加大优质内容排播，健全内部审核机制'],
   impact:'形成从选题储备、剧本孵化、精品生产到宣传推广的全链条机制，标杆示范带动行业整体提质。',
   support:'第一批扶持 16 项目；第二批拟扶持题材更丰富；17 省财政资金已到位。',
   related:[{n:'《微短剧发展管理办法》',id:'pol_weiduanju'}],
   source:{source_name:'国家广播电视总局', source_url:'https://www.nrta.gov.cn/art/2026/9/1/art_114_73989.html', publisher:'国家广播电视总局', published_at:'2026-09-01', fetched_at:mins(35), status:'ok', last_checked_at:mins(35)},
   official:'https://www.nrta.gov.cn/art/2026/9/1/art_114_73989.html',
  },
  {id:'pol_beijing_ai', title:'北京市推动"人工智能+文化和旅游"发展行动计划（2026—2028 年）', docNo:'京文旅〔2026〕',
   dept:'北京市文化和旅游局', pubDate:'2026-06-04', effDate:'2026-06-04', status:'现行有效', updatedAt:upd(95),
   tags:['AI+文化','产业扶持','智慧文旅','沉浸式体验'], level:'地方',
   aiSummary:'北京发布三年行动计划，聚焦公共服务、文艺创作、产业升级、全球推广、市场治理五大场景，推动 AI 与文旅深度融合。支持建设中轴线、长城等核心地标沉浸式体验，建立非遗数字档案。',
   clauses:['加快智慧图书馆和数字文化馆体系建设','以 AI 赋能内容供给，推出彰显首都风范的文化精品','推动核心文旅地标试点应用具身智能、可穿戴设备','强化多语种智能服务供给，提升入境游便利化','支持建设文旅领域 AI 实验室，培育试点示范项目'],
   impact:'为 AI 漫剧、数字人演艺、智慧博物馆等提供政策落地通道与场景资源。',
   support:'强化政策统筹、供需对接与技术创新，支持实验室建设与试点示范。',
   related:[{n:'《微短剧发展管理办法》',id:'pol_weiduanju'},{n:'江苏省"AI+文旅"行动方案',id:'pol_jiangsu_ai'}],
   source:{source_name:'文化和旅游部', source_url:'https://mct.gov.cn/wlbphone/wlbydd/xxfb/qglb/202606/t20260604_966115.html', publisher:'北京市文化和旅游局', published_at:'2026-06-04', fetched_at:mins(50), status:'ok', last_checked_at:mins(50)},
   official:'https://mct.gov.cn/wlbphone/wlbydd/xxfb/qglb/202606/t20260604_966115.html',
  },
  {id:'pol_jiangsu_ai', title:'江苏省"人工智能+文化旅游"行动方案（2026—2028 年）', docNo:'苏文旅〔2026〕',
   dept:'江苏省文化和旅游厅', pubDate:'2026-05-11', effDate:'2026-05-11', status:'现行有效', updatedAt:upd(120),
   tags:['AI+文化','产业扶持','智慧文旅','文旅大模型'], level:'地方',
   aiSummary:'江苏印发三年行动方案，到 2028 年培育文旅领域典型应用场景 100 个以上，打造文旅垂直领域大模型和标志性智能体 10 个左右，实现智慧文旅平台标注总量超 1 亿条。',
   clauses:['拓展"AI+文旅监管/服务/消费/创意/推介/数据分析"六大场景','推进文化遗产保护监测智能化','挖掘文旅经典 IP价值','推动文旅垂直领域大模型和标志性智能体建设'],
   impact:'为长三角地区 AI+文旅融合提供示范样板，利好 AI 内容制作公司与智慧文旅服务商。',
   support:'产学研用深度融合，省市配套资金与场景资源开放。',
   related:[{n:'北京市"AI+文旅"行动计划',id:'pol_beijing_ai'}],
   source:{source_name:'文化和旅游部', source_url:'https://www.mct.gov.cn/wlbphone/wlbydd/xxfb/qglb/qg/202605/t20260511_965766.html', publisher:'江苏省文化和旅游厅', published_at:'2026-05-11', fetched_at:mins(70), status:'ok', last_checked_at:mins(70)},
   official:'https://www.mct.gov.cn/wlbphone/wlbydd/xxfb/qglb/qg/202605/t20260511_965766.html',
  },
  {id:'pol_consume', title:'关于进一步培育新增长点繁荣文化和旅游消费的若干措施', docNo:'文旅部 联合发文',
   dept:'文化和旅游部等多部门', pubDate:'2026-08-27', effDate:'2026-08-27', status:'现行有效', updatedAt:upd(0),
   tags:['产业扶持','文旅消费','数字文旅','新业态'], level:'国家',
   aiSummary:'多部门联合出台措施，将扩大优质文化产品供给、提升公共文化服务水平纳入"十五五"规划纲要。加快培育数字动漫、线上演播、沉浸式展演等新型文化业态。',
   clauses:['培育新型文化业态：数字动漫、线上演播、沉浸式展演','实施"人工智能+"行动，推动 AI 在文化生产中发挥作用','实施国家智慧旅游建设工程','推动"微短剧+目的地"等数字文旅业态'],
   impact:'为数字文娱全链条提供政策红利窗口期。',
   support:'中央文化产业发展专项资金与艺术基金引导。',
   related:[{n:'十五五文化发展规划',id:'pol_15th'},{n:'北京市"AI+文旅"行动计划',id:'pol_beijing_ai'}],
   source:{source_name:'中国经济网', source_url:'https://www.ce.cn/xwzx/gnsz/gdxw/202608/t20260827_3172342.shtml', publisher:'文化和旅游部', published_at:'2026-08-27', fetched_at:mins(90), status:'ok', last_checked_at:mins(90)},
   official:'https://www.ce.cn/xwzx/gnsz/gdxw/202608/t20260827_3172342.shtml',
  },
  {id:'pol_15th', title:'"十五五"文化发展规划纲要', docNo:'中办发〔2026〕6号',
   dept:'中共中央办公厅、国务院办公厅', pubDate:'2026-03-20', effDate:'2026-03-20', status:'现行有效', updatedAt:upd(172),
   tags:['产业扶持','新业态','数字文旅','文化强国'], level:'国家',
   aiSummary:'提出发展数字动漫、沉浸式展演、线上演播、短视频、微短剧等新型文化业态，建设文化数字化体系，实施国家文化数字化战略。',
   clauses:['发展新型文化业态','推进文化数字化战略','建设智慧文旅与沉浸式消费','完善文化数据要素市场'],
   impact:'确立数字文娱为"十五五"文化强国建设重点方向。',
   support:'中央财政与文化产业发展专项资金支持。',
   related:[{n:'关于繁荣文旅消费的若干措施',id:'pol_consume'}],
   source:{source_name:'中国政府网', source_url:'https://www.gov.cn', publisher:'国务院办公厅', published_at:'2026-03-20', fetched_at:mins(110), status:'ok', last_checked_at:mins(110)},
   official:'https://www.gov.cn',
  },
];

/* ---------- 趋势洞察（基于真实事件链）---------- */
const TRENDS = [
  {id:'t_ai_tv', theme:'AI 剧上星：从网络走向卫视大屏', index:88.2, change:+12.4, confidence:0.91, window:7, updatedAt:upd(0,0,15),
   conclusion:'AI 生成剧集首次登陆湖南卫视黄金档（《后西游记》），此前安徽卫视已播出 AIGC 中剧《桃花潭记》。西影、TVB 等老牌厂牌全面拥抱 AI，标志着 AI 剧完成从"网络试水"到"主流认可"的关键跨越。',
   evidence:['《后西游记》登陆湖南卫视黄金档','安徽卫视率先播出《桃花潭记》','第一财经报道：AI 剧打破影视圈旧玩法','西影、TVB 等传统厂牌布局 AI 创作'],
   relatedHot:['h3'], relatedPol:['pol_weiduanju','pol_consume'], relatedProj:['p_houxiyouji']},
  {id:'t_ai_idol', theme:'AI 偶像剧爆发：颜值经济 + AI 降本引爆市场', index:84.6, change:+18.7, confidence:0.87, window:7, updatedAt:upd(0,0,15),
   conclusion:'AI 偶像剧《漂亮的恶意》《The Accident》以韩剧/美剧级颜值和经典人设模板迅速出圈，单集播放量分别达 4679 万和 5499 万。"告诉内娱，我在 AI 短剧世界不回去了"成为网友共识。',
   evidence:['《漂亮的恶意》单集抖音播放 4679 万、涨粉 70 万','《The Accident》4 集累计 5499 万播放','新榜深度报道：AI 偶像剧开始"接管"内娱','财阀/霸凌/校园明星等经典元素精准击中情绪痛点'],
   relatedHot:['h4'], relatedPol:['pol_weiduanju'], relatedProj:['p_piaoliang']},
  {id:'t_short_reg', theme:'微短剧合规化：管理办法 + 精品计划双轨并行', index:81.0, change:+5.0, confidence:0.94, window:7, updatedAt:upd(0,0,15),
   conclusion:'《微短剧发展管理办法》（总局令第 16 号）9 月 1 日正式施行，同日"微短剧统一标识"启用。配合"五个一批"精品工程，行业从野蛮生长转向"合规+精品"双轮驱动。98.7% 的 AI 漫剧半年内未摸到盈亏线，合规门槛将加速出清。',
   evidence:['《微短剧发展管理办法》9/1 施行（八章五十四条）','微短剧统一标识（苔花灵感）同日启用','精品计划：17 省财政资金到位，全年拟扶持超 500 项目','数据：每 77 部新剧仅 1 部回本，98.7% 未盈亏'],
   relatedHot:['h5'], relatedPol:['pol_weiduanju','pol_jingpin'], relatedProj:[]},
  {id:'t_ai_culture', theme:'AI 漫剧 × 传统文化：新模式跑通', index:76.3, change:+9.2, confidence:0.82, window:7, updatedAt:upd(0,0,15),
   conclusion:'AI 漫剧《砚边青梅》以颜真卿《祭侄文稿》为蓝本，将安史之乱史实转化为年轻人接受的视听内容，红果热度 4000 万+、抖音话题 2 亿播放。证明 AI 可成为传统文化传播的新型载体，但套路化叙事与技术穿帮仍是行业痛点。',
   evidence:['《砚边青梅》红果热度 4000 万+、收藏 80 万','抖音相关话题总播放量达 2 亿次','湖南日报专题报道：AI 漫剧能否承载传统文化之重','网友反馈：看完主动查阅史料，但也指出套路化问题'],
   relatedHot:['h7'], relatedPol:['pol_consume','pol_jingpin'], relatedProj:['p_yanbian']},
  {id:'t_concert_boom', theme:'9 月演出市场井喷：演唱会 + 音乐节高密度扎堆', index:73.8, change:+6.5, confidence:0.88, window:7, updatedAt:upd(0,0,15),
   conclusion:'9 月演出市场迎来罕见高密度供给：李荣浩、王源、那英、汪峰、单依纯、张韶涵等密集开唱，广州草莓、成都葫芦果、武汉 X 乐园等音乐节接踵而至。中秋国庆档期叠加，多地出现"同日多场"盛况。',
   evidence:['李荣浩成都首场售罄，加场再秒罄','王源成都连开两场，曲目容量超 70 首','那英时隔 7 年重开个人巡演','广州超级草莓 3 天 30+ 组艺人 / 成都葫芦果 9/26-27'],
   relatedHot:['h6','h8'], relatedPol:['pol_consume'], relatedProj:['ev_lironghao','v_caomei']},
];

/* ---------- 政策日历 ---------- */
const CAL = [
  {date:days(-7), type:'eff', title:'《微短剧发展管理办法》施行 / 统一标识启用', id:'pol_weiduanju'},
  {date:days(-3), type:'pub', title:'精品计划第二次调度会召开', id:'pol_jingpin'},
  {date:days(0), type:'pub', title:'人人影视正版 APP 上线（公测）', id:''},
  {date:days(4), type:'pub', title:'《燃烧吧!爸爸》全国上映', id:''},
  {date:days(17), type:'pub', title:'广州超级草莓音乐节开幕', id:''},
  {date:days(18), type:'pub', title:'成都葫芦果音乐节开幕', id:''},
  {date:days(18), type:'pub', title:'那英成都巡演 / 蒲熠星成都首唱', id:''},
  {date:days(22), type:'pub', title:'汉斯·季默世界巡演成都站', id:''},
];

/* ---------- 搜索索引 ---------- */
const SEARCH_INDEX = [
  ...HOTSPOTS.map(h=>({type:'热点', name:h.title, id:'hot:'+h.id})),
  ...PROJECTS.map(p=>({type:p.type, name:p.name, id:'proj:'+p.id})),
  ...POLICIES.map(p=>({type:'政策', name:p.title, id:'pol:'+p.id})),
  ...TRENDS.map(t=>({type:'趋势', name:t.theme, id:'trend:'+t.id})),
  {type:'人物', name:'沈腾', id:'ent:a_shenteng'},
  {type:'人物', name:'李荣浩', id:'ent:a_lironghao'},
  {type:'人物', name:'王源', id:'ent:a_wangyuan'},
  {type:'人物', name:'那英', id:'ent:a_naying'},
  {type:'人物', name:'文牧佑', id:'ent:a_wenmuye'},
  {type:'作品', name:'奥德赛', id:'ent:aodesai'},
  {type:'作品', name:'八仙!', id:'ent:baxian'},
  {type:'公司', name:'华数传媒', id:'ent:co_huashu'},
];

/* ---------- 订阅类型 ---------- */
const SUB_TYPES = [
  {key:'kw', name:'订阅关键词', ico:'⌕'},
  {key:'ent', name:'订阅人物/IP', ico:'◉'},
  {key:'cat', name:'订阅品类', ico:'▦'},
  {key:'pol', name:'订阅政策主题', ico:'§'},
  {key:'area',name:'订阅地区', ico:'⊚'},
  {key:'proj',name:'订阅具体项目', ico:'★'},
];

/* 导出 */
window.DB = {
  REF_NOW,
  PLATFORMS, DEI, HOTSPOTS, RANKINGS, PROJECTS, POLICIES, TRENDS, CAL, SEARCH_INDEX, SUB_TYPES,
  meta:{ generatedAt: mins(0), sla:'关键数据源 5 分钟级更新', dataNote:'本数据基于 2026 年 9 月真实公开信息编译，热度值为演示用相对值。' }
};
})();
