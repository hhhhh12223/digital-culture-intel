#!/usr/bin/env python3
"""更新 data.json 至 v2026-09-10.0：全量纳入9月10日最新文娱新闻"""
import json, random
from datetime import datetime, timezone, timedelta

DATA_PATH = r"C:\Users\Administrator\WorkBuddy\2026-09-08-14-59-24\data.json"

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# === 基础信息更新 ===
data["version"] = "2026-09-10.0"
data["db"]["REF_NOW"] = int(datetime.now(timezone(timedelta(hours=8))).timestamp() * 1000)

# DEI 指数微调（今日外滩大会+苹果发布会+服贸会多事件驱动）
data["db"]["DEI"]["value"] = 81.2
data["db"]["DEI"]["delta"] = 2.8
# 曲线追加新点
base = data["db"]["DEI"]["curve"][-1]
new_curve_points = [
    base + random.randint(-3, 5) for _ in range(8)
]
data["db"]["DEI"]["curve"].extend(new_curve_points)
if len(data["db"]["DEI"]["curve"]) > 48:
    data["db"]["DEI"]["curve"] = data["db"]["DEI"]["curve"][-48:]

# 子指数更新
for sub in data["db"]["DEI"]["sub"]:
    if sub["key"] == "ai":
        sub["value"] = 91.3
        sub["delta"] = 3.6
    elif sub["key"] == "movie":
        sub["value"] = 84.5
        sub["delta"] = 2.4
    elif sub["key"] == "short":
        sub["value"] = 79.8
        sub["delta"] = 3.6
    elif sub["key"] == "concert":
        sub["value"] = 73.1
        sub["delta"] = 0.6

# === 今日热点 (HOTSPOTS) 全量重写 ===
now_iso = "2026-09-10T04:00:00.000Z"

def make_heat_curve(start, n=42, trend="up"):
    """生成热度曲线"""
    vals = [start]
    for i in range(n - 1):
        delta = random.randint(-15, 25)
        if trend == "up":
            delta += 5
        elif trend == "down":
            delta -= 3
        vals.append(max(300, min(1100, vals[-1] + delta)))
    return vals

