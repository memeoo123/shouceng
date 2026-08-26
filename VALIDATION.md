# Functional-complete 验收记录

## 2026-08-26 敌我士兵原始显示尺寸

- 根因是恢复器把所有动作帧统一归一化到 `68px` 高；原 `UnitModel` 实际使用待机 JTA 的原生宽高，并应用 `BattleGlobalConfig.unitGScale=0.9`、`unitGModelScale=1` 及单位 `Zoom`。骑兵待机原帧为 `99×147`，因此此前被缩小最明显。
- 敌我生产单位现统一按“待机 JTA 原生尺寸 × 0.9 × Zoom”显示，不再抹平骑兵、步兵、精英和 Boss 的体型差异；动作切换、底部锚定、血条跟随和战斗碰撞逻辑保持不变。
- `?stage=2&test=unit-actions` 通过 19/19，新增我方生产士兵原尺寸断言；`?stage=2&test=all-enemies` 的 18 种基础/精英/Boss 视觉高度全部精确匹配；Stage 2 五波仍为 35 击退、390 经验、103 金币、主城 975、胜利，控制台错误 0。
- JavaScript 源码与运行产物 SHA-256 均为 `FB543DCD3BD4DF11A21D0769AB1CE8535E89C733CC884745D8324FC8F9D7ABAB`；机器证据：`evidence/UNIT_ACTION_ANIMATION_SMOKE.json`、`evidence/ALL_ENEMY_MECHANICS.json`。

## 2026-08-26 准备阶段交互与普通关波次规则闭合

- `BuildItem.allow2Shop` 已按原版扩大到所有“无有效目标地格”的落点，不再只认底部商店矩形；未上阵区支持场上→商店及商店→商店的同 ID、同等级合成。
- 已恢复 `allowRpeItemChange=true`：不同建筑占位替换时，被替换建筑优先换到拖拽来源格，放不下的剩余建筑回未上阵区；扩地道具按 `allowConflictFloor=3` 裁掉已存在地板，只扩张剩余格。
- 开战时没有兵营或防御塔会先显示确认提示；普通关每波开战恢复主城和存活/可恢复建筑生命，阵亡建筑保留到下一波，`BuildNotRecover` 模式仍永久移除。
- `?stage=2&test=placement-rules` 通过 7/7；回库 11/11、第二波拖动 9/9、商店/障碍和建筑合成继续通过。Stage 2 五波仍为 35 击退、390 经验、103 金币、主城 975、胜利，控制台错误 0。
- JavaScript 源码与运行产物 SHA-256 均为 `2AB4BEAC7EE907E7343032AA48EE5667467F8DB342813DE5B9BF23910B90C014`；机器证据：`evidence/PLACEMENT_RULES_SMOKE.json`。

## 2026-08-26 场上棋子放回未上阵商店区

- 原版明确启用 `BuildItem.allow2Shop=true`：准备阶段把已上阵棋子拖到没有战场地格的商店陈列区，会解除占地并回到未上阵列表；恢复工程此前把所有无效落点都放回原格，现已补齐该路径。
- 回库棋子会显示为可再次拖动的商店项；再次上阵恢复原 ID、等级、当前/最大生命和攻击冷却，阵亡召唤物随兵营离场清理，原场地占位正确释放。
- `?stage=2&test=shop-return` 在第二波准备期通过 11/11；第二波普通拖动、商店/树木和 Stage 2 五波回归继续通过，五波结果仍为 35 击退、390 经验、103 金币、胜利。
- JavaScript 源码与运行产物 SHA-256 均为 `C4E4D2CB8895C38A922C9852986B67C1E129E0AFD2A18CE9BC17498FF7E1275A`；机器证据：`evidence/SHOP_RETURN_SMOKE.json`。

## 2026-08-24 我方士兵血条

