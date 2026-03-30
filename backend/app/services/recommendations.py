from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.market import RecommendationGroup, RecommendationsResponse, RecommendationStock


RECOMMENDATION_GROUPS: list[RecommendationGroup] = [
    RecommendationGroup(
        id="tech-ai-infra",
        category="科技",
        subcategory="AI算力与云基础设施",
        description="聚焦算力资本开支、企业级 AI 部署和云平台定价权。",
        stocks=[
            RecommendationStock(symbol="NVDA", company_name="英伟达", market="US", region="美国", rationale="GPU 与 AI 训练生态护城河最强。", tags=["AI", "GPU", "龙头"]),
            RecommendationStock(symbol="MSFT", company_name="微软", market="US", region="美国", rationale="Azure 与 Copilot 绑定企业级 AI 落地。", tags=["云", "Copilot", "现金流"]),
            RecommendationStock(symbol="AMZN", company_name="亚马逊", market="US", region="美国", rationale="AWS 受益模型训练与推理需求抬升。", tags=["AWS", "云平台", "规模"]),
        ],
    ),
    RecommendationGroup(
        id="tech-semiconductor",
        category="科技",
        subcategory="半导体与晶圆制造",
        description="围绕先进制程、设计周期与设备景气度的核心链条。",
        stocks=[
            RecommendationStock(symbol="AMD", company_name="超威半导体", market="US", region="美国", rationale="AI 芯片与数据中心产品线持续追赶。", tags=["AI芯片", "CPU", "成长"]),
            RecommendationStock(symbol="TSM", company_name="台积电", market="US ADR", region="中国台湾", rationale="先进制程份额和客户黏性都很强。", tags=["晶圆代工", "先进制程", "龙头"]),
            RecommendationStock(symbol="ASML", company_name="阿斯麦", market="US ADR", region="欧洲", rationale="EUV 设备具有极强的稀缺性。", tags=["设备", "EUV", "壁垒"]),
        ],
    ),
    RecommendationGroup(
        id="tech-software",
        category="科技",
        subcategory="企业软件与自动化",
        description="关注高续费率、流程自动化和企业软件提价能力。",
        stocks=[
            RecommendationStock(symbol="NOW", company_name="ServiceNow", market="US", region="美国", rationale="流程自动化与企业 AI 工作流结合紧密。", tags=["SaaS", "自动化", "高毛利"]),
            RecommendationStock(symbol="CRM", company_name="Salesforce", market="US", region="美国", rationale="CRM 平台叠加 Agent AI，客户基础大。", tags=["CRM", "AI助手", "订阅"]),
            RecommendationStock(symbol="ADBE", company_name="Adobe", market="US", region="美国", rationale="创意软件现金流稳，生成式 AI 商业化清晰。", tags=["软件", "生成式AI", "订阅"]),
        ],
    ),
    RecommendationGroup(
        id="tech-cybersecurity",
        category="科技",
        subcategory="网络安全",
        description="预算相对刚性，适合做防御型成长赛道观察。",
        stocks=[
            RecommendationStock(symbol="CRWD", company_name="CrowdStrike", market="US", region="美国", rationale="终端安全平台化优势明显。", tags=["安全", "SaaS", "平台"]),
            RecommendationStock(symbol="PANW", company_name="Palo Alto Networks", market="US", region="美国", rationale="云安全与企业边界安全双布局。", tags=["网络安全", "企业IT", "稳定"]),
            RecommendationStock(symbol="FTNT", company_name="Fortinet", market="US", region="美国", rationale="硬件与订阅结合，渠道能力强。", tags=["安全硬件", "订阅", "渠道"]),
        ],
    ),
    RecommendationGroup(
        id="tech-platforms",
        category="科技",
        subcategory="互联网平台与广告",
        description="看平台流量效率、广告恢复和电商变现能力。",
        stocks=[
            RecommendationStock(symbol="META", company_name="Meta", market="US", region="美国", rationale="广告效率与 AI 推荐引擎持续改善。", tags=["广告", "社交", "AI推荐"]),
            RecommendationStock(symbol="GOOGL", company_name="Alphabet", market="US", region="美国", rationale="搜索与云业务仍具规模优势。", tags=["搜索", "云", "平台"]),
            RecommendationStock(symbol="PDD", company_name="拼多多", market="US ADR", region="中国", rationale="全球化电商和性价比心智突出。", tags=["电商", "出海", "高增长"]),
        ],
    ),
    RecommendationGroup(
        id="manufacturing-automation",
        category="制造",
        subcategory="工业自动化",
        description="受益于制造升级、工厂数字化和配电改造。",
        stocks=[
            RecommendationStock(symbol="HON", company_name="霍尼韦尔", market="US", region="美国", rationale="工业软件与自动化场景覆盖广。", tags=["工业", "自动化", "多元化"]),
            RecommendationStock(symbol="ROK", company_name="罗克韦尔自动化", market="US", region="美国", rationale="离散制造自动化纯度更高。", tags=["自动化", "工厂", "工业软件"]),
            RecommendationStock(symbol="ETN", company_name="伊顿", market="US", region="美国", rationale="配电、电气化与工业升级同步受益。", tags=["电气化", "工业", "基建"]),
        ],
    ),
    RecommendationGroup(
        id="manufacturing-ev",
        category="制造",
        subcategory="电动车与电池",
        description="聚焦整车竞争、储能扩张与动力电池产业链。",
        stocks=[
            RecommendationStock(symbol="TSLA", company_name="特斯拉", market="US", region="美国", rationale="软件定义汽车与储能业务兼具想象力。", tags=["电动车", "储能", "机器人"]),
            RecommendationStock(symbol="300750", company_name="宁德时代", market="CN A-share", region="中国", rationale="动力电池龙头，出海与储能同步推进。", tags=["电池", "储能", "龙头"]),
            RecommendationStock(symbol="002594", company_name="比亚迪", market="CN A-share", region="中国", rationale="整车、电池、电子协同能力突出。", tags=["整车", "电池", "垂直整合"]),
        ],
    ),
    RecommendationGroup(
        id="manufacturing-defense",
        category="制造",
        subcategory="航空航天与国防",
        description="订单周期长、现金流可预期，适合中长期观察。",
        stocks=[
            RecommendationStock(symbol="LMT", company_name="洛克希德马丁", market="US", region="美国", rationale="军工主承包地位稳固，订单能见度高。", tags=["军工", "订单", "防御"]),
            RecommendationStock(symbol="RTX", company_name="雷神技术", market="US", region="美国", rationale="航空发动机与防务业务兼备。", tags=["发动机", "防务", "航空"]),
            RecommendationStock(symbol="BA", company_name="波音", market="US", region="美国", rationale="若经营修复顺利，弹性较大但波动也更高。", tags=["航空制造", "修复", "高波动"]),
        ],
    ),
    RecommendationGroup(
        id="manufacturing-machinery",
        category="制造",
        subcategory="工程机械与设备",
        description="与基建、农业资本开支和矿业周期紧密相关。",
        stocks=[
            RecommendationStock(symbol="CAT", company_name="卡特彼勒", market="US", region="美国", rationale="矿山与工程机械景气度的核心代表。", tags=["工程机械", "矿业", "基建"]),
            RecommendationStock(symbol="DE", company_name="迪尔", market="US", region="美国", rationale="农业机械数字化与高端化持续推进。", tags=["农业机械", "自动驾驶", "设备"]),
            RecommendationStock(symbol="000425", company_name="徐工机械", market="CN A-share", region="中国", rationale="国内工程机械龙头之一，受益于更新周期。", tags=["基建", "设备", "A股"]),
        ],
    ),
    RecommendationGroup(
        id="healthcare-innovative-pharma",
        category="医药",
        subcategory="创新药龙头",
        description="看重产品管线兑现、国际化放量和估值溢价能力。",
        stocks=[
            RecommendationStock(symbol="LLY", company_name="礼来", market="US", region="美国", rationale="减重药与创新药双主线驱动估值。", tags=["减重药", "创新药", "龙头"]),
            RecommendationStock(symbol="NVO", company_name="诺和诺德", market="US ADR", region="欧洲", rationale="代谢类药物具全球放量确定性。", tags=["GLP-1", "全球化", "高景气"]),
            RecommendationStock(symbol="MRK", company_name="默沙东", market="US", region="美国", rationale="成熟现金牛与新管线形成平衡。", tags=["创新药", "现金流", "防御"]),
        ],
    ),
    RecommendationGroup(
        id="healthcare-devices",
        category="医药",
        subcategory="医疗器械",
        description="器械龙头通常具备更好的商业模式与稳定性。",
        stocks=[
            RecommendationStock(symbol="ISRG", company_name="直觉外科", market="US", region="美国", rationale="手术机器人平台生态壁垒高。", tags=["机器人", "高端器械", "平台"]),
            RecommendationStock(symbol="ABT", company_name="雅培", market="US", region="美国", rationale="诊断与器械布局均衡，抗周期能力较强。", tags=["诊断", "器械", "稳健"]),
            RecommendationStock(symbol="SYK", company_name="史赛克", market="US", region="美国", rationale="骨科和外科器械细分龙头。", tags=["骨科", "器械", "龙头"]),
        ],
    ),
    RecommendationGroup(
        id="healthcare-biotech",
        category="医药",
        subcategory="生物科技平台",
        description="适合跟踪平台技术、重磅管线和并购整合能力。",
        stocks=[
            RecommendationStock(symbol="AMGN", company_name="安进", market="US", region="美国", rationale="成熟生物药平台，现金流强。", tags=["生物药", "现金流", "平台"]),
            RecommendationStock(symbol="REGN", company_name="再生元", market="US", region="美国", rationale="抗体研发平台效率高。", tags=["抗体", "研发", "平台"]),
            RecommendationStock(symbol="VRTX", company_name="福泰制药", market="US", region="美国", rationale="罕见病领域盈利能力优秀。", tags=["罕见病", "生物科技", "盈利"]),
        ],
    ),
    RecommendationGroup(
        id="healthcare-services",
        category="医药",
        subcategory="医疗服务与支付",
        description="适合观察支付端、医保谈判与医院运营效率。",
        stocks=[
            RecommendationStock(symbol="UNH", company_name="联合健康", market="US", region="美国", rationale="保险与医疗服务协同效应明显。", tags=["保险", "医疗服务", "综合平台"]),
            RecommendationStock(symbol="HCA", company_name="HCA Healthcare", market="US", region="美国", rationale="医院运营效率和现金流较强。", tags=["医院", "运营", "现金流"]),
            RecommendationStock(symbol="CVS", company_name="CVS Health", market="US", region="美国", rationale="药店、PBM 与保险形成一体化网络。", tags=["医保", "药店", "整合"]),
        ],
    ),
    RecommendationGroup(
        id="finance-payments",
        category="金融",
        subcategory="支付与金融科技",
        description="消费修复、跨境支付和费率能力是核心看点。",
        stocks=[
            RecommendationStock(symbol="V", company_name="Visa", market="US", region="美国", rationale="全球支付网络护城河极深。", tags=["支付", "网络效应", "高利润"]),
            RecommendationStock(symbol="MA", company_name="Mastercard", market="US", region="美国", rationale="跨境支付与高端消费恢复弹性大。", tags=["支付", "跨境", "品牌"]),
            RecommendationStock(symbol="PYPL", company_name="PayPal", market="US", region="美国", rationale="处在经营优化期，适合观察修复节奏。", tags=["金融科技", "修复", "支付"]),
        ],
    ),
    RecommendationGroup(
        id="finance-data",
        category="金融",
        subcategory="交易所与金融信息服务",
        description="交易、指数与数据订阅是高质量现金流赛道。",
        stocks=[
            RecommendationStock(symbol="ICE", company_name="洲际交易所", market="US", region="美国", rationale="交易所与数据双轮驱动。", tags=["交易所", "数据", "稳定"]),
            RecommendationStock(symbol="SPGI", company_name="标普全球", market="US", region="美国", rationale="指数、评级和数据服务一体化能力强。", tags=["评级", "指数", "数据"]),
            RecommendationStock(symbol="MCO", company_name="穆迪", market="US", region="美国", rationale="评级业务具高进入壁垒。", tags=["评级", "金融数据", "壁垒"]),
        ],
    ),
    RecommendationGroup(
        id="consumer-staples",
        category="消费",
        subcategory="必选消费与渠道",
        description="适合在宏观不确定阶段跟踪防御型消费资产。",
        stocks=[
            RecommendationStock(symbol="COST", company_name="好市多", market="US", region="美国", rationale="会员制模型和渠道效率突出。", tags=["渠道", "会员", "防御"]),
            RecommendationStock(symbol="KO", company_name="可口可乐", market="US", region="美国", rationale="品牌力和全球分销网络极强。", tags=["饮料", "品牌", "防御"]),
            RecommendationStock(symbol="PG", company_name="宝洁", market="US", region="美国", rationale="日化龙头，适合防守组合观察。", tags=["日化", "消费", "稳健"]),
        ],
    ),
    RecommendationGroup(
        id="consumer-brands",
        category="消费",
        subcategory="品牌消费与餐饮",
        description="看品牌势能、门店效率和全球化能力。",
        stocks=[
            RecommendationStock(symbol="MCD", company_name="麦当劳", market="US", region="美国", rationale="加盟体系与现金流质量优秀。", tags=["餐饮", "加盟", "现金流"]),
            RecommendationStock(symbol="SBUX", company_name="星巴克", market="US", region="美国", rationale="品牌壁垒强，关注中国市场修复。", tags=["咖啡", "品牌", "修复"]),
            RecommendationStock(symbol="NKE", company_name="耐克", market="US", region="美国", rationale="品牌资产强，但库存与渠道仍需跟踪。", tags=["运动品牌", "渠道", "品牌"]),
        ],
    ),
    RecommendationGroup(
        id="consumer-digital",
        category="消费",
        subcategory="电商与旅行平台",
        description="适合跟踪线上流量、平台变现和出行景气。",
        stocks=[
            RecommendationStock(symbol="AMZN", company_name="亚马逊", market="US", region="美国", rationale="电商与云平台双引擎依旧稳健。", tags=["电商", "云", "平台"]),
            RecommendationStock(symbol="BKNG", company_name="Booking Holdings", market="US", region="美国", rationale="全球酒店与出行预订恢复受益者。", tags=["旅游", "预订平台", "出海"]),
            RecommendationStock(symbol="ABNB", company_name="Airbnb", market="US", region="美国", rationale="高品牌认知与轻资产模式兼具。", tags=["旅游", "住宿", "平台"]),
        ],
    ),
    RecommendationGroup(
        id="energy-lng",
        category="能源",
        subcategory="一体化能源与 LNG",
        description="关注油气价格、炼化利润和 LNG 长协订单。",
        stocks=[
            RecommendationStock(symbol="XOM", company_name="埃克森美孚", market="US", region="美国", rationale="一体化能源巨头，抗波动能力强。", tags=["石油", "天然气", "现金流"]),
            RecommendationStock(symbol="CVX", company_name="雪佛龙", market="US", region="美国", rationale="资本开支纪律较好，分红能力稳。", tags=["能源", "分红", "稳健"]),
            RecommendationStock(symbol="LNG", company_name="Cheniere Energy", market="US", region="美国", rationale="美国 LNG 出口逻辑的核心标的。", tags=["LNG", "出口", "能源"]),
        ],
    ),
    RecommendationGroup(
        id="energy-grid",
        category="能源",
        subcategory="电网设备与新能源",
        description="适合观察电网升级、风光装机和储能渗透。",
        stocks=[
            RecommendationStock(symbol="NEE", company_name="NextEra Energy", market="US", region="美国", rationale="公用事业与新能源结合度高。", tags=["公用事业", "新能源", "电网"]),
            RecommendationStock(symbol="GEV", company_name="GE Vernova", market="US", region="美国", rationale="电网设备与发电装备受益于全球电气化。", tags=["电网", "设备", "能源转型"]),
            RecommendationStock(symbol="601012", company_name="隆基绿能", market="CN A-share", region="中国", rationale="光伏主产业链龙头，适合跟踪周期拐点。", tags=["光伏", "A股", "周期"]),
        ],
    ),
    RecommendationGroup(
        id="materials-critical-minerals",
        category="原材料",
        subcategory="铜锂与关键矿产",
        description="受益于电气化、储能与工业升级的资源方向。",
        stocks=[
            RecommendationStock(symbol="FCX", company_name="自由港麦克莫兰", market="US", region="美国", rationale="铜价弹性与矿产资源储备兼具。", tags=["铜", "矿业", "弹性"]),
            RecommendationStock(symbol="SCCO", company_name="南方铜业", market="US", region="拉美", rationale="高纯度铜资产，分红属性也不错。", tags=["铜", "分红", "资源"]),
            RecommendationStock(symbol="ALB", company_name="雅宝", market="US", region="美国", rationale="锂价波动大，但长期受益新能源渗透。", tags=["锂", "新能源", "波动"]),
        ],
    ),
    RecommendationGroup(
        id="infra-datacenter",
        category="基建与公用事业",
        subcategory="数据中心与通信基础设施",
        description="受益于 AI 机柜需求、网络升级和企业上云。",
        stocks=[
            RecommendationStock(symbol="EQIX", company_name="Equinix", market="US", region="美国", rationale="全球中立数据中心平台稀缺。", tags=["数据中心", "REIT", "基础设施"]),
            RecommendationStock(symbol="DLR", company_name="Digital Realty", market="US", region="美国", rationale="受益于企业上云和机柜需求扩张。", tags=["数据中心", "机柜", "REIT"]),
            RecommendationStock(symbol="TMUS", company_name="T-Mobile", market="US", region="美国", rationale="无线网络资产质量较高，用户增长稳。", tags=["通信", "5G", "用户增长"]),
        ],
    ),
    RecommendationGroup(
        id="infra-logistics",
        category="基建与公用事业",
        subcategory="物流网络与运输",
        description="跟踪供应链效率、运价波动和工业运输需求。",
        stocks=[
            RecommendationStock(symbol="UPS", company_name="联合包裹", market="US", region="美国", rationale="全球快递网络成熟，适合看复苏节奏。", tags=["物流", "快递", "全球网络"]),
            RecommendationStock(symbol="FDX", company_name="联邦快递", market="US", region="美国", rationale="成本改善和运力优化是关键看点。", tags=["物流", "修复", "成本优化"]),
            RecommendationStock(symbol="CSX", company_name="CSX 铁路", market="US", region="美国", rationale="铁路运输具防御性和现金流质量。", tags=["铁路", "运输", "现金流"]),
        ],
    ),
]


def get_recommendations() -> RecommendationsResponse:
    categories: list[str] = []
    for group in RECOMMENDATION_GROUPS:
        if group.category not in categories:
            categories.append(group.category)

    return RecommendationsResponse(
        updated_at=datetime.now(timezone.utc),
        categories=categories,
        groups=RECOMMENDATION_GROUPS,
    )