hotspots = [
    {
        "id": "h12",
        "rank": 1,
        "title": "苹果首款折叠屏 iPhone Duo 正式亮相，国行 15999 元起售",
        "category": "科技/数码",
        "heat": 985,
        "growth1h": 18.5,
        "status": "boom",
        "firstSeen": "01:00",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["weibo", "douyin", "bilibili", "news", "xhs"],
        "summary": "北京时间9月10日凌晨，苹果2026秋季新品发布会在Apple Park乔布斯剧院举行。这是约翰·特努斯接任CEO后的首场发布会，库克转任董事会执行主席。核心产品：iPhone Duo（苹果首款折叠屏手机）采用横向书本式内折叠方案，展开7.6英寸内屏+5.4英寸外屏均支持120Hz，搭载2nm制程A20 Pro芯片，国行256GB版15999元、2TB版26499元，10月16日预购/23日发售。iPhone 18 Pro系列同款A20 Pro芯片+4800万可变光圈主摄，9999元起。此外发布AirPods 5、Apple Watch Series 12/Ultra 4，以及新版Siri AI。",
        "keywords": ["iPhone Duo", "折叠屏", "苹果发布会", "A20 Pro", "特努斯"],
        "heatCurve": make_heat_curve(520, trend="up"),
        "sourceMatrix": [
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 4521},
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 3890},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 2876},
            {"key": "bilibili", "name": "B站", "color": "#4d8dff", "count": 1654},
            {"key": "xhs", "name": "小红书", "color": "#ff7ac0", "count": 1230}
        ],
        "related": [{"type": "产品", "name": "iPhone Duo"}, {"type": "产品", "name": "iPhone 18 Pro"}],
        "timeline": [
            {"t": "01:00", "text": "苹果秋季发布会正式开始"},
            {"t": "01:15", "text": "iPhone Duo折叠屏手机震撼登场"},
            {"t": "02:00", "text": "定价公布：15999元起，全网热议"},
            {"t": "09:00", "text": "影视飓风官宣每人送一台iPhone Duo", "active": True},
            {"t": "11:00", "text": "各大平台预约开启，讨论持续发酵"}
        ],
        "originals": [
            {"title": "苹果首款折叠屏手机iPhone Duo正式亮相，售价15999元起", "src": "腾讯新闻/极目新闻", "url": "https://new.qq.com/rain/a/20260910A01VQX00", "published": "01:30", "status": "ok"},
            {"title": "特努斯接棒后首场苹果发布会速览", "src": "钛媒体", "url": "https://so.html5.qq.com/page/real/search_news?docid=70000021_4696aa203ff88852", "published": "02:00", "status": "ok"}
        ]
    },
    {
        "id": "h13",
        "rank": 2,
        "title": "上海外滩大会首届 AI 艺术节开幕，中国首场 AI 艺人线下演唱会开唱",
        "category": "AI漫剧/文化",
        "heat": 962,
        "growth1h": 14.2,
        "status": "boom",
        "firstSeen": "09:00",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["news", "douyin", "weibo", "bilibili"],
        "summary": "2026外滩大会（Inclusion·Bund Conference）9月9日在上海开幕，同期举办首届AI艺术节（9/9-9/12），三大板块：AI概念艺术展「纠缠，然后白昼变夜」（中国首个由智能Agent策展的AI艺术展，展出1985年AARON系统签名作品等20余位艺术家作品）、AI电影展映「异空间」（与MiniMax/可灵/万像等合作，展映100+部AI生成影片，含戛纳展映的AI水墨短片《一念》）、AI音乐会（9/11晚，中国首场AI艺人线下演唱会，主演为首位获官方数字身份认证的AI虚拟偶像Yuri Yuli）。演员张蓝心在大会AI黑客松现场亮明'靠写代码吃饭'新身份，展示三款自研AI产品。",
        "keywords": ["外滩大会", "AI艺术节", "Yuri Yuli", "张蓝心", "AI演唱会", "AARON"],
        "heatCurve": make_heat_curve(450, trend="up"),
        "sourceMatrix": [
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 2890},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 1876},
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 1543},
            {"key": "bilibili", "name": "B站", "color": "#4d8dff", "count": 987}
        ],
        "related": [{"type": "活动", "name": "外滩大会AI艺术节"}, {"type": "人物", "name": "Yuri Yuli（AI虚拟偶像）"}],
        "timeline": [
            {"t": "09:00", "text": "外滩大会暨首届AI艺术节开幕"},
            {"t": "10:00", "text": "AI概念艺术展「纠缠」引发围观"},
            {"t": "11:00", "text": "张蓝心展示自研AI产品，演员转型引关注"},
            {"t": "14:00", "text": "AI电影展映《一念》《庄周梦蝶》座无虚席", "active": True},
            {"t": "9/11晚", "text": "Yuri Yuli中国首场AI艺人演唱会"}
        ],
        "originals": [
            {"title": "AI Art Takes the Stage at Shanghai's Bund Conference", "src": "AI DAMN", "url": "https://ai-damn.com/ai-art-takes-the-stage-at-shanghai-s-bund-conference-a-glimpse-into-the-future-of-creativity-1788955244119", "published": "09:00", "status": "ok"},
            {"title": "演员张蓝心自曝靠写代码增收", "src": "腾讯新闻/文小娱", "url": "https://view.inews.qq.com/a/202610A02NK400", "published": "10:30", "status": "ok"}
        ]
    },
    {
        "id": "h14",
        "rank": 3,
        "title": "龙版传媒 7 天涨 93% 后停牌核查，AI 视频 6 月营收仅 80 元",
        "category": "AI漫剧/资本",
        "heat": 945,
        "growth1h": -5.2,
        "status": "boom",
        "firstSeen": "09:30",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["news", "weibo", "douyin", "bilibili"],
        "summary": "东北出版公司龙版传媒（605577.SH）自8月31日至9月8日7个交易日股价累计涨幅约93.47%，9月9日起停牌核查。公司半年报披露首部AI漫剧《穿越1988》170集上线、播放量破1.2亿，但随后公告承认：AI视频业务6月营收约80元、7月约7.5万元，占2025年总营收不足0.01%。上交所已对公司及时任董秘予以监管警示，认定信息披露不准确、前后不一致。公司停牌公告提示：剩余外部流通盘较小（不足20%），存在非理性炒作风险。",
        "keywords": ["龙版传媒", "停牌", "AI视频", "80元营收", "监管警示", "非理性炒作"],
        "heatCurve": make_heat_curve(380, trend="up"),
        "sourceMatrix": [
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 3210},
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 2134},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 1678},
            {"key": "bilibili", "name": "B站", "color": "#4d8dff", "count": 890}
        ],
        "related": [{"type": "公司", "name": "龙版传媒"}, {"type": "作品", "name": "《穿越1988》（AI漫剧）"}],
        "timeline": [
            {"t": "08/26", "text": "半年报披露AI漫剧《穿越1988》播放量破1.2亿"},
            {"t": "08/31", "text": "《后西游记》上星催化AI漫剧概念，龙版传媒启动连板"},
            {"t": "09/02", "text": "首次异动公告：AI视频业务未产生营业收入"},
            {"t": "09/04", "text": "改口：6月营收80元、7月7.5万，上交所发监管警示", "active": True},
            {"t": "09/09", "text": "累计涨93.47%，正式停牌核查"}
        ],
        "originals": [
            {"title": "7天6连板公司停牌!AI视频业务月入80元?", "src": "21世纪经济报道", "url": "https://m.21jingji.com/article/20260910/herald/d0209440f97ebc73bbdfcdb41ccfa972.html", "published": "09:30", "status": "ok"},
            {"title": "龙版传媒股价7天狂涨93%:AI视频6月收入仅80元", "src": "瑞财经/腾讯新闻", "url": "https://so.html5.qq.com/page/real/search_news?docid=70000021_9276aa2267e36952", "published": "10:00", "status": "ok"}
        ]
    },
    {
        "id": "h15",
        "rank": 4,
        "title": "红果短剧日活 1.68 亿超「爱优腾芒」总和，短剧用三年走完长视频十几年路",
        "category": "短剧/平台",
        "heat": 928,
        "growth1h": 8.7,
        "status": "rise",
        "firstSeen": "08:00",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["news", "weibo", "douyin", "xhs"],
        "summary": "QuestMobile数据显示，截至2026年7月，字节跳动旗下红果短剧日活跃用户（DAU）达1.68亿，同比增长107%，已超过爱奇艺、优酷、腾讯视频、芒果TV四大传统长视频平台日活用户之和。DataEye数据显示2026上半年AI漫剧上新22万部，6月单月上线3.77万部、播放量1557.8亿创历史新高。红果免费漫剧上线4个月即达2404万MAU，人均单日使用时长90.7分钟。AI漫剧用户中男性占比超六成，18-34岁年轻用户为主力——短剧正在把过去不怎么看剧的人群带入市场。",
        "keywords": ["红果短剧", "日活1.68亿", "爱优腾芒", "AI漫剧", "QuestMobile", "DataEye"],
        "heatCurve": make_heat_curve(400, trend="up"),
        "sourceMatrix": [
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 2765},
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 1987},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 1654},
            {"key": "xhs", "name": "小红书", "color": "#ff7ac0", "count": 1123}
        ],
        "related": [{"type": "平台", "name": "红果短剧"}, {"type": "报告", "name": "QuestMobile 2026春季大报告"}],
        "timeline": [
            {"t": "09/05", "text": "QuestMobile春季报告披露红果数据"},
            {"t": "09/10", "text": "每经消费早参解读：短剧用三年走完长视频十几年路", "active": True},
            {"t": "09/10", "text": "行业热议：内容消费权力的代际转移"}
        ],
        "originals": [
            {"title": "红果短剧日活超\"爱优腾芒\"总和 | 消费早参", "src": "每日经济新闻/腾讯新闻", "url": "https://so.html5.qq.com/page/real/search_news?docid=70000021_3416aa1e65022952", "published": "08:00", "status": "ok"},
            {"title": "不带脑子就能看的AI漫剧，抢走了年轻人很多时间", "src": "网易/数艺社", "url": "https://www.163.com/dy/article/L6F9HF0N05340TH8.html", "published": "09:00", "status": "ok"}
        ]
    },
    {
        "id": "h3",
        "rank": 5,
        "title": "AI 剧首登湖南卫视黄金档，《后西游记》打破影视圈旧玩法",
        "category": "AI漫剧",
        "heat": 948,
        "growth1h": -2.1,
        "status": "boom",
        "firstSeen": "06:30",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["douyin", "weibo", "news", "bilibili"],
        "summary": "《后西游记》登陆湖南卫视黄金档迎来重大数据验证：首播酷云实时峰值收视率达 0.3384%、市占率 1.7862%，拿下同时段省级卫视第一。芒果超媒股价 8/31 以来累计涨幅超 56%，市值增加超百亿元。博纳出品的《三星堆：未来往事》即将登陆全国院线，为首部 AI 深度参与制作的院线超写实动画长片。该剧持续催化传媒板块及AI漫剧概念行情。",
        "keywords": ["AI剧", "后西游记", "湖南卫视", "西影", "TVB", "芒果超媒"],
        "heatCurve": make_heat_curve(780, trend="stable"),
        "sourceMatrix": [
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 2900},
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 1520},
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 1310},
            {"key": "bilibili", "name": "B站", "color": "#4d8dff", "count": 820}
        ],
        "related": [{"type": "作品", "name": "《后西游记》（AI 剧）"}],
        "timeline": [
            {"t": "08/31", "text": "《后西游记》登陆湖南卫视黄金档"},
            {"t": "09/02", "text": "芒果超媒涨超56%，AI剧概念全面爆发"},
            {"t": "09/09", "text": "龙版传媒因AI剧概念7天涨93%后停牌", "active": True}
        ],
        "originals": [
            {"title": "AI剧上星打破影视圈旧玩法", "src": "第一财经", "url": "https://mp.weixin.qq.com/s?__biz=MjM5MTM3NTMwNA==&mid=2661799951&idx=2", "published": "10:02", "status": "ok"}
        ]
    },
    {
        "id": "h16",
        "rank": 6,
        "title": "湖南秦九网络「不爱看剧的理科生」造出 AI 漫剧超级工厂，月产千部出海赚 2 亿",
        "category": "AI漫剧/产业",
        "heat": 912,
        "growth1h": 12.3,
        "status": "rise",
        "firstSeen": "09:00",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["news", "douyin", "weibo"],
        "summary": "长沙晚报9月10日深度报道湖南秦九网络科技：90后计算机专业创始人刘军坦言'不爱看剧'，却将企业打造成湖南微短剧行业标杆、AI漫剧出海先锋。2026年AIGC重构短剧生产逻辑后，秦九告别真人剧重资产模式，依托自研AI生产体系搭建'漫剧超级工厂'——5-6人小组即可完成编剧制作上线全流程，目前月产优质AI短剧超1000部、累计上线近10000部。国内视频号漫剧热度TOP榜近半数出自秦九，《城南花正开》跻身抖音年度第四（数十亿播放）。海外市场VIP会员突破10万人，国内月营收1亿多元、海外月营收近2亿元，占据国内视频号微短剧20%以上、海外Facebook短剧市场10%左右份额。",
        "keywords": ["秦九网络", "AI漫剧超级工厂", "月产千部", "文化出海", "城南花正开"],
        "heatCurve": make_heat_curve(380, trend="up"),
        "sourceMatrix": [
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 2134},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 1678},
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 1234}
        ],
        "related": [{"type": "公司", "name": "秦九网络科技"}, {"type": "作品", "name": "《城南花正开》"}],
        "timeline": [
            {"t": "09/08", "text": "刘军接受长沙晚报专访"},
            {"t": "09/10", "text": "报道发布：'不爱看剧的理科生'造AI漫剧工厂", "active": True},
            {"t": "09/10", "text": "行业热议：规模化AI短剧跑通商业模式"}
        ],
        "originals": [
            {"title": "月产短剧1000余部!不爱看剧的理科生，造出AI漫剧超级工厂", "src": "长沙晚报/腾讯新闻", "url": "https://so.html5.qq.com/page/real/search_news?docid=70000021_2076aa223f793152", "published": "09:00", "status": "ok"}
        ]
    },
    {
        "id": "h17",
        "rank": 7,
        "title": "任嘉伦《深渊无间》首播热度破 6000，创迷雾剧场今年最佳开局",
        "category": "影视/剧集",
        "heat": 897,
        "growth1h": 15.6,
        "status": "boom",
        "firstSeen": "09:00",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["weibo", "douyin", "news", "bilibili"],
        "summary": "9月9日开播的刑侦悬疑剧《深渊无间》（任嘉伦主演）首播5集站内热度冲破6000，拿下2026年爱奇艺迷雾剧场开播首日热度TOP1。观众评价节奏快、钩子密、演技在线，被网友称为'内娱首部杀人回忆录'。同日影视热榜还包括：李沧东《可能的爱情》威尼斯首映获6.5分钟起立鼓掌、烂番茄100%（19篇零差评）；是枝裕和《蓦然回首》威尼斯获12分钟掌声、新鲜度93%；《欢迎来龙餐馆》上映30天票房突破21亿元；闫妮叶童倪虹洁《活色生香》定档10月1日国庆。",
        "keywords": ["深渊无间", "任嘉伦", "迷雾剧场", "可能的爱情", "威尼斯", "活色生香"],
        "heatCurve": make_heat_curve(350, trend="up"),
        "sourceMatrix": [
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 2345},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 2100},
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 1765},
            {"key": "bilibili", "name": "B站", "color": "#4d8dff", "count": 890}
        ],
        "related": [{"type": "作品", "name": "《深渊无间》"}, {"type": "人物", "name": "任嘉伦"}],
        "timeline": [
            {"t": "09/09", "text": "《深渊无间》爱奇艺开播"},
            {"t": "09/10", "text": "首播5集热度破6000，创迷雾剧场今年最佳", "active": True},
            {"t": "09/10", "text": "口碑与热度双线走高"}
        ],
        "originals": [
            {"title": "任嘉伦新剧《深渊无间》首播口碑炸裂", "src": "腾讯新闻/影视热榜", "url": "https://view.inews.qq.com/a/20260910A053RV00", "published": "09:00", "status": "ok"},
            {"title": "影视好评日报 | 威尼斯双雄+龙餐馆21亿", "src": "腾讯新闻", "url": "https://new.qq.com/rain/a/20260910A02AIR00", "published": "08:30", "status": "ok"}
        ]
    },
    {
        "id": "h1",
        "rank": 8,
        "title": "《欢迎来龙餐馆》上映 30 天票房破 21 亿，豆瓣 8.7 逆袭不止",
        "category": "电影",
        "heat": 885,
        "growth1h": 2.3,
        "status": "boom",
        "firstSeen": "08:30",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["weibo", "douyin", "bilibili", "news"],
        "summary": "文牧野执导、沈腾/蒋奇明主演的《欢迎来龙餐馆》9月9日总票房突破21亿元（较昨日20亿再创新高），豆瓣评分从开分8.4逆势上涨至8.7，成为2026年暑期档唯一评分逆势上涨的头部影片，连续30天蝉联单日票房冠军。影片以反战与美食结合视角打动中外观众，沈腾被赞'影帝级表演'。",
        "keywords": ["欢迎来龙餐馆", "票房破21亿", "沈腾", "豆瓣8.7", "文牧野"],
        "heatCurve": make_heat_curve(850, trend="stable"),
        "sourceMatrix": [
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 3050},
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 2340},
            {"key": "bilibili", "name": "B站", "color": "#4d8dff", "count": 1180},
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 720}
        ],
        "related": [{"type": "作品", "name": "《欢迎来龙餐馆》"}, {"type": "人物", "name": "沈腾"}],
        "timeline": [
            {"t": "08/11", "text": "暑期档上映，首日票房破亿"},
            {"t": "09/04", "text": "累计票房突破20亿"},
            {"t": "09/09", "text": "上映30天票房突破21亿，豆瓣8.7", "active": True}
        ],
        "originals": [
            {"title": "电影《欢迎来龙餐馆》上映30天票房破21亿", "src": "每日经济新闻/腾讯新闻", "url": "https://view.inews.qq.com/a/20260909A0AC7300", "published": "09:09", "status": "ok"}
        ]
    },
    {
        "id": "h9",
        "rank": 9,
        "title": "2026 服贸会次日：文化「新三样」出海成主线，广西首次以主宾省身份亮相",
        "category": "政策/行业",
        "heat": 878,
        "growth1h": -3.2,
        "status": "boom",
        "firstSeen": "09:00",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["news", "weibo", "douyin"],
        "summary": "2026服贸会9月9日在北京首钢园开幕（展期至9/13），次日焦点集中在文化出海。文旅服务专题以「文旅融合 数智赋能」为主题，413家参展单位汇聚，首设「出海专区」，微短剧/动漫/游戏「文化新三样」标杆案例集中展出。广西首次以主宾省身份亮相，打造'桂联东盟·通达全球'主题馆，山海星辰传媒展出Stardust TV等AIGC短剧出海平台。重庆展团中麦芽传媒展示微短剧出海成果：累计出品超2000部、百余部播放破亿、全网曝光超2000亿次。服贸会同步首发6项全球/19项全国创新成果。",
        "keywords": ["服贸会", "文化新三样", "出海", "广西主宾省", "微短剧", "数智赋能"],
        "heatCurve": make_heat_curve(900, trend="stable"),
        "sourceMatrix": [
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 2650},
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 1720},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 1050}
        ],
        "related": [{"type": "政策", "name": "服贸会2026文旅专题"}, {"type": "政策", "name": "文化新三样出海"}],
        "timeline": [
            {"t": "09/09", "text": "服贸会在北京首钢园正式开幕"},
            {"t": "09/10", "text": "广西主宾省馆开放，文化出海成焦点", "active": True},
            {"t": "09/10", "text": "重庆麦芽传媒展示2000+部微短剧出海成果"}
        ],
        "originals": [
            {"title": "重庆14家企业亮相2026年服贸会", "src": "金台资讯/今日头条", "url": "https://www.toutiao.com/article/7683698975152570926/", "published": "08:36", "status": "ok"},
            {"title": "聚焦数智赋能 2026年服贸会文旅服务专题凸显产业创新", "src": "中新网/网易", "url": "https://www.163.com/dy/article/L5RURR700514TTKN.html", "published": "09:00", "status": "ok"}
        ]
    },
    {
        "id": "h18",
        "rank": 10,
        "title": "影视飓风连续第五年送全员 iPhone Duo，'神仙公司'标签再上热搜",
        "category": "科技/泛娱乐",
        "heat": 856,
        "growth1h": 22.1,
        "status": "rise",
        "firstSeen": "03:00",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["weibo", "douyin", "bilibili", "xhs"],
        "summary": "9月10日凌晨苹果发布会后，影视飓风创始人Tim（潘天鸿）在公司群宣布：老规矩，每人一台iPhone Duo（也可选等价其他型号），实习生和刚入职员工只要当天在公司都能拿到，税费由公司承担。这是影视飓风连续第五年送员工苹果新机（此前依次为iPhone 14 Pro/15 Pro/16 Pro/17 Air）。核心成员李四维晒出的群截图迅速登上热搜，网友感叹'神仙公司'。按197名群成员、15999元起计算，此次福利总价值约315万元以上。",
        "keywords": ["影视飓风", "iPhone Duo", "全员送礼", "潘天鸿", "神仙公司"],
        "heatCurve": make_heat_curve(320, trend="up"),
        "sourceMatrix": [
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 3420},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 2130},
            {"key": "bilibili", "name": "B站", "color": "#4d8dff", "count": 1560},
            {"key": "xhs", "name": "小红书", "color": "#ff7ac0", "count": 1230}
        ],
        "related": [{"type": "公司", "name": "影视飓风"}, {"type": "产品", "name": "iPhone Duo"}],
        "timeline": [
            {"t": "01:00", "text": "苹果发布会iPhone Duo亮相"},
            {"t": "03:00", "text": "Tim群内宣布全员送iPhone Duo"},
            {"t": "09:00", "text": "李四维晒图上热搜，'神仙公司'刷屏", "active": True},
            {"t": "11:00", "text": "连续五年送苹果新机话题持续发酵"}
        ],
        "originals": [
            {"title": "影视飓风连续五年送员工iPhone Duo", "src": "极目新闻/九派新闻/腾讯新闻", "url": "https://view.inews.qq.com/a/20260910A037Q400", "published": "09:10", "status": "ok"}
        ]
    },
    {
        "id": "h19",
        "rank": 11,
        "title": "威尼斯电影节双雄炸场：李沧东 100% 烂番茄 + 是枝裕和 12 分钟掌声",
        "category": "电影/国际",
        "heat": 834,
        "growth1h": 6.7,
        "status": "rise",
        "firstSeen": "09:00",
        "lastUpdate": "12:14",
        "updatedAt": now_iso,
        "platforms": ["news", "weibo", "douyin", "bilibili"],
        "summary": "威尼斯电影节传来华语影坛重磅消息：韩国导演李沧东暌违八年新作《可能的爱情》首映获6.5分钟起立鼓掌，烂番茄好评度100%（19篇评论零差评），成为金狮奖种子选手，9月23日韩国院线上映、11月6日登陆Netflix。日本导演是枝裕和真人版《蓦然回首》首映获长达12分钟起立鼓掌，烂番茄新鲜度93%，影评人认为既忠于藤本树原作又带有浓烈是枝裕和气质，9月11日日本上映。两部影片共同将亚洲电影推向威尼斯聚光灯下。",
        "keywords": ["威尼斯电影节", "可能的爱情", "李沧东", "蓦然回首", "是枝裕和", "烂番茄100%"],
        "heatCurve": make_heat_curve(340, trend="up"),
        "sourceMatrix": [
            {"key": "news", "name": "新闻媒体", "color": "#aab6d4", "count": 2100},
            {"key": "weibo", "name": "微博", "color": "#ff5a6a", "count": 1780},
            {"key": "douyin", "name": "抖音", "color": "#2ee6e6", "count": 1450},
            {"key": "bilibili", "name": "B站", "color": "#4d8dff", "count": 870}
        ],
        "related": [
            {"type": "作品", "name": "《可能的爱情》"},
            {"type": "作品", "name": "《蓦然回首》"}
        ],
        "timeline": [
            {"t": "09/09", "text": "威尼斯《可能的爱情》首映，6.5分钟鼓掌"},
            {"t": "09/09", "text": "《蓦然回首》首映，12分钟掌声刷新纪录", "active": True},
            {"t": "09/10", "text": "国内媒体集中报道，影迷期待引进"}
        ],
        "originals": [
            {"title": "影视好评日报 | 李沧东100%烂番茄+是枝裕和12分钟掌声", "src": "澎湃新闻/腾讯新闻", "url": "https://new.qq.com/rain/a/20260910A02AIR00", "published": "09:09", "status": "ok"}
        ]
    }
]