- 按原 `UnitHpBar` 恢复我方单位血条：使用已恢复的 `70×14` 背景和 `64×8` 填充资源，出生时隐藏，第一次受击后显示。
- 血条现跟随士兵移动并实时反映扣血、治疗和生命上限变化；士兵阵亡或所属兵营移除时，血条与单位同步销毁，不留下悬空节点。
- `?stage=2&test=ally-hp-bar` 通过 8/8：生产士兵持有血条、首次受击 HP `75→65`、显示/宽度/跟随/治疗/阵亡清理均通过；单位动作专项继续通过，Stage 2 五波仍为 35 击退、390 经验、103 金币、胜利。
- JavaScript 源码与运行产物 SHA-256 均为 `A916A1812B75250BF21439E17CFDB3298FE5E5F95F73749CE5FF57EDB1118D37`；机器证据：`evidence/ALLY_HEALTH_BAR_SMOKE.json`。

## 2026-08-24 完整单位动作系统

- 关内单位并非 Spine 骨骼动画，而是原 `BRBMoveClip` 驱动的 FairyGUI/JTA 序列帧；现已接入 24 个单位身体、100 个动作片段、1,016 张蓝队原帧及 1,016 张按原着色器规则派生的红队帧。
- 24 个身体全部具有待机、移动、攻击、胜利动作，4 个骑士身体另有冲锋动作；所有 JTA 片段保持原 `102ms` 帧间隔，并使用模型表的 `fireFrame/endFrame` 让伤害或弹体在攻击动作的原帧位触发。冷却短于自然攻击动作时按原逻辑压缩帧间隔。
- 生产敌我单位现会在待机、移动、攻击、骑士冲锋、波末胜利之间切换，并以 `0.2s ExpoOut` 平滑翻转朝向；测试仍明确不虚构包内不存在的死亡片段。
- `?stage=2&test=unit-actions` 通过 18/18；第二波拖动 9/9、商店/树木清除继续通过；Stage 2 五波仍为 35 击退、390 经验、战内金币 103、城堡 975、胜利，控制台错误 0。
- JavaScript 源码与运行产物 SHA-256 均为 `022BE3D5A86DDF77FDFEBD402CF75BDAA592A481981B81091D187CF36D509669`；机器证据：`evidence/UNIT_ACTION_ANIMATION_SMOKE.json`。

## 2026-08-24 第二波建筑拖动修复

- 根因不是波次状态未恢复，而是 `BattleShop`、`HUD`、`Overlays` 三个高层 Sprite 覆盖完整设计舞台；第二波准备阶段商店重新显示后，其透明空白区拦截了下层建筑的指针命中。
- 三个全屏 UI 层及底部空袭子层现启用 `mouseThrough`：实际按钮继续接收输入，透明区域把输入传给建筑层；战斗期仍按原规则锁定建筑拖动。
- `?stage=2&test=wave-two-drag` 通过 9/9：战斗期禁用、第二波准备状态、三层穿透、建筑输入恢复、商品输入、真实 `MOUSE_DOWN` 启动拖动及原格放回占位均通过。`?stage=2&test=shop` 与免费首棵树回归继续通过。
- JavaScript 源码与运行产物 SHA-256 均为 `DA87C09423C439E3A9BA671EFD79FD26B0A7C98921577B994274E702D4779F2E`；机器证据：`evidence/WAVE_TWO_DRAG_SMOKE.json`。

## 2026-08-24 空袭技能栏手机布局修复

- 原三枚 `163×107` 按钮和横向位置保持不变；移除恢复工程固定 `y=1135` 的布局假设，技能栏现在按 Laya 实际固定宽度舞台高度贴底。
- 在用户同类竖屏视口上实测舞台高度为 1495，技能栏为 `y=1375、height=120、bottom=1495`，已移入最后一排建筑下方，不再遮挡建筑图标。
- `?test=air-support` 通过 11/11：新增底部停靠断言，同时陨石、治疗、冻结、原顺序和每局单次逻辑保持通过。
- JavaScript 源码与运行产物 SHA-256 均为 `34F525C9149E3E2AFEE166946EACEC9A8FE3F9675E6B7ACB58366630DBFAD8D9`；机器证据：`evidence/AIR_SUPPORT_RUNTIME_SMOKE.json`。

## 2026-08-24 离线局外第一阶段

- 关内 functional-complete 基线保持不变；扩展的离线局外范围重新进入 `implementation / in_progress`，本节只验收第一阶段，不宣称整个局外完成。
- 普通入口已切换到原 `MainTabPage` 五页框架，27 个恢复的 FairyGUI 包全部从本地 `.bin` 成功加载；原 `MainPage`、关卡选择、宝箱、开始作战、再战/下一关/返回主界面形成离线闭环。
- `LocalProfile` v2 按 AppID+版本保存 `MaxStageRecord`、波次宝箱、`Prop/Item`、装备等级、科技等级、编队和当前页签。
- 41/41 条原科技表已导入；根节点、父级满级解锁、精确消耗、等级上限和重复乘算/加算战斗效果均由 `?test=meta` 验证。
- 商店、副本、广告、快速建造和网络奖励入口保持明确禁用；未发送网络请求，也未虚构账号资产或远端结算。
- 修复局外进入战斗后的整屏输入拦截：FairyGUI `GRoot` 现在只在局外取得输入所有权，进入战斗会同步隐藏并禁用其全屏节点，返回主界面时再恢复。
- `?test=meta` 通过 15/15，包含局外输入接管和战斗输入释放两项专项断言；FairyGUI 27/27，控制台错误 0。`?stage=2&test=shop` 继续证明树木首次免费、第二次消耗 1；`?stage=2&test=battle` 仍为 35 击退、390 经验、103 战内金币、胜利。
- JavaScript 源码与运行产物 SHA-256 均为 `B6704EA81A72394D4DB70552C951F42F5A602E3F3306C1CB06D8A2F9DF3D5482`；机器证据：`evidence/OFFLINE_META_SMOKE.json`。

## 2026-08-24 树木点击清除修复

- 修复树木与价格牌只显示 `0`、真实指针事件未稳定进入清除逻辑的问题；现在准备阶段既保留树/价格牌处理器，也由舞台按原障碍组件的完整 `92×92` 地格做命中回退。
- 清除价格严格使用恢复表 `[0,1,2,3,4,5]`：第一棵免费，第二棵需要 1 战内金币；金币不足不清除，成功后扣费、递增计数、刷新剩余树价格并把格子转为可放置地面。
- `?stage=2&test=shop` 已通过完整地格事件路径，障碍专项全部通过，控制台错误/警告 0；Stage 2 五波仍为 35 击退、390 经验、金币 103、胜利。
- JavaScript 源码与运行产物 SHA-256 均为 `AAFEBCC7E03DF61EE3FAE642F60A822B3DF353AB187BFE523F45D0EA1CF9CA12`。

## 2026-08-24 本地档案与波次宝箱

- 按原 `GetWaveChest` 恢复显式领取：战斗胜利只推进 `MaxStageRecord`，不会自动代领 `RewardWave/ChestRewards`；普通准备界面新增宝箱入口，匹配截图路由继续隐藏所有本地导航控件。
- 新增 AppID+版本隔离的 `LocalProfile`，保存 `MaxStageRecord`、`WaveChest_stage_idx`、`Prop` 和 `Item` 数量，并兼容迁移旧进度键；新档不填充无证据的初始货币、装备或账号字段。
- `?stage=2&test=local-profile` 通过 10/10：在 `[2,5]` 前沿可领 3/5 波宝箱、10 波宝箱保持锁定；清关后可领最终宝箱；重复领取不变更资产；`ChestRewardAdd` 使 5 体力奖励按原本地运行分支成为 10。
- 战役推进仍为 12/12，全 220 关奖励元数据门禁通过；Stage 2 五波仍为 35 击退、390 经验、等级 7/余量 8、金币 103、城堡 975、胜利，控制台错误和警告均为 0。
- JavaScript 源码与运行产物 SHA-256 均为 `8C313C0816D847D338855B0D52E3BFB5EC98D94159E684FE0E823C8689C12D0D`；机器证据：`evidence/LOCAL_PROFILE_REWARD_SMOKE.json`。

## 2026-08-24 视觉基线刷新