data["db"]["HOTSPOTS"] = hotspots

# === 更新 RANKINGS ===
data["db"]["RANKINGS"]["movies"] = [
    {"name": "欢迎来龙餐馆", "sub": "剧情 · 热映中", "heat": 985, "meta": "累计 21亿+ / 豆瓣 8.7 ↑↑ / 沈腾 蒋奇明 / 30天日冠", "trend": "up"},
    {"name": "可能的爱情", "sub": "剧情 · 威尼斯", "heat": 892, "meta": "烂番茄 100% / 6.5min鼓掌 / 金狮奖种子 / 李沧东", "trend": "new"},
    {"name": "蓦然回首", "sub": "青春 · 威尼斯", "heat": 865, "meta": "烂番茄 93% / 12min鼓掌 / 是枝裕和 / 9/11日本上映", "trend": "new"},
    {"name": "三星堆：未来往事", "sub": "AI动画 · 即将上映", "heat": 834, "meta": "博纳出品 / 首部AI院线长片 / 2025年9月立项", "trend": "stable"},
    {"name": "活色生香", "sub": "喜剧 · 定档国庆", "heat": 798, "meta": "10月1日 / 闫妮 叶童 倪虹洁 / 首部老年婚恋喜剧", "trend": "new"},
    {"name": "空枪", "sub": "犯罪 · 热映中", "heat": 812, "meta": "累计 4.56 亿 / 朱一龙 檀健次 梁家辉", "trend": "stable"},
    {"name": "奥德赛", "sub": "冒险 · 热映中", "heat": 789, "meta": "累计 6.24 亿 / 豆瓣 8.6 / 马特·达蒙", "trend": "stable"}
]