- 重新捕获拖放、准备、第一波入场、交战和开局商店五个确定性画布，并与原录屏接触表及既有基线逐项复核。
- 发现并修复 `capture=1` 时误显示本地恢复工程关卡切换控件的问题；普通本地战役入口仍保留关卡导航。
- Stage 2 五波代表战斗连续三次结果一致：35 击退、390 经验、战斗等级 7、等级余量 8、战内金币 103、城堡 975、胜利，控制台错误和警告均为 0。
- 220 关目录、2,620 波/60,588 敌人编队、全关初始化与奖励门禁重新通过；资源清单 572 项缺失 0。
- JavaScript 源码检查、构建和运行产物检查通过；源码与运行产物 SHA-256 均为 `8275D61B2518BC05B5EF39493FAB0892BC17CD17274CB41AA63A44FC978431E4`。
- 机器证据：`evidence/VISUAL_BASELINE_20260824.json`。

验收时间：2026-08-20；目标：`wx4f4f3709865004a2/3`；运行时：LayaAir 2.13.1。

## 全内容清单

- 220/220 关 ID 连续，地图均为 9×7 且只包含 `o/1/2`。
- 220/220 关的全部 2620 波已实际调用生产 `buildWaveRoster`：60,588 个编队项、2,923 个精英转换、219 个终波头领转换全部通过，编队校验和 `8ad99825`。
- 19/19 建筑形状有效，一级图片引用全部存在；89 张建筑图片已加载。
- 24 个单位身体的 100 个原 JTA 动作片段全部加载：1,016 张蓝队原帧与 1,016 张按原着色器规则生成的红队帧，覆盖待机、移动、攻击、胜利及骑士冲锋。
- 关卡使用 Forest、Desert、Snowfield 三主题；第 220 关的种子地形实机加载通过。
- 浏览器烟测结果：`ok=true`，错误数组为空；控制台错误 0、警告 0。

## 商店与扩地规则

- `?stage=2&test=shop` 通过：初始兵营/防御双保底、第三次刷新地块保底、地块扩张清树、特殊刷新二级保底全部为 `true`。
- 第 2 关物品类型原始权重为 `[887,100,13]`，顺序是装备/金币/地块；第一波建筑等级权重为 `[0.88,0.06,0.06]`。
- 普通按钮第一次刷新免费，随后 15；12 种 `shape.json` 地块形状及权重已导入。
- `?stage=2&test=shop-free-item` 通过：通用 trait 10 将 `shopShowItemCnt` 从 3 增为 4，刷新历史实际含 4 件，第 4 件进入生产拖拽并成功落地；波次结束按原 `flush=true` 语义免费刷新。
- 第 2 关开局用本地种子 677 对齐录屏中的二级弓兵营、一级箭塔、一级围墙；只作为 golden 适配，不声称恢复原进程全局随机状态。
- 审计记录：`evidence/SHOP_RULE_AUDIT.json`；开局画面：`evidence/visual-alignment-opening-shop.png`。

## 全建筑机制

- `?stage=2&test=all-buildings` 通过：19/19 定义、6 类兵营、4 类防御塔以及经验、金币、两类围墙均命中。
- 原物理换算为 50 像素/单位，单位全局速度倍率 1.25；减速公式为 `speed/(1+amount)`。
- 相邻攻击/攻速只作用于八邻域接壤建筑；暴击和移速降低是全局效果。
- 投石范围 75 像素、溅射倍率 0.5；电塔跳转 1 次且保持全伤害；镜塔 2 秒内每 0.25 秒触发，合计 8 次、烟测总伤害 160。
- 审计记录：`evidence/ALL_BUILDING_MECHANICS.json`。

## 合成、通用战斗数值与 TraitSelect

- 同 ID、同等级建筑可通过实际拖放叠加，来源对象消耗、目标升一级，4 级封顶；运行烟测使用两座真实 1 级城墙验证了对象移除与占位保持。
- 19 类建筑逐项使用原 `SynChangeKey/SynChangeVal`：4 级兵营血量仍 520、召唤冷却 4 秒、驻场上限 8；4 级箭塔攻击 70、血量仍 130；4 级单格墙 591.5 HP；经验建筑 0.4、矿场每波 8。
- 单位闪避先于暴击；暴击按 `CritDamage` 乘伤。精英/头领击退初速为 12 物理单位/秒，分别在 0.3/0.35 秒内线性衰减；`RepelResist` 阻止击退。
- `unit_AoeAtk` 原配置强制参数为 `[2]`：基础法师及六类头领以 2 物理单位即 100 像素为半径，默认伤害倍率 1。运行用例验证目标与 60 像素邻居各承受完整 10 点，150 像素外对象不受伤。
- 30/30 条 `fight_lv_up` 阈值、16/16 类通用 trait 与 112/112 条装备专属 trait 数据完整性通过。普通敌人关内经验为 `floor(10×0.833333)=8`；升级时按原代码清空本级溢出并暂停三选一。
- 普通 `?test=trait` 路由验证为 `paused-choice` 且生成 3 个品质加权选项；重复的全体攻/血/攻速/远程射程与敌军减速按逐条乘算，而非错误地先加总。`test=battle` 自动选最高品质仅用于无人值守回归。
- 112 条装备 trait 中 111 条已关联回原运行时类与作用对象；ID 104 `AllBarracksSpeed` 在原版本没有对应配置，按原缺陷标记而未伪造。`?test=equipment-traits` 验证 32 类、66 条数值词条，覆盖建筑/召唤单位/全局单位/防御塔/城墙、同类建筑计数、经验与光环以及五级合成解锁。
- `?test=equipment-events` 验证 40 类、45 条事件词条：除必暴、斩杀、散射、连射、穿透、弹射、护盾和反伤外，还覆盖骑兵冲锋/眩晕、重伤、陨石/燃烧区、最大生命封顶追加伤害、减速陷阱、麻痹/冻结、概率自增益及冰火箭/石改造。
- `?test=equipment-runtime` 走生产创建路径：满测试载入箭塔得到 185.9 HP、24.2 攻击、1.066666 秒冷却、690 像素射程、双发/双命中；剑士得到 399.3 HP、33 攻击、1.5 攻速、75.625 像素/秒；盾兵得到 605 HP 与 484 护盾。ID 104 被以 `original-config-missing` 拒绝。
- `?test=equipment-status-runtime` 通过生产对象与共享时钟验证：骑兵首撞 0.3 倍伤害并消耗 1.5 倍冲锋速度，附带击退/3 秒眩晕；重伤使后续 100 点变为 110；陨石冷却抑制重复生成并造成 0.5 倍范围伤/0.15 倍灼烧；90 像素陷阱减速 0.4 持续 2.6 秒；麻痹/冻结、火系灼烧及冰系移速/攻速减慢均通过。证据：`evidence/EQUIPMENT_STATUS_RUNTIME_SMOKE.json`。
- `?test=equipment-secondary-runtime` 通过：e02 的 23 点真实弹体命中触发 100 像素、0.5 倍箭雨并由 3 秒冷却抑制第二次生成；e03 闪避后下一击由 40 增至 50 且立即消费；e06 的 10 点护盾承受 15 点后归零、溢出 5 点，并对范围内两敌各造成 2.5；e07 概率击退使用原默认 10 物理单位/秒、0.3 秒。证据：`evidence/EQUIPMENT_SECONDARY_RUNTIME_SMOKE.json`。
- `?test=equipment-projectile-runtime` 通过：散射实际生成 `[0,-10,+10,-20,+20]` 五向并分别造成 23 点；弩兵四连射在 0/100/200/300ms 产生；4 枚弹体首次命中后均保留并沿前向穿透，使前后目标各承受 `4×35=140`；电塔弹体连续 5 次命中后才销毁，总伤 `5×40=200`；1 HP 敌人受到 2 点延后一帧反伤后从生产死亡路径移除，击杀/波次 resolved/经验分别增加 1/1/10。证据：`evidence/EQUIPMENT_PROJECTILE_RUNTIME_SMOKE.json`。
- `?test=projectile-travel-timing` 通过 8/8：单位 `BulletSpeed` 15/18/19.5 经 50 像素物理倍率分别为 750/900/975px/s；普通箭、投掷、闪电默认速度分别为 1000/1250/6000px/s。生产 `fire` 的 300px/750px/s 飞行为 0.4 秒，600px 为 0.8 秒，不再被旧恢复器统一 850px/s 与 0.12–0.55 秒范围截断。证据：`evidence/PROJECTILE_TRAVEL_TIMING_SMOKE.json`。
- `?test=projectile-auto-flow` 通过 9/9：普通防御塔弹药按原规则启用追踪并先检查再累计 30ms 时钟；16/32ms 两帧保持 0°，第三帧才以最大 10° 转向，750px/s 速度模长不变，位置由线速度积分。原版本只处理大于 180° 的角差分支也已保留。单位弹药分支未设置 `autoFlow`，因此敌我 `UnitBullet` 均保持原默认直线飞行。证据：`evidence/PROJECTILE_AUTO_FLOW_SMOKE.json`。
- `?test=player-projectile-contact` 通过 10/10：普通我方/防御塔 `FireBullet` 按原 `EnemyUnit` 掩码对整段运动路径取首次传感器接触，更近敌人可先于初始目标拦截；初始目标销毁后弹体保留最后速度，纯目的地散射弹仍可碰撞，无接触时直到原 `bulletTime` 才销毁。投石与闪电保留目标型派生类语义。证据：`evidence/PLAYER_PROJECTILE_CONTACT_SMOKE.json`。
- `?test=projectile-dead-in-last` 通过 10/10：`FireBullet.deadInLast` 在活目标移动时刷新最终点，死亡后关闭 `autoFlow` 并把接触集合替换为死亡点 50×50 伪目标，途中敌人伤害为 0，距离不超过 50 时立即回收；`BMeteoriteSupport.forceTargets` 同时保证活目标阶段也不会被旁观敌人截获。证据：`evidence/PROJECTILE_DEAD_IN_LAST_SMOKE.json`。
- `?test=campaign-progression` 通过 12/12：原 `MaxStageRecord=[stage,wave]` 推进规则、本地持久化、损坏记录回退、普通选关锁定及最终关上限均已验证。专项接入后 220 关目录/初始化、2620 波 60588 敌人编队、660 奖励包、失败重试、经济结算全绿；Stage 2 三次结果完全一致。证据：`evidence/CAMPAIGN_PROGRESSION_SMOKE.json`。
- `?test=local-profile` 通过 10/10：旧 `MaxStageRecord` 迁移、无虚构初始资产、波次里程碑锁定、显式领取、`WaveChest_stage_idx` 防重、`ChestRewardAdd`、`Prop/Item` 写入、目标版本隔离和数据表不可变性均已验证。证据：`evidence/LOCAL_PROFILE_REWARD_SMOKE.json`。
- `?test=build-weapon-targeting` 通过 6/6：修复恢复器此前依赖未初始化 `enemy.progress` 导致防御塔不攻击的问题。原 `BuildWeapon.targets` 按碰撞进入顺序保存；该版本 `UnitRoute` 无 `cur`，候选路径长度全部回退为 0，严格 `<` 因而保持首个存活、未销毁、射程内目标。生产适配不再虚构进度字段。证据：`evidence/BUILD_WEAPON_TARGETING_SMOKE.json`。
- `npm run sweep:battles -- --concurrency=4 --discover-timeout=30000 --port-base=15000` 单次覆盖 220/220 关、2620 波、60588 个敌人并得到 220 次胜利，校验和 `413c4ac8`、console error 0。扫关保留生产地图、波表、编队、出生、移动、攻击、弹体、死亡、经济、波次切换和结算，仅用明确标注的测试专用耐久/伤害/短波间适配器保证可达性；该结果不声明未知账号状态下的原版平衡或自然可通关性。证据：`evidence/ALL_STAGE_BATTLE_SWEEP.json`。
- 防御塔选敌修复后，Stage 2 固定 1/60 秒测试步进保持：35 击杀、390 经验、等级 7、等级条余量 8、战内金币 103、城堡 975、胜利，7 个 trait 相同。当前源码与构建运行时 SHA-256 同为 `8C313C0816D847D338855B0D52E3BFB5EC98D94159E684FE0E823C8689C12D0D`。
- `?test=enemy-projectile-runtime` 通过 10/10：敌军攻击不再在发射时直接扣血，而是生成 `UnitBullet`。弓手 18 物理单位/秒换算为 900px/s，可见远程弹在接触前不伤害；目标死亡后弹体继续前进并可被路径友军拦截；近战使用无贴图范围传感器并在首物理步命中；建筑/城堡同样只在弹体接触时结算，AOE、闪避、暴击、护盾、击退与反伤仍走统一受击路径。证据：`evidence/ENEMY_PROJECTILE_RUNTIME_SMOKE.json`。
- `?test=all-enemies` 通过：18/18 变体均由生产 `spawnEnemy` 创建，精确分为 6 基础/6 精英/6 头领；6 条基础到精英/头领转换完整，波次 HP/攻击及 50px×1.25 速度换算正确，180 个敌方动画帧引用存在；精英击退为 600px/s、0.3 秒，6 头领均免疫击退且 AOE 半径 100px，基础单位中仅法师 `fs_18B222C3` 具有同半径 AOE。证据：`evidence/ALL_ENEMY_MECHANICS.json`。
- `?test=air-support` 通过：按原顺序恢复陨石、治疗、冻结三按钮；治疗把 25% HP 友军恢复至满血，冻结把 3 个敌人控制 4 秒，陨石在原 3 秒窗口清除释放时的 3 敌快照；三个按钮均验证为每局单次。证据：`evidence/AIR_SUPPORT_RUNTIME_SMOKE.json`。
- 机制/数据覆盖矩阵：`evidence/MECHANICS_DATA_COVERAGE.json`。