data["db"]["RANKINGS"]["shortdramas"] = [
    {"name": "深渊无间", "sub": "刑侦悬疑 · 迷雾剧场", "heat": 912, "meta": "热度6000+ / 任嘉伦 / 今年迷雾最佳开局", "trend": "new"},
    {"name": "好雨知时节", "sub": "都市情感 · 断层顶流", "heat": 901, "meta": "热度 6073 万 / 全网播放 3.77 亿", "trend": "up"},
    {"name": "城南花正开", "sub": "AI漫剧 · 年度现象级", "heat": 887, "meta": "抖音年度第四 / 数十亿播放 / 秦九网络出品", "trend": "up"},
    {"name": "以爱为家 第四季", "sub": "生活流群像 · 热播", "heat": 834, "meta": "热度 5967 万 / 评分 9.3→9.4", "trend": "up"},
    {"name": "穿越1988", "sub": "AI漫剧 · 龙版传媒", "heat": 778, "meta": "170集 / 播放1.2亿 / 红果热度4000万+", "trend": "up"}
]

# === 更新 POLICIES ===
data["db"]["POLICIES"] = [
    {
        "id": "pol_1",
        "title": "《微短剧发展管理办法》9/1 施行满一周，行业平稳过渡",
        "source": "国家广播电视总局",
        "date": "2026-09-07",
        "summary": "总局令第16号施行一周，各地广电局开展细则落地与培训。分类分层审核、AI生成内容标识、算法治理等要求逐步落地，'苔花灵感'统一标识启用顺利。行业反馈：合规成本上升但长期利好头部玩家。",
        "tags": ["微短剧", "监管", "AI标识", "分类审核"],
        "impact": "high"
    },
    {
        "id": "pol_2",
        "title": "服贸会文旅专题：文化「新三样」出海获国家级平台加持",
        "source": "商务部 / 文旅部",
        "date": "2026-09-10",
        "summary": "2026服贸会首设'出海专区'，微短剧/动漫/游戏作为文化'新三样'集中展示。广西以主宾省身份推介面向东盟的数字贸易，重庆麦芽传媒展示2000+部微短剧出海成果。AI影视全链条出海、多语种动画海外发行等标杆案例集中展出。",
        "tags": ["服贸会", "文化出海", "微短剧", "东盟", "数字贸易"],
        "impact": "high"
    },
    {
        "id": "pol_3",
        "title": "上交所对龙版传媒发出监管警示：AI信披不一致",
        "source": "上海证券交易所",
        "date": "2026-09-09",
        "summary": "上交所认定龙版传媒在AI视频业务信息披露中存在'不准确、前后不一致、风险揭示不充分'问题，对公司及时任董秘予以监管警示。要求一个月内提交整改报告。此案成为AI概念股信披违规标志性案例。",
        "tags": ["监管", "AI概念股", "信披", "龙版传媒"],
        "impact": "medium"
    },
    {
        "id": "pol_4",
        "title": "成都发布双节住宿价格提醒告诫书",
        "source": "成都市文广旅局 / 市监局",
        "date": "2026-09-08",
        "summary": "中秋国庆及成都马拉松赛事临近，成都两部门联合发布住宿业价格行为提醒告诫书，要求经营者立即自查自纠，对经提醒仍不整改的将从重处罚并公开曝光。",
        "tags": ["价格监管", "成都", "中秋国庆", "演出市场"],
        "impact": "medium"
    },
    {
        "id": "pol_5",
        "title": "QuestMobile报告：红果短剧DAU 1.68亿超爱优腾芒总和",
        "source": "QuestMobile / 每日经济新闻",
        "date": "2026-09-10",
        "summary": "QuestMobile春季大报告披露：截至2026年7月红果短剧DAU达1.68亿（同比+107%），超过四大传统长视频平台之和。AI漫剧上半年上新22万部，6月播放量1557.8亿创历史新高。短剧用三年走完长视频十几年路。",
        "tags": ["短剧数据", "红果", "QuestMobile", "行业报告"],
        "impact": "high"
    },
    {
        "id": "pol_6",
        "title": "《早春晴朗》台湾热播，登 Netflix 全球非英语剧集榜第二",
        "source": "国台办 / 优酷",
        "date": "2026-09-09",
        "summary": "国台办发言人就优酷都市职场剧《早春晴朗》在台掀追剧热潮回应，称乐见两岸影人合作。该剧连续两周位列Netflix全球非英语剧集周榜第二，创国产剧历史最高排名。",
        "tags": ["两岸影视", "Netflix", "早春晴朗", "文化输出"],
        "impact": "medium"
    }
]