## 代表关卡闭环

第 2 关使用原表五波有效数量 `[3,4,7,9,12]`。浏览器验证了准备布局、兵营召唤、普通/精英敌人、围墙被攻击、远近程伤害、末波头领和胜负结算。

最终结果（v67）：普通入口装备载入为空、空袭使用数为 0，并从目标隔离的本地 `MaxStageRecord` 恢复关卡前沿；固定 1/60 秒门禁步进下三次五波结果完全一致：35 击退，390 经验，战斗等级 7、等级条余量 16、已应用同一组 7 个通用 trait，战内金币 103，城堡 975/975，`victory=true`。关卡推进专项 12/12，220 关目录/初始化、2620 波完整编队、奖励、失败重试与经济回归全绿，控制台错误为 0。

## 随机与单位路径

- 原 `jasmin` 确定性算法已确认：`state=(9301×state+49297)%233280`；种子地图使用 `stage×1000`，波次编队使用 `stage×1000+波次下标`。
- `BattleScene.rand` 没有 `randMark` 时直接调用 `Math.random`，商店正属于该分支。恢复工程正常入口同样使用 `Math.random`；仅截图/烟测路由使用隔离的确定性 LCG 流。
- 原 `UnitRoute` 不使用 A*，且由敌军与 `PlayerUnit` 共用。敌军首次索敌使用含边界的 `routeSerchRange=600`，已有存活缓存越界后仍有效；友军明确覆盖 `order=-1/searchRange=-1`，朝上搜索全部敌军并使用负角度偏航、向上回退、镜像后退修正和同队排斥。建筑目标、随机取样和固定半径 50 接触规则保持一致；证据为 `evidence/UNIT_ROUTE_SEARCH_RANGE_SMOKE.json`、`evidence/PLAYER_UNIT_ROUTE_SMOKE.json`、`evidence/UNIT_ROUTE_TARGET_CACHE_SMOKE.json`、`evidence/UNIT_ROUTE_TARGETING_SMOKE.json` 和 `evidence/UNIT_ROUTE_COLLIDER_SMOKE.json`。
- `gravityengine.mg.layats.min.js` 经内容审计是分析 SDK，不是战斗物理模块。审计记录：`evidence/RANDOM_AND_ROUTE_AUDIT.json`。

## 美术对齐回归

- 准备阶段：原始 HUD 坐标、610×22 经验条、等级牌、金币底板与商店按钮已落地；物品上场后已消费槽位按原画面留空，不显示灰色恢复占位。
- 组合建筑消费：箭塔等包含独立旋转武器挂件的商品上场时，会同时清理商店主体与 `WeaponMount`，不再留下单独箭矢。
- 全商店建筑复合审计：`?test=all-shop-visuals` 实际创建 18×4=72 个主体和 4×4=16 个独立挂件，资源、自然尺寸、缩放、挂件创建与消费清理全部通过；证据为 `evidence/ALL_SHOP_BUILDING_VISUAL_AUDIT.json`。
- 全关卡初始化审计：`?test=all-stage-init` 将 220 关逐一送入生产地图、城堡定位、占位和放置助手；3,960 个关卡×建筑组合、2,603 个初始扩地落点、三套背景、商店权重、波次向量和敌池全部通过。唯一 Stage 1/e04 需一次合法扩地，保留原地图语义；证据为 `evidence/ALL_STAGE_INITIALIZATION_AUDIT.json`。
- 失败/重试生命周期：`?test=defeat-retry` 验证失败结算、遮罩/商店/空袭状态、全运行对象清理、原地图和占位恢复、三栏商店/免费首刷、暂停与倍速复位、旧结果清除，并重新进入第一波生产编队；证据为 `evidence/DEFEAT_RETRY_LIFECYCLE_SMOKE.json`。
- 拖放阶段：有效格为绿色、无效格为红色；实际建筑幽灵跟随有效性切换透明度，放下后仍走生产放置校验。
- 场景转换：按 `BattleScene.xml` 恢复 337 设计像素的准备/战斗位移；750×1286 可见区不再出现底部空带。
- 战斗阶段：商店和价格牌隐藏，树阵/建筑/城堡下移，敌人从顶部进入；敌人使用 70×14 原红色血条，建筑使用原绿色血条，伤害数字恢复为大号白字黑描边。
- 资源尺寸：树、兵营、箭塔和围墙按恢复图片自然尺寸显示，并用录屏对照修正纵向锚点。
- 建筑组合：修正 `*_up.png` 误当全尺寸升级覆盖层的问题；弩塔、电塔、镜塔和投石器改用原代码挂点/枢轴，6 页图鉴已遍历 18/18 种可购买建筑，缺图为 0。
- 阵营着色：从原包恢复 `BattleRFillShader.color_rb` 的精确像素条件与 `R=B×0.924、G=0、B=B×0.265` 系数；240 帧敌方派生图保留肤色、武器与黑色描边。
- 武器朝向：四类带挂件防御塔按原 `rotSpeed=600` 逐帧转向射程内目标。
- 美术改动后的回归结果：220/220 烟测通过；第 2 关仍为 35 击退、390 经验、城堡 975/975、胜利。
- 本轮截图：`evidence/visual-alignment-drag.png`、`evidence/visual-alignment-prep.png`、`evidence/visual-alignment-battle.png`、`evidence/visual-alignment-combat.png`、`evidence/visual-alignment-opening-shop.png`。t02/t07/t12/t18 四个确定性基线及开局商店对齐均已捕获；敌方动态着色与商店算法闭合。
- 建筑图鉴巡检记录：`evidence/BUILDING_VISUAL_AUDIT.json`。
- 敌方阵营帧审计：`evidence/ENEMY_TEAM_PALETTE_AUDIT.json`。

## 已知边界

- 路径转向及 `unit_collider` 几何/碰撞力已从 `UnitRoute` 恢复；Laya 原生刚体的接触集合目前由同半径、同退出边界的本地可重复重叠检测替代。普通 `FireBullet`、散射/穿透与敌方 `UnitBullet` 均使用原固定 `50×80` 单位受击盒、建筑/城堡碰撞区、弹体实际宽高、对应阵营掩码与连续扫掠首次接触；投石/闪电维持目标型特化。原生 Box2D 子步与同帧多接触回调排序仍是边界。
- 后端账户身份、支付、广告、分析服务隔离；本地档案只承载已证实的关卡前沿、波次宝箱标记与 `Prop/Item` 数量。
- 112 条装备专属 trait 已完整保留；除原版缺配置的 ID 104 外，其余 111 条均具备账号无关数值/事件求值。实际启用集合仍依赖局外装备槽位/等级的账号状态，没有授权账号快照时不自动灌入初始本地档。
- 原版正常使用 `Math.random`，但录屏时刻的引擎内部随机状态无法从静态包体恢复；第 2 关开局种子仅供截图 golden。