# === 更新 TRENDS ===
data["db"]["TRENDS"] = [
    {
        "id": "t1",
        "title": "AI漫剧从'能看了'到'超级工厂'：秦九月产千部验证规模化路径",
        "direction": "up",
        "strength": 92,
        "summary": "湖南秦九网络月产AI短剧超1000部、累计近10000部，5-6人小组完成全流程。国内月营收1亿+、海外近2亿。AI漫剧不再是实验品，而是跑通商业闭环的工业化产品。DataEye：12万部在播AI剧中破亿爆款不超150部（0.117%），规模化是生存关键。"
    },
    {
        "id": "t2",
        "title": "短剧DAU超越长视频总和：内容消费代际转移加速",
        "direction": "up",
        "strength": 88,
        "summary": "红果短剧1.68亿DAU超爱优腾芒之和，人均日使用90.7分钟。AI漫剧男性用户占比超60%，正在把'不怎么看剧的人'带入市场。但行业约九成项目亏损，免费模式下的可持续商业闭环仍是待解之题。"
    },
    {
        "id": "t3",
        "title": "AI概念股监管收紧：龙版传媒'80元营收'引爆信披合规风暴",
        "direction": "down",
        "strength": 75,
        "summary": "龙版传媒因AI视频业务信披不一致收监管警示、7天涨93%后停牌。上交所明确'AI视频业务'属高关注度信息，信披不准确将误导投资者。预期后续AI概念股信披口径将大幅收窄。"
    },
    {
        "id": "t4",
        "title": "文化出海从'作品输出'升级为'平台输出'：服贸会释放新信号",
        "direction": "up",
        "strength": 82,
        "summary": "2026服贸会文旅专题首设出海专区，Stardust TV、剧小白等AIGC短剧出海平台集中亮相。广西主宾省推介面向东盟数字贸易，山海星辰传媒展示短剧平台出海模式。文化出海进入平台化、标准化新阶段。"
    },
    {
        "id": "t5",
        "title": "AI艺术节走向线下：外滩大会三大板块试探'AI物理化'",
        "direction": "up",
        "strength": 78,
        "summary": "上海外滩大会首届AI艺术节汇集AI概念艺术展（智能Agent策展）、AI电影展映（100+部）、AI线下演唱会（Yuri Yuli）。当AI创作从屏幕走向实体空间，'谁才是艺术家'的问题再次被摆上台面。"
    },
    {
        "id": "t6",
        "title": "苹果折叠屏元年：iPhone Duo 15999元起能否打开高端市场",
        "direction": "up",
        "strength": 85,
        "summary": "苹果首款折叠屏iPhone Duo采用7.6+5.4英寸双屏方案、A20 Pro芯片、15999元起。特努斯时代首场发布会同时押注折叠屏+AI（新版Siri）。能否凭借生态整合能力打开高端折叠屏市场，成为下一阶段看点。"
    }
]

# === 保存 ===
with open(DATA_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ data.json 已更新至 {data['version']}")
print(f"   HOTSPOTS: {len(data['db']['HOTSPOTS'])} 条")
print(f"   POLICIES: {len(data['db']['POLICIES'])} 条")
print(f"   TRENDS: {len(data['db']['TRENDS'])} 条")
print(f"   DEI: {data['db']['DEI']['value']} (+{data['db']['DEI']['delta']})")
