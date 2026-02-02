      const dungeons = Array.isArray(window.DUNGEONS) ? window.DUNGEONS : [];
      const weapons = Array.isArray(window.WEAPONS) ? window.WEAPONS : [];
      const weaponImages = new Set(Array.isArray(window.WEAPON_IMAGES) ? window.WEAPON_IMAGES : []);
      const i18nState = {
        locale: "zh-CN",
        t: (key, params) => {
          if (!params) return key;
          return String(key || "").replace(/\{(\w+)\}/g, (match, name) =>
            Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
          );
        },
        tTerm: (category, value) => value,
      };
      const finishPreload = () => {
        try {
          if (typeof window !== "undefined" && typeof window.__finishPreload === "function") {
            window.__finishPreload();
          }
        } catch (error) {
          // ignore
        }
      };

      const S1_ORDER = ["敏捷提升", "力量提升", "意志提升", "智识提升", "主能力提升"];

      const normalizeText = (value) => (value || "").toString().trim().toLowerCase();

      const allSame = (values) => values.length > 0 && values.every((value) => value === values[0]);

      const countBy = (values) =>
        values.reduce((acc, value) => {
          if (!value || value === "任意") return acc;
          acc[value] = (acc[value] || 0) + 1;
          return acc;
        }, {});

      const formatS1 = (value) => {
        if (!value || value === "任意") return i18nState.t("任意");
        return i18nState.tTerm("s1", value);
      };

      const getS1OrderIndex = (value) => {
        const index = S1_ORDER.indexOf(value);
        return index === -1 ? 99 : index;
      };

      const compareText = (a, b) => (a || "").localeCompare(b || "", "zh-Hans-CN");

      const getBaseAttrSorter = (secondaryKey, tertiaryKey, selectedSet) => (a, b) => {
        const baseDiff = getS1OrderIndex(a.s1) - getS1OrderIndex(b.s1);
        if (baseDiff !== 0) return baseDiff;
        if (selectedSet) {
          const selectedDiff =
            (selectedSet.has(b.name) ? 1 : 0) - (selectedSet.has(a.name) ? 1 : 0);
          if (selectedDiff !== 0) return selectedDiff;
        }
        const secondaryDiff = compareText(a[secondaryKey], b[secondaryKey]);
        if (secondaryDiff !== 0) return secondaryDiff;
        if (tertiaryKey) {
          const tertiaryDiff = compareText(a[tertiaryKey], b[tertiaryKey]);
          if (tertiaryDiff !== 0) return tertiaryDiff;
        }
        if (b.rarity !== a.rarity) return b.rarity - a.rarity;
        return compareText(a.name, b.name);
      };

      const getSchemeWeaponSorter = (lockType, selectedSet) => {
        const secondaryKey = lockType === "s2" ? "s3" : "s2";
        return getBaseAttrSorter(secondaryKey, null, selectedSet);
      };

      const getConflictInfo = (weapon, dungeon, lockOption) => {
        const reasons = [];
        let conflictS2 = false;
        let conflictS3 = false;

        if (lockOption.type === "s2") {
          if (weapon.s2 !== lockOption.value) {
            conflictS2 = true;
            reasons.push(
              i18nState.t("附加属性需为 {value}", {
                value: i18nState.tTerm("s2", lockOption.value),
              })
            );
          }
          if (!dungeon.s3_pool.includes(weapon.s3)) {
            conflictS3 = true;
            reasons.push(
              i18nState.t("方案地区（{name}）不产出该技能属性", {
                name: i18nState.tTerm("dungeon", dungeon.name),
              })
            );
          }
        } else {
          if (weapon.s3 !== lockOption.value) {
            conflictS3 = true;
            reasons.push(
              i18nState.t("技能属性需为 {value}", {
                value: i18nState.tTerm("s3", lockOption.value),
              })
            );
          }
          if (!dungeon.s2_pool.includes(weapon.s2)) {
            conflictS2 = true;
            reasons.push(
              i18nState.t("方案地区（{name}）不产出该附加属性", {
                name: i18nState.tTerm("dungeon", dungeon.name),
              })
            );
          }
        }

        return {
          conflictS2,
          conflictS3,
          conflictReason: reasons.length
            ? reasons.join("；")
            : i18nState.t("与当前方案属性不兼容"),
        };
      };

      const isWeaponCompatible = (weapon, dungeon, lockOption) => {
        if (lockOption.type === "s2") {
          return (
            weapon.s2 === lockOption.value &&
            dungeon.s2_pool.includes(lockOption.value) &&
            dungeon.s3_pool.includes(weapon.s3)
          );
        }
        return (
          weapon.s3 === lockOption.value &&
          dungeon.s3_pool.includes(lockOption.value) &&
          dungeon.s2_pool.includes(weapon.s2)
        );
      };

      const { createApp, ref, computed, onMounted, onBeforeUnmount, watch, nextTick } = Vue || {};

      if (!createApp) {
        finishPreload();
        document.body.innerHTML =
          "<div style='padding:24px;color:#f36c6c;font-family:Microsoft YaHei UI;'>未找到 Vue 3 本地文件：请将 vue.global.prod.js 放入 ./vendor/</div>";
      } else if (!dungeons.length || !weapons.length) {
        finishPreload();
        document.body.innerHTML =
          "<div style='padding:24px;color:#f36c6c;font-family:Microsoft YaHei UI;'>缺少数据文件：请确认 ./data/dungeons.js 与 ./data/weapons.js</div>";
      } else {
        createApp({
            setup() {
              const searchQuery = ref("");
              const selectedNames = ref([]);
              const schemeBaseSelections = ref({});
              const weaponMarks = ref({});
              const showAbout = ref(false);
              const showSecondaryMenu = ref(false);
              const marksStorageKey = "weapon-marks:v1";
              const legacyExcludedKey = "excluded-notes:v1";
              const tutorialStorageKey = "planner-tutorial:v1";
              const uiStateStorageKey = "planner-ui-state:v1";
              const noticeSkipKey = "announcement:skip";
              const legacyNoticePrefix = "announcement:skip:";
              const perfModeStorageKey = "planner-perf-mode:v1";
              const langStorageKey = "planner-lang";
              const i18n = window.I18N || {};
              const fallbackLocale = "zh-CN";
              const supportedLocales = ["zh-CN", "zh-TW", "en", "ja"].filter(
                (locale) => i18n && i18n[locale]
              );
              if (!supportedLocales.length) supportedLocales.push(fallbackLocale);
              const normalizeLocale = (value) =>
                supportedLocales.includes(value) ? value : fallbackLocale;
              const detectLocale = () => {
                if (typeof window === "undefined") return fallbackLocale;
                const stored = localStorage.getItem(langStorageKey);
                if (stored && supportedLocales.includes(stored)) return stored;
                const raw = (navigator.language || "").toLowerCase();
                if (raw.startsWith("zh")) {
                  if (raw.includes("tw") || raw.includes("hk") || raw.includes("mo") || raw.includes("hant")) {
                    return normalizeLocale("zh-TW");
                  }
                  return normalizeLocale("zh-CN");
                }
                if (raw.startsWith("ja")) return normalizeLocale("ja");
                return normalizeLocale("en");
              };
              const locale = ref(detectLocale());
              const localeLabels = {
                "zh-CN": "简体中文",
                "zh-TW": "繁體中文",
                en: "English",
                ja: "日本語",
              };
              const languageOptions = supportedLocales.map((value) => ({
                value,
                label: localeLabels[value] || value,
              }));
              const langSwitchRef = ref(null);
              const showLangMenu = ref(false);
              const langMenuPlacement = ref("right");
              const updateLangMenuPlacement = () => {
                if (typeof window === "undefined") return;
                const container = langSwitchRef.value;
                if (!container) return;
                const menu = container.querySelector(".lang-menu");
                const button = container.querySelector(".lang-button");
                if (!menu || !button) return;
                const menuWidth = menu.offsetWidth || 0;
                const viewportWidth =
                  window.innerWidth ||
                  (document.documentElement && document.documentElement.clientWidth) ||
                  0;
                if (!viewportWidth || !menuWidth) return;
                const margin = 8;
                const buttonRect = button.getBoundingClientRect();
                const rightAlignLeft = buttonRect.right - menuWidth;
                const rightAlignRight = buttonRect.right;
                const leftAlignLeft = buttonRect.left;
                const leftAlignRight = buttonRect.left + menuWidth;
                const fitsRight =
                  rightAlignLeft >= margin && rightAlignRight <= viewportWidth - margin;
                const fitsLeft =
                  leftAlignLeft >= margin && leftAlignRight <= viewportWidth - margin;
                if (!fitsRight && fitsLeft) {
                  langMenuPlacement.value = "left";
                  return;
                }
                if (!fitsLeft && fitsRight) {
                  langMenuPlacement.value = "right";
                  return;
                }
                if (!fitsLeft && !fitsRight) {
                  const spaceRight = viewportWidth - buttonRect.left;
                  const spaceLeft = buttonRect.right;
                  langMenuPlacement.value = spaceRight >= spaceLeft ? "left" : "right";
                  return;
                }
                langMenuPlacement.value = "right";
              };
              const toggleLangMenu = () => {
                showSecondaryMenu.value = false;
                showLangMenu.value = !showLangMenu.value;
                if (showLangMenu.value) {
                  if (typeof nextTick === "function") {
                    nextTick(updateLangMenuPlacement);
                  } else {
                    updateLangMenuPlacement();
                  }
                }
              };
              const setLocale = (value) => {
                locale.value = value;
                showLangMenu.value = false;
              };
              const closeLangMenu = () => {
                showLangMenu.value = false;
              };
              const getStrings = (targetLocale) =>
                (i18n[targetLocale] && i18n[targetLocale].strings) || {};
              const getTerms = (targetLocale) =>
                (i18n[targetLocale] && i18n[targetLocale].terms) || {};
              const interpolate = (text, params) => {
                if (!params) return text;
                return String(text).replace(/\{(\w+)\}/g, (match, name) =>
                  Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
                );
              };
              const t = (key, params) => {
                const strings = getStrings(locale.value);
                const fallbackStrings = getStrings(fallbackLocale);
                const raw =
                  Object.prototype.hasOwnProperty.call(strings, key)
                    ? strings[key]
                    : Object.prototype.hasOwnProperty.call(fallbackStrings, key)
                    ? fallbackStrings[key]
                    : key;
                return interpolate(raw, params);
              };
              const tTerm = (category, value) => {
                if (!value) return value;
                const terms = getTerms(locale.value);
                const fallbackTerms = getTerms(fallbackLocale);
                const table = terms && terms[category] ? terms[category] : {};
                const fallbackTable =
                  fallbackTerms && fallbackTerms[category] ? fallbackTerms[category] : {};
                return table[value] || fallbackTable[value] || value;
              };
              i18nState.t = t;
              i18nState.tTerm = tTerm;
              i18nState.locale = locale.value;
              const content = window.CONTENT || {};
              const sponsorEntries = Array.isArray(window.SPONSORS) ? window.SPONSORS : [];
              const normalizeSponsorList = (list) => {
                if (!Array.isArray(list)) return [];
                return list
                  .map((entry) => {
                    if (!entry) return null;
                    if (typeof entry === "string") return { name: entry };
                    if (typeof entry === "object") {
                      const name = entry.name || entry.title || entry.label;
                      if (!name) return null;
                      return {
                        name,
                        amount: entry.amount || entry.money || "",
                        note: entry.note || entry.message || "",
                        date: entry.date || "",
                      };
                    }
                    return null;
                  })
                  .filter(Boolean);
              };
              const lowGpuEnabled = ref(false);
              const perfPreference = ref("auto");
              const showPerfNotice = ref(false);
              const perfAutoCooldownMs = 2500;
              let perfAutoBlockedUntil = 0;
              const showAiNotice = computed(() => locale.value !== "zh-CN");
              const updateMeta = () => {
                if (typeof document === "undefined") return;
                const title = t("终末地基质规划器 (Endfield Essence Planner)");
                const description = t(
                  "终末地基质规划器：根据附加/技能属性池与锁定规则，自动计算多武器共刷方案，提供基础属性冲突提示与可刷数量参考，适配移动端。"
                );
                document.title = title;
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) metaDesc.setAttribute("content", description);
                const ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle) ogTitle.setAttribute("content", title);
                const ogDesc = document.querySelector('meta[property="og:description"]');
                if (ogDesc) ogDesc.setAttribute("content", description);
                const ogSiteName = document.querySelector('meta[property="og:site_name"]');
                if (ogSiteName) ogSiteName.setAttribute("content", t("终末地基质规划器"));
              };
              const updatePreloadText = () => {
                if (typeof document === "undefined") return;
                const overlay = document.getElementById("app-preload");
                if (!overlay) return;
                const title = overlay.querySelector(".preload-title");
                const sub = overlay.querySelector(".preload-sub");
                if (title) title.textContent = t("少女祈祷中");
                if (sub) sub.textContent = t("首次打开或强制刷新可能稍慢");
              };
              watch(
                locale,
                (value) => {
                  i18nState.locale = value;
                  if (typeof document !== "undefined") {
                    document.documentElement.lang = value;
                  }
                  try {
                    localStorage.setItem(langStorageKey, value);
                  } catch (error) {
                    // ignore storage errors
                  }
                  updateMeta();
                  updatePreloadText();
                },
                { immediate: true }
              );
              const getContentForLocale = (targetLocale) => {
                const base = {
                  announcement: content.announcement || {},
                  changelog: content.changelog || {},
                  about: content.about || {},
                };
                if (!content.locales || targetLocale === fallbackLocale) return base;
                const localized = content.locales[targetLocale] || {};
                return {
                  announcement: { ...base.announcement, ...(localized.announcement || {}) },
                  changelog: { ...base.changelog, ...(localized.changelog || {}) },
                  about: { ...base.about, ...(localized.about || {}) },
                };
              };
              const localizedContent = computed(() => getContentForLocale(locale.value));
              const defaultAnnouncement = computed(() => ({
                version: "",
                title: t("公告"),
                date: "",
                qqGroup: "",
                qqNote: "",
                items: [],
              }));
              const announcement = computed(() => ({
                ...defaultAnnouncement.value,
                ...(localizedContent.value.announcement || {}),
              }));
              const defaultChangelog = computed(() => ({
                title: t("更新日志"),
                entries: [],
              }));
              const changelog = computed(() => ({
                ...defaultChangelog.value,
                ...(localizedContent.value.changelog || {}),
              }));
              const defaultAbout = computed(() => ({
                title: t("关于本工具"),
                paragraphs: [],
                author: "",
                links: [],
                thanks: [],
              }));
              const aboutContent = computed(() => {
                const base = {
                  ...defaultAbout.value,
                  ...(localizedContent.value.about || {}),
                };
                const list = normalizeSponsorList(
                  (base.sponsor && base.sponsor.list) || sponsorEntries
                );
                if (list.length) {
                  base.sponsor = { ...(base.sponsor || {}), list };
                }
                return base;
              });
              const showNotice = ref(false);
              const showChangelog = ref(false);
              const skipNotice = ref(false);
              const appReady = ref(false);
              const mobilePanel = ref("weapons");
              const showWeaponAttrs = ref(false);
              const showFilterPanel = ref(true);
              const showAllSchemes = ref(false);
              const conflictOpenMap = ref({});
              const showBackToTop = ref(false);
              const backToTopRevealOffset = 240;
              const backToTopScrollDelta = 6;
              const backToTopIdleDelay = 200;
              let backToTopLastScroll = 0;
              let backToTopTimer = null;
              const tutorialVersion = "1.0.0";
              const tutorialActive = ref(false);
              const tutorialStepIndex = ref(0);
              const tutorialSkippedVersion = ref("");
              const tutorialCompletedVersion = ref("");
              const showTutorialSkipConfirm = ref(false);
              const showTutorialComplete = ref(false);
              const tutorialSkipAll = computed({
                get: () => tutorialSkippedVersion.value === tutorialVersion,
                set: (value) => {
                  tutorialSkippedVersion.value = value ? tutorialVersion : "";
                },
              });
              const tutorialCompleted = computed(
                () => tutorialCompletedVersion.value === tutorialVersion
              );
              const filterS1 = ref([]);
              const filterS2 = ref([]);
              const filterS3 = ref([]);
              let tutorialAutoStartPending = true;
              let tutorialAdvanceTimer = null;
              let tutorialScrollTimer = null;
              const tutorialWeaponTarget = ref(null);
              const tutorialSchemeTarget = ref(null);
              const tutorialPlansTab = ref(null);
              const tutorialBodyCollapsed = ref(false);
              const tutorialCollapseHighlight = ref(false);
              const tutorialCollapseHighlightSeen = ref(false);
              const tutorialManualAdvanceHoldIndex = ref(-1);
              const isPortrait = ref(false);
              let viewportSafeBottomRaf = null;

              const updateViewportOrientation = () => {
                if (typeof window === "undefined") return;
                if (window.matchMedia) {
                  isPortrait.value = window.matchMedia("(orientation: portrait)").matches;
                } else {
                  isPortrait.value = window.innerHeight >= window.innerWidth;
                }
                if (showLangMenu.value) {
                  if (typeof nextTick === "function") {
                    nextTick(updateLangMenuPlacement);
                  } else {
                    updateLangMenuPlacement();
                  }
                }
              };

              updateViewportOrientation();

              const updateViewportSafeBottom = () => {
                if (typeof window === "undefined") return;
                const root = document.documentElement;
                if (!root) return;
                const viewport = window.visualViewport;
                if (!viewport) {
                  root.style.removeProperty("--viewport-safe-bottom");
                  return;
                }
                const blocked = Math.max(
                  0,
                  Math.round(window.innerHeight - (viewport.height + viewport.offsetTop))
                );
                root.style.setProperty("--viewport-safe-bottom", `${blocked}px`);
              };

              const scheduleViewportSafeBottom = () => {
                if (viewportSafeBottomRaf) return;
                viewportSafeBottomRaf = requestAnimationFrame(() => {
                  viewportSafeBottomRaf = null;
                  updateViewportSafeBottom();
                });
              };

              const clearBackToTopTimer = () => {
                if (backToTopTimer) {
                  clearTimeout(backToTopTimer);
                  backToTopTimer = null;
                }
              };

              const updateBackToTopVisibility = () => {
                if (typeof window === "undefined") return;
                const current = window.scrollY || window.pageYOffset || 0;
                const delta = current - backToTopLastScroll;
                if (current < backToTopRevealOffset) {
                  showBackToTop.value = false;
                } else if (delta > backToTopScrollDelta) {
                  showBackToTop.value = false;
                } else if (delta < -backToTopScrollDelta) {
                  showBackToTop.value = true;
                }
                backToTopLastScroll = current;
                clearBackToTopTimer();
                backToTopTimer = setTimeout(() => {
                  const position = window.scrollY || window.pageYOffset || 0;
                  if (position >= backToTopRevealOffset) {
                    showBackToTop.value = true;
                  }
                }, backToTopIdleDelay);
              };

              const handleBackToTopScroll = () => {
                updateBackToTopVisibility();
              };

              const scrollToTop = () => {
                if (typeof window === "undefined") return;
                if (typeof window.scrollTo === "function") {
                  try {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                  } catch (error) {
                    // ignore and fall back
                  }
                }
                window.scrollTo(0, 0);
              };

              const tutorialWeapon = {
                name: "教学示例-武器",
                rarity: 5,
                type: "示例类型",
                s1: "力量提升",
                s2: "攻击提升",
                s3: "压制",
              };
              const tutorialExcluded = ref(false);
              const tutorialNote = ref("");
              const tutorialNoteTouched = ref(false);
              const tutorialTargetWeaponName = "沧溟星梦";
              const tutorialTargetDungeonId = "energy";
              const tutorialTargetLockType = "s3";
              const tutorialTargetLockValue = "附术";
              const tutorialGuideWeaponNames = new Set(["白夜新星", "宏愿"]);
              const tutorialRequiredBaseKeys = ["主能力提升", "敏捷提升"];
              const tutorialManualBack = ref(false);
              const isTutorialGuideWeapon = (name) => tutorialGuideWeaponNames.has(name);
              const tutorialTargetDungeon = dungeons.find(
                (dungeon) => dungeon && dungeon.id === tutorialTargetDungeonId
              );
              const tutorialTargetDungeonName = tutorialTargetDungeon
                ? tutorialTargetDungeon.name
                : "";

              const tutorialSteps = computed(() => {
                const targetWeapon = tTerm("weapon", tutorialTargetWeaponName);
                const targetWeaponS1 = tTerm("s1", "智识提升");
                const targetDungeon = tTerm("dungeon", tutorialTargetDungeonName);
                const guideWeaponA = tTerm("weapon", "白夜新星");
                const guideWeaponAS1 = tTerm("s1", "主能力提升");
                const guideWeaponB = tTerm("weapon", "宏愿");
                const guideWeaponBS1 = tTerm("s1", "敏捷提升");
                return [
                  {
                    key: "show-attrs",
                    title: t("查看属性 / 排除 / 备注"),
                    body: [
                      t("点击“{label}”按钮，切换到属性视图。", {
                        label: t("显示属性/排除/备注管理"),
                      }),
                      t("切换后会出现一把教学示例武器，接下来按提示操作即可。"),
                    ],
                  },
                  {
                    key: "exclude",
                    title: t("排除武器"),
                    body: [
                      t("对教学示例武器点击“{label}”。", { label: t("标记排除") }),
                      t("被排除的武器不会参与方案计算。"),
                    ],
                  },
                  {
                    key: "note",
                    title: t("添加备注"),
                    body: [
                      t("可为任意武器添加备注（不强制）"),
                      t("例如已毕业。"),
                      t("此步不会自动跳转，请手动点击{label}。", { label: t("下一步") }),
                    ],
                  },
                  {
                    key: "base-pick",
                    title: t("基础属性选择"),
                    body: [
                      t("已自动选中“{weapon}（{s1}）”，并定位到“{dungeon}”。", {
                        weapon: targetWeapon,
                        s1: targetWeaponS1,
                        dungeon: targetDungeon,
                      }),
                      t("部分情况下会出现“最高可刷数量”大于“可同时刷数量”。"),
                      t("在该方案中最多可刷 {max} 把，但最多只能同时刷 {simul} 把。", {
                        max: 7,
                        simul: 6,
                      }),
                      t("由于基础属性有 {total} 种，但是只能锁定 {lock} 种。", {
                        total: 4,
                        lock: 3,
                      }),
                      t(
                        "因此需要手动选择两种属性(当前已选中“{weapon}（{s1}）”,所以会自动选择一个属性为 {s1} 且无法取消)。",
                        {
                          weapon: targetWeapon,
                          s1: targetWeaponS1,
                        }
                      ),
                      t("请点击“{weaponA}（{s1A}）”与“{weaponB}（{s1B}）” 选择两种属性。", {
                        weaponA: guideWeaponA,
                        s1A: guideWeaponAS1,
                        weaponB: guideWeaponB,
                        s1B: guideWeaponBS1,
                      }),
                    ],
                  },
                ];
              });
              const tutorialTotalSteps = computed(() => tutorialSteps.value.length);
              const tutorialStep = computed(
                () => tutorialSteps.value[tutorialStepIndex.value] || tutorialSteps.value[0]
              );
              const tutorialStepKey = computed(() => tutorialStep.value.key);
              const tutorialStepLines = computed(() => {
                const step = tutorialStep.value || {};
                const lines = Array.isArray(step.body) ? step.body.slice() : [];
                if (step.key === "base-pick" && isPortrait.value) {
                  lines.unshift(
                    t("竖屏时请先点击上方“{label}”标签进入方案列表。", {
                      label: t("方案推荐"),
                    })
                  );
                }
                return lines;
              });
              const tutorialBodyCanCollapse = computed(
                () => tutorialStepKey.value === "base-pick" && tutorialStepLines.value.length > 2
              );
              const tutorialVisibleLines = computed(() => {
                const lines = tutorialStepLines.value;
                if (!tutorialBodyCanCollapse.value || !tutorialBodyCollapsed.value) {
                  return lines;
                }
                return lines.slice(0, 2);
              });

              const sanitizeArray = (value) => (Array.isArray(value) ? value : []);
              const weaponNameSet = new Set(weapons.map((weapon) => weapon.name));
              const s1Set = new Set(weapons.map((weapon) => weapon.s1).filter(Boolean));
              const s2Set = new Set(weapons.map((weapon) => weapon.s2).filter(Boolean));
              const s3Set = new Set(weapons.map((weapon) => weapon.s3).filter(Boolean));
              const mobilePanels = new Set(["weapons", "plans"]);

              const sanitizeState = (raw) => {
                if (!raw || typeof raw !== "object") return null;
                const next = {};
                if (typeof raw.searchQuery === "string") {
                  next.searchQuery = raw.searchQuery;
                }
                if (Array.isArray(raw.selectedNames)) {
                  const unique = Array.from(new Set(raw.selectedNames));
                  next.selectedNames = unique.filter((name) => weaponNameSet.has(name));
                }
                if (raw.schemeBaseSelections && typeof raw.schemeBaseSelections === "object") {
                  const cleaned = {};
                  Object.keys(raw.schemeBaseSelections).forEach((key) => {
                    const values = sanitizeArray(raw.schemeBaseSelections[key]).filter((value) =>
                      s1Set.has(value)
                    );
                    if (values.length) {
                      cleaned[key] = Array.from(new Set(values));
                    }
                  });
                  next.schemeBaseSelections = cleaned;
                }
                if (typeof raw.showWeaponAttrs === "boolean") {
                  next.showWeaponAttrs = raw.showWeaponAttrs;
                }
                if (typeof raw.showFilterPanel === "boolean") {
                  next.showFilterPanel = raw.showFilterPanel;
                }
                if (typeof raw.showAllSchemes === "boolean") {
                  next.showAllSchemes = raw.showAllSchemes;
                }
                if (mobilePanels.has(raw.mobilePanel)) {
                  next.mobilePanel = raw.mobilePanel;
                }
                const s1Filter = Array.from(
                  new Set(sanitizeArray(raw.filterS1).filter((value) => s1Set.has(value)))
                );
                const s2Filter = Array.from(
                  new Set(sanitizeArray(raw.filterS2).filter((value) => s2Set.has(value)))
                );
                const s3Filter = Array.from(
                  new Set(sanitizeArray(raw.filterS3).filter((value) => s3Set.has(value)))
                );
                if (s1Filter.length) next.filterS1 = s1Filter;
                if (s2Filter.length) next.filterS2 = s2Filter;
                if (s3Filter.length) next.filterS3 = s3Filter;
                return next;
              };

              let restoredShowFilterPanel = false;
              const shouldCollapseFilterPanelByDefault = () => {
                if (typeof window === "undefined") return false;
                return isPortrait.value || window.innerWidth <= 640;
              };

              try {
                const storedState = localStorage.getItem(uiStateStorageKey);
                if (storedState) {
                  const parsed = JSON.parse(storedState);
                  const restored = sanitizeState(parsed);
                  if (restored) {
                    if (typeof restored.searchQuery === "string") {
                      searchQuery.value = restored.searchQuery;
                    }
                    if (restored.selectedNames) {
                      selectedNames.value = restored.selectedNames;
                    }
                    if (restored.schemeBaseSelections) {
                      schemeBaseSelections.value = restored.schemeBaseSelections;
                    }
                    if (typeof restored.showWeaponAttrs === "boolean") {
                      showWeaponAttrs.value = restored.showWeaponAttrs;
                    }
                    if (typeof restored.showFilterPanel === "boolean") {
                      showFilterPanel.value = restored.showFilterPanel;
                      restoredShowFilterPanel = true;
                    }
                    if (typeof restored.showAllSchemes === "boolean") {
                      showAllSchemes.value = restored.showAllSchemes;
                    }
                    if (restored.mobilePanel) {
                      mobilePanel.value = restored.mobilePanel;
                    }
                    if (restored.filterS1) filterS1.value = restored.filterS1;
                    if (restored.filterS2) filterS2.value = restored.filterS2;
                    if (restored.filterS3) filterS3.value = restored.filterS3;
                  }
                }
              } catch (error) {
                // ignore storage errors
              }
              if (!restoredShowFilterPanel && shouldCollapseFilterPanelByDefault()) {
                showFilterPanel.value = false;
              }

              try {
                const storedTutorial = localStorage.getItem(tutorialStorageKey);
                if (storedTutorial) {
                  const parsed = JSON.parse(storedTutorial);
                  if (parsed && typeof parsed === "object") {
                    if (typeof parsed.skipVersion === "string") {
                      tutorialSkippedVersion.value = parsed.skipVersion;
                    } else if (parsed.skipAll) {
                      tutorialSkippedVersion.value = tutorialVersion;
                    }
                    if (typeof parsed.completedVersion === "string") {
                      tutorialCompletedVersion.value = parsed.completedVersion;
                    } else if (parsed.completed) {
                      tutorialCompletedVersion.value = tutorialVersion;
                    }
                  }
                }
              } catch (error) {
                // ignore storage errors
              }

              const sanitizeMarks = (raw) => {
                if (!raw || typeof raw !== "object") return {};
                const normalized = {};
                Object.keys(raw).forEach((name) => {
                  const mark = raw[name];
                  if (!name) return;
                  if (mark && typeof mark === "object") {
                    const excluded = Boolean(mark.excluded);
                    const note = typeof mark.note === "string" ? mark.note : "";
                    if (excluded || note) {
                      normalized[name] = { excluded, note };
                    }
                  } else if (typeof mark === "string") {
                    if (mark) {
                      normalized[name] = { excluded: false, note: mark };
                    }
                  }
                });
                return normalized;
              };

              try {
                const stored = localStorage.getItem(marksStorageKey);
                if (stored) {
                  const parsed = JSON.parse(stored);
                  weaponMarks.value = sanitizeMarks(parsed);
                }
              } catch (error) {
                // ignore storage errors
              }

              if (!Object.keys(weaponMarks.value).length) {
                try {
                  const legacy = localStorage.getItem(legacyExcludedKey);
                  if (legacy) {
                    const parsed = JSON.parse(legacy);
                    if (parsed && typeof parsed === "object") {
                      const migrated = {};
                      Object.keys(parsed).forEach((name) => {
                        const note = typeof parsed[name] === "string" ? parsed[name] : "";
                        migrated[name] = { excluded: true, note };
                      });
                      weaponMarks.value = sanitizeMarks(migrated);
                      localStorage.removeItem(legacyExcludedKey);
                      localStorage.setItem(
                        marksStorageKey,
                        JSON.stringify(weaponMarks.value)
                      );
                    }
                  }
                } catch (error) {
                  // ignore storage errors
                }
              }
            const currentHost = ref(window.location.hostname);
            const allowedHosts = new Set(["end.canmoe.com", "127.0.0.1", "localhost"]);
            const embedAllowedHosts = new Set(
              Array.isArray(content.embed?.allowedHosts) ? content.embed.allowedHosts : []
            );
            let embedded = false;
            try {
              embedded = window.self !== window.top;
            } catch (error) {
              embedded = true;
            }
            const isEmbedded = ref(embedded);
            const embedHost = ref("");
            const embedHostLabel = ref("");
            const isEmbedTrusted = ref(false);
            const isCurrentHostTrusted = allowedHosts.has(currentHost.value);
            if (isEmbedded.value) {
              let embedOrigin = "";
              if (window.location.ancestorOrigins && window.location.ancestorOrigins.length) {
                embedOrigin = window.location.ancestorOrigins[0];
              } else if (document.referrer) {
                embedOrigin = document.referrer;
              } else {
                try {
                  embedOrigin = window.top.location.href;
                } catch (error) {
                  embedOrigin = "";
                }
              }
              if (embedOrigin) {
                try {
                  embedHost.value = new URL(embedOrigin).hostname;
                } catch (error) {
                  embedHost.value = "";
                }
              }
              embedHostLabel.value = embedHost.value || t("未知来源");
              isEmbedTrusted.value =
                embedHost.value && embedAllowedHosts.size
                  ? embedAllowedHosts.has(embedHost.value)
                  : false;
            }
            const showDomainWarning = ref(
              isEmbedded.value
                ? !(isCurrentHostTrusted && isEmbedTrusted.value)
                : !isCurrentHostTrusted
            );
            const warningCountdown = ref(10);
            let warningTimer = null;

            const startWarningCountdown = () => {
              if (warningTimer || isEmbedded.value || !showDomainWarning.value) return;
              warningTimer = setInterval(() => {
                if (warningCountdown.value > 0) {
                  warningCountdown.value -= 1;
                }
                if (warningCountdown.value <= 0) {
                  warningCountdown.value = 0;
                  clearInterval(warningTimer);
                  warningTimer = null;
                }
              }, 1000);
            };

            const dismissDomainWarning = () => {
              if (isEmbedded.value || warningCountdown.value > 0) return;
              showDomainWarning.value = false;
            };

            if (!isEmbedded.value && showDomainWarning.value) {
              startWarningCountdown();
            }

            const readNoticeSkipVersion = () => {
              try {
                return localStorage.getItem(noticeSkipKey) || "";
              } catch (error) {
                return "";
              }
            };

            const writeNoticeSkipVersion = (version) => {
              try {
                if (version) {
                  localStorage.setItem(noticeSkipKey, version);
                } else {
                  localStorage.removeItem(noticeSkipKey);
                }
              } catch (error) {
                // ignore storage errors
              }
            };

            const cleanupLegacyNoticeKeys = () => {
              try {
                const keys = [];
                for (let i = 0; i < localStorage.length; i += 1) {
                  const key = localStorage.key(i);
                  if (key && key.startsWith(legacyNoticePrefix)) {
                    keys.push(key);
                  }
                }
                keys.forEach((key) => localStorage.removeItem(key));
              } catch (error) {
                // ignore storage errors
              }
            };

            const applyLowGpuMode = (enabled) => {
              lowGpuEnabled.value = enabled;
              document.documentElement.classList.toggle("low-gpu", enabled);
            };

            const readPerfMode = () => {
              try {
                const value = localStorage.getItem(perfModeStorageKey) || "";
                return value === "off" ? "standard" : value;
              } catch (error) {
                return "";
              }
            };

            const writePerfMode = (value) => {
              try {
                if (value) {
                  localStorage.setItem(perfModeStorageKey, value);
                } else {
                  localStorage.removeItem(perfModeStorageKey);
                }
              } catch (error) {
                // ignore storage errors
              }
            };

            let perfProbeRunning = false;
            let perfLagTimer = null;
            let perfLagTimeout = null;
            let longTaskObserver = null;

            const blockAutoSwitch = (durationMs) => {
              perfAutoBlockedUntil = Math.max(
                perfAutoBlockedUntil,
                performance.now() + (durationMs || 0)
              );
            };

            const canAutoSwitch = () => {
              if (document.visibilityState && document.visibilityState !== "visible") {
                return false;
              }
              return performance.now() >= perfAutoBlockedUntil;
            };

            const autoSwitchToLowGpu = () => {
              if (perfPreference.value !== "auto" || lowGpuEnabled.value) return;
              if (!canAutoSwitch()) return;
              applyLowGpuMode(true);
              showPerfNotice.value = true;
            };

            const stopAutoMonitors = () => {
              if (perfLagTimer) {
                clearInterval(perfLagTimer);
                perfLagTimer = null;
              }
              if (perfLagTimeout) {
                clearTimeout(perfLagTimeout);
                perfLagTimeout = null;
              }
              if (longTaskObserver) {
                longTaskObserver.disconnect();
                longTaskObserver = null;
              }
            };

            const startPerfProbe = (durationMs = 1200) => {
              if (perfProbeRunning || perfPreference.value !== "auto") return;
              perfProbeRunning = true;
              let frames = 0;
              let total = 0;
              let last = performance.now();
              const start = last;
              const step = (now) => {
                total += now - last;
                frames += 1;
                last = now;
                if (now - start < durationMs) {
                  requestAnimationFrame(step);
                  return;
                }
                perfProbeRunning = false;
                const avg = total / Math.max(frames, 1);
                if (avg > 40 && perfPreference.value === "auto") {
                  autoSwitchToLowGpu();
                }
              };
              requestAnimationFrame(step);
            };

            const startLagMonitor = (durationMs = 8000, intervalMs = 200) => {
              if (perfPreference.value !== "auto" || perfLagTimer) return;
              let last = performance.now();
              perfLagTimer = setInterval(() => {
                const now = performance.now();
                const lag = Math.max(0, now - last - intervalMs);
                last = now;
                if (lag > 120) {
                  autoSwitchToLowGpu();
                }
              }, intervalMs);
              perfLagTimeout = setTimeout(() => {
                if (perfLagTimer) {
                  clearInterval(perfLagTimer);
                  perfLagTimer = null;
                }
                perfLagTimeout = null;
              }, durationMs);
            };

            const startLongTaskObserver = () => {
              if (perfPreference.value !== "auto" || longTaskObserver) return;
              if (typeof PerformanceObserver === "undefined") return;
              try {
                longTaskObserver = new PerformanceObserver((list) => {
                  const entries = list.getEntries();
                  if (entries.some((entry) => entry.duration >= 200)) {
                    autoSwitchToLowGpu();
                    stopAutoMonitors();
                  }
                });
                longTaskObserver.observe({ entryTypes: ["longtask"] });
              } catch (error) {
                longTaskObserver = null;
              }
            };

            const startAutoMonitors = () => {
              if (perfPreference.value !== "auto") return;
              startPerfProbe();
              startLagMonitor();
              startLongTaskObserver();
            };

            const initPerfMode = () => {
              const pref = readPerfMode();
              if (pref === "low") {
                perfPreference.value = "low";
                applyLowGpuMode(true);
                return;
              }
              if (pref === "standard") {
                perfPreference.value = "standard";
                applyLowGpuMode(false);
                return;
              }
              perfPreference.value = "auto";
              blockAutoSwitch(perfAutoCooldownMs);
              startAutoMonitors();
              const onUserActivity = (event) => {
                if (readPerfMode()) {
                  window.removeEventListener("scroll", onUserActivity);
                  window.removeEventListener("wheel", onUserActivity);
                  window.removeEventListener("pointerdown", onUserActivity);
                  window.removeEventListener("keydown", onUserActivity);
                  window.removeEventListener("touchstart", onUserActivity);
                  return;
                }
                if (event && typeof event.timeStamp === "number") {
                  const delay = performance.now() - event.timeStamp;
                  if (delay > 150 && delay < 60000) {
                    autoSwitchToLowGpu();
                  }
                }
                startAutoMonitors();
              };
              window.addEventListener("scroll", onUserActivity, { passive: true });
              window.addEventListener("wheel", onUserActivity, { passive: true });
              window.addEventListener("pointerdown", onUserActivity);
              window.addEventListener("keydown", onUserActivity);
              window.addEventListener("touchstart", onUserActivity, { passive: true });
            };

            const setPerfMode = (mode) => {
              perfPreference.value = mode;
              showPerfNotice.value = false;
              if (mode === "low") {
                applyLowGpuMode(true);
                writePerfMode("low");
                stopAutoMonitors();
                return;
              }
              if (mode === "standard") {
                applyLowGpuMode(false);
                writePerfMode("standard");
                stopAutoMonitors();
                return;
              }
              writePerfMode("");
              applyLowGpuMode(false);
              stopAutoMonitors();
              blockAutoSwitch(perfAutoCooldownMs);
              startAutoMonitors();
            };

            const handleDocClick = (event) => {
              if (!event || !event.target || !event.target.closest) {
                showSecondaryMenu.value = false;
                showLangMenu.value = false;
                return;
              }
              if (showSecondaryMenu.value && !event.target.closest(".secondary-menu")) {
                showSecondaryMenu.value = false;
              }
              if (showLangMenu.value && !event.target.closest(".lang-switch")) {
                showLangMenu.value = false;
              }
            };

            const handleDocKeydown = (event) => {
              if (!event) return;
              if (event.key === "Escape") {
                showSecondaryMenu.value = false;
                showLangMenu.value = false;
              }
            };

            onMounted(() => {
              appReady.value = true;
              cleanupLegacyNoticeKeys();
              const skippedVersion = readNoticeSkipVersion();
              if (skippedVersion !== announcement.value.version) {
                skipNotice.value = false;
                showNotice.value = true;
              }
              initPerfMode();
              updateViewportOrientation();
              window.addEventListener("resize", updateViewportOrientation);
              updateViewportSafeBottom();
              window.addEventListener("resize", scheduleViewportSafeBottom);
              if (window.visualViewport) {
                window.visualViewport.addEventListener("resize", scheduleViewportSafeBottom);
                window.visualViewport.addEventListener("scroll", scheduleViewportSafeBottom);
              }
              if (typeof window !== "undefined") {
                backToTopLastScroll = window.scrollY || window.pageYOffset || 0;
                updateBackToTopVisibility();
                window.addEventListener("scroll", handleBackToTopScroll, { passive: true });
              }
              document.addEventListener("click", handleDocClick);
              document.addEventListener("keydown", handleDocKeydown);
              if (typeof nextTick === "function") {
                nextTick(() => requestAnimationFrame(() => finishPreload()));
              } else {
                requestAnimationFrame(() => finishPreload());
              }
              maybeAutoStartTutorial();
            });

            onBeforeUnmount(() => {
              window.removeEventListener("resize", updateViewportOrientation);
              window.removeEventListener("resize", scheduleViewportSafeBottom);
              if (window.visualViewport) {
                window.visualViewport.removeEventListener("resize", scheduleViewportSafeBottom);
                window.visualViewport.removeEventListener("scroll", scheduleViewportSafeBottom);
              }
              if (viewportSafeBottomRaf) {
                cancelAnimationFrame(viewportSafeBottomRaf);
                viewportSafeBottomRaf = null;
              }
              if (typeof window !== "undefined") {
                window.removeEventListener("scroll", handleBackToTopScroll);
              }
              clearBackToTopTimer();
              document.removeEventListener("click", handleDocClick);
              document.removeEventListener("keydown", handleDocKeydown);
            });

            const openNotice = () => {
              skipNotice.value = readNoticeSkipVersion() === announcement.value.version;
              showNotice.value = true;
            };

            const closeNotice = () => {
              showNotice.value = false;
              if (skipNotice.value) {
                writeNoticeSkipVersion(announcement.value.version);
                return;
              }
              if (readNoticeSkipVersion() === announcement.value.version) {
                writeNoticeSkipVersion("");
              }
            };

              const weaponMap = new Map(weapons.map((weapon) => [weapon.name, weapon]));
              const uniqueSorted = (items, sorter) => {
                const values = Array.from(new Set(items.filter(Boolean)));
                if (sorter) {
                  values.sort(sorter);
                }
                return values;
              };

              const s1Options = computed(() =>
                uniqueSorted(weapons.map((weapon) => weapon.s1), (a, b) => {
                  return getS1OrderIndex(a) - getS1OrderIndex(b);
                })
              );
              const s2Options = computed(() =>
                uniqueSorted(weapons.map((weapon) => weapon.s2), (a, b) => {
                  return a.localeCompare(b, "zh-Hans-CN");
                })
              );
              const s3OptionEntries = computed(() => {
                const weaponValues = weapons.map((weapon) => weapon.s3).filter(Boolean);
                const weaponCounts = countBy(weaponValues);
                const dungeonValues = dungeons.reduce((acc, dungeon) => {
                  if (Array.isArray(dungeon.s3_pool)) {
                    acc.push(...dungeon.s3_pool);
                  }
                  return acc;
                }, []);
                const values = uniqueSorted(
                  [...weaponValues, ...dungeonValues],
                  (a, b) => a.localeCompare(b, "zh-Hans-CN")
                );
                return values.map((value) => ({
                  value,
                  count: weaponCounts[value] || 0,
                  isEmpty: !weaponCounts[value],
                }));
              });

            const excludedNameSet = computed(() => {
              const names = Object.keys(weaponMarks.value || {});
              const excluded = names.filter(
                (name) => weaponMarks.value[name] && weaponMarks.value[name].excluded
              );
              return new Set(excluded);
            });

            const getWeaponMark = (name) =>
              weaponMarks.value && weaponMarks.value[name]
                ? weaponMarks.value[name]
                : { excluded: false, note: "" };

            const isExcluded = (name) => Boolean(getWeaponMark(name).excluded);

            const getWeaponNote = (name) => getWeaponMark(name).note || "";

            const trackEvent = (name, data) => {
              if (typeof window === "undefined") return;
              if (window.umami && typeof window.umami.track === "function") {
                window.umami.track(name, data);
              }
            };

            const toggleExclude = (weapon) => {
              if (!weapon || !weapon.name) return;
              const current = getWeaponMark(weapon.name);
              const nextExcluded = !current.excluded;
              const next = { ...current, excluded: nextExcluded };
              const updated = { ...weaponMarks.value };
              if (!next.excluded && !next.note) {
                delete updated[weapon.name];
              } else {
                updated[weapon.name] = next;
              }
              weaponMarks.value = updated;

              if (nextExcluded) {
                trackEvent("weapon_exclude", { weapon: weapon.name });
              } else {
                trackEvent("weapon_unexclude", { weapon: weapon.name });
              }
            };

            const updateWeaponNote = (weapon, value) => {
              if (!weapon || !weapon.name) return;
              const current = getWeaponMark(weapon.name);
              const next = { ...current, note: value || "" };
              const updated = { ...weaponMarks.value };
              if (!next.excluded && !next.note) {
                delete updated[weapon.name];
              } else {
                updated[weapon.name] = next;
              }
              weaponMarks.value = updated;
            };

            const selectedWeaponRows = computed(() =>
              selectedNames.value
                .map((name) => weaponMap.get(name))
                .filter(Boolean)
                .map((weapon) => ({
                  ...weapon,
                  isExcluded: isExcluded(weapon.name),
                  note: getWeaponNote(weapon.name),
                }))
            );

            const selectedWeapons = computed(() =>
              selectedWeaponRows.value.filter((weapon) => !weapon.isExcluded)
            );

            const selectedNameSet = computed(() => new Set(selectedNames.value));

            const toggleWeapon = (weapon, source = "grid") => {
              if (!weapon || !weapon.name) return;
              const index = selectedNames.value.indexOf(weapon.name);
              const action = index === -1 ? "select" : "deselect";
              if (index === -1) {
                selectedNames.value.push(weapon.name);
              } else {
                selectedNames.value.splice(index, 1);
              }

              trackEvent("weapon_click", {
                weapon: weapon.name,
                action,
                source,
              });
            };

            const toggleShowWeaponAttrs = () => {
              showWeaponAttrs.value = !showWeaponAttrs.value;
            };

            const toggleSchemeBasePick = (scheme, weapon) => {
              if (!scheme || !weapon || !scheme.baseOverflow) return;
              const baseKey = weapon.s1;
              if (!baseKey || baseKey === "任意") return;
              const required = new Set(scheme.requiredBaseKeys || []);
              if (required.has(baseKey)) return;
              const current = new Set(schemeBaseSelections.value[scheme.schemeKey] || []);
              if (current.has(baseKey)) {
                current.delete(baseKey);
              } else {
                current.add(baseKey);
              }
              schemeBaseSelections.value = {
                ...schemeBaseSelections.value,
                [scheme.schemeKey]: Array.from(current),
              };
            };

            const isConflictOpen = (schemeKey) => {
              const map = conflictOpenMap.value || {};
              if (Object.prototype.hasOwnProperty.call(map, schemeKey)) {
                return Boolean(map[schemeKey]);
              }
              return false;
            };

            const toggleConflictOpen = (schemeKey) => {
              const map = conflictOpenMap.value || {};
              conflictOpenMap.value = {
                ...map,
                [schemeKey]: !isConflictOpen(schemeKey),
              };
            };

              const clearSelection = () => {
                selectedNames.value = [];
                schemeBaseSelections.value = {};
              };

              const toggleFilterValue = (group, value) => {
                const target =
                  group === "s1" ? filterS1 : group === "s2" ? filterS2 : filterS3;
                const index = target.value.indexOf(value);
                if (index === -1) {
                  target.value.push(value);
                } else {
                  target.value.splice(index, 1);
                }
              };

              const clearAttributeFilters = () => {
                filterS1.value = [];
                filterS2.value = [];
                filterS3.value = [];
              };

              const hasAttributeFilters = computed(
                () => filterS1.value.length || filterS2.value.length || filterS3.value.length
              );

            const filteredWeapons = computed(() => {
              const query = normalizeText(searchQuery.value);
              const getSearchText = (weapon) =>
                normalizeText(
                  [
                    weapon.name,
                    tTerm("weapon", weapon.name),
                    weapon.short,
                    tTerm("short", weapon.short),
                    weapon.type,
                    Array.isArray(weapon.chars) ? weapon.chars.join(" ") : "",
                    Array.isArray(weapon.chars) ? weapon.chars.map((name) => tTerm("character", name)).join(" ") : "",
                    tTerm("type", weapon.type),
                    weapon.s1,
                    tTerm("s1", weapon.s1),
                    weapon.s2,
                    tTerm("s2", weapon.s2),
                    weapon.s3,
                    tTerm("s3", weapon.s3),
                  ].join(" ")
                );
              return weapons
                .filter((weapon) => {
                  const matchQuery = !query || getSearchText(weapon).includes(query);
                  if (!matchQuery) return false;
                  if (filterS1.value.length && !filterS1.value.includes(weapon.s1)) return false;
                  if (filterS2.value.length && !filterS2.value.includes(weapon.s2)) return false;
                  if (filterS3.value.length && !filterS3.value.includes(weapon.s3)) return false;
                  return true;
                })
                .slice()
                .sort((a, b) => {
                  if (b.rarity !== a.rarity) return b.rarity - a.rarity;
                  return a.name.localeCompare(b.name, "zh-Hans-CN");
                });
            });

            const recommendations = computed(() => {
              const targets = selectedWeapons.value;
              if (!targets.length) return [];

              const lockOptions = [
                ...uniqueSorted(targets.map((weapon) => weapon.s2), (a, b) =>
                  a.localeCompare(b, "zh-Hans-CN")
                ).map((value) => ({
                  type: "s2",
                  label: "附加属性",
                  value,
                })),
                ...uniqueSorted(targets.map((weapon) => weapon.s3), (a, b) =>
                  a.localeCompare(b, "zh-Hans-CN")
                ).map((value) => ({
                  type: "s3",
                  label: "技能属性",
                  value,
                })),
              ];

              if (!lockOptions.length) return [];

              const selectedSet = new Set(selectedNames.value);
              const excludedSet = excludedNameSet.value;
              const schemes = [];

              dungeons.forEach((dungeon) => {
                lockOptions.forEach((option) => {
                  const lockPool = option.type === "s2" ? dungeon.s2_pool : dungeon.s3_pool;
                  if (!lockPool.includes(option.value)) return;

                  const matchedSelected = targets.filter((weapon) =>
                    isWeaponCompatible(weapon, dungeon, option)
                  );
                  if (!matchedSelected.length) return;

                  const schemeKey = `${dungeon.id}-${option.type}-${option.value}`;
                  const selectedSortSet = new Set(targets.map((weapon) => weapon.name));
                  const schemeWeaponSorter = getSchemeWeaponSorter(option.type, selectedSortSet);

                  const schemeWeapons = weapons
                    .filter((weapon) => isWeaponCompatible(weapon, dungeon, option))
                    .slice()
                    .sort(schemeWeaponSorter);

                  const schemeWeaponsActive = schemeWeapons.filter(
                    (weapon) => !excludedSet.has(weapon.name)
                  );

                  const baseCounts = countBy(schemeWeaponsActive.map((weapon) => weapon.s1));
                  const baseKeys = Object.keys(baseCounts);
                  const baseSorted = baseKeys.sort((a, b) => {
                    if (baseCounts[b] !== baseCounts[a]) return baseCounts[b] - baseCounts[a];
                    return getS1OrderIndex(a) - getS1OrderIndex(b);
                  });
                  const baseAutoPick = [];
                  const selectedBaseSet = new Set(matchedSelected.map((weapon) => weapon.s1));
                  baseSorted.forEach((key) => {
                    if (selectedBaseSet.has(key) && !baseAutoPick.includes(key)) {
                      baseAutoPick.push(key);
                    }
                  });
                  baseSorted.forEach((key) => {
                    if (baseAutoPick.length < 3 && !baseAutoPick.includes(key)) {
                      baseAutoPick.push(key);
                    }
                  });
                  const baseOverflow = baseKeys.length > 3;
                  if (baseAutoPick.length < 3 && s1Options.value.length) {
                    const fillers = s1Options.value.filter((value) => !baseAutoPick.includes(value));
                    baseAutoPick.push(...fillers.slice(0, 3 - baseAutoPick.length));
                  }
                  const baseAllLabels = baseSorted.slice();

                  const baseLimit = Math.min(3, baseKeys.length);
                  const storedManual = schemeBaseSelections.value[schemeKey] || [];
                  const requiredBaseKeys = uniqueSorted(
                    matchedSelected.map((weapon) => weapon.s1),
                    (a, b) => getS1OrderIndex(a) - getS1OrderIndex(b)
                  );
                  const requiredBaseSet = new Set(requiredBaseKeys);
                  const manualPickKeys = uniqueSorted(
                    storedManual.filter((key) => baseKeys.includes(key) && !requiredBaseSet.has(key)),
                    (a, b) => getS1OrderIndex(a) - getS1OrderIndex(b)
                  );
                  const displayBaseKeys = uniqueSorted(
                    [...requiredBaseKeys, ...manualPickKeys],
                    (a, b) => getS1OrderIndex(a) - getS1OrderIndex(b)
                  );
                  const manualPickNeeded = baseOverflow
                    ? Math.max(0, baseLimit - displayBaseKeys.length)
                    : 0;
                  const manualPickOverflow = baseOverflow && displayBaseKeys.length > baseLimit;
                  const manualPickReady =
                    baseOverflow && displayBaseKeys.length >= baseLimit && !manualPickOverflow;
                  const activeBaseKeys = baseOverflow
                    ? manualPickReady
                      ? displayBaseKeys
                      : baseAutoPick
                    : baseKeys;
                  const activeBaseSet = new Set(activeBaseKeys);
                  const baseLockedSet = baseOverflow ? new Set(displayBaseKeys) : activeBaseSet;
                  const baseAutoPickSet = new Set(baseAutoPick);

                  const baseChips = baseSorted.map((key) => ({
                    key,
                    label: `${formatS1(key)} ×${baseCounts[key]}`,
                    overflow: baseOverflow && !baseAutoPick.includes(key),
                  }));

                  const planWeapons = schemeWeapons.slice();
                  const incompatibleSelected = targets
                    .filter((weapon) => !isWeaponCompatible(weapon, dungeon, option))
                    .slice()
                    .sort(schemeWeaponSorter)
                    .map((weapon) => ({
                      ...weapon,
                      ...getConflictInfo(weapon, dungeon, option),
                      note: getWeaponNote(weapon.name),
                    }));
                  const autoCoveredSelected = matchedSelected.filter((weapon) =>
                    baseAutoPickSet.has(weapon.s1)
                  );
                  const autoCoveredSelectedSet = new Set(
                    autoCoveredSelected.map((weapon) => weapon.name)
                  );
                  const autoMissingSelected = targets.filter(
                    (weapon) => !autoCoveredSelectedSet.has(weapon.name)
                  );
                  const coveredSelected = matchedSelected.filter((weapon) =>
                    activeBaseSet.has(weapon.s1)
                  );
                  const coveredSelectedSet = new Set(coveredSelected.map((weapon) => weapon.name));
                  const missingSelected = matchedSelected.filter(
                    (weapon) => !coveredSelectedSet.has(weapon.name)
                  );
                  const autoWeaponCount = schemeWeaponsActive.filter((weapon) =>
                    baseAutoPickSet.has(weapon.s1)
                  ).length;
                  const displayWeaponCount = schemeWeaponsActive.filter((weapon) =>
                    activeBaseSet.has(weapon.s1)
                  ).length;

                  const basePickLabels = baseOverflow
                    ? [...displayBaseKeys]
                    : baseAutoPick.slice();
                  if (baseOverflow) {
                    while (basePickLabels.length < baseLimit) {
                      basePickLabels.push("请手动选择");
                    }
                  }

                  const weaponRows = planWeapons.map((weapon) => ({
                    ...weapon,
                    isSelected: selectedSet.has(weapon.name),
                    isExcluded: excludedSet.has(weapon.name),
                    note: getWeaponNote(weapon.name),
                    baseLocked: baseLockedSet.has(weapon.s1),
                    baseConflict:
                      baseOverflow && manualPickReady && !activeBaseSet.has(weapon.s1),
                    baseDim:
                      (baseOverflow && manualPickReady && !activeBaseSet.has(weapon.s1)) ||
                      excludedSet.has(weapon.name),
                  }));

                  schemes.push({
                    dungeon,
                    lockType: option.type,
                    lockLabel: option.label,
                    lockValue: option.value,
                    schemeKey,
                    weaponRows,
                    weaponCount: autoWeaponCount,
                    maxWeaponCount: schemeWeaponsActive.length,
                    selectedMatchCount: autoCoveredSelected.length,
                    selectedMissingCount: autoMissingSelected.length,
                    selectedMatchNames: autoCoveredSelected.map((weapon) => weapon.name),
                    selectedMissingNames: autoMissingSelected.map((weapon) => weapon.name),
                    conflictSelected: incompatibleSelected,
                    conflictSelectedNames: incompatibleSelected.map((weapon) => weapon.name),
                    displayWeaponCount,
                    displaySelectedMatchCount: coveredSelected.length,
                    displaySelectedMissingCount: missingSelected.length,
                    displaySelectedMatchNames: coveredSelected.map((weapon) => weapon.name),
                    displaySelectedMissingNames: missingSelected.map((weapon) => weapon.name),
                    basePickLabels,
                    baseAllLabels,
                    baseOverflow,
                    manualPickNeeded,
                    manualPickOverflow,
                    baseCount: baseKeys.length,
                    baseChips,
                    requiredBaseKeys,
                  });
                });
              });

              return schemes.sort((a, b) => {
                if (b.selectedMatchCount !== a.selectedMatchCount) {
                  return b.selectedMatchCount - a.selectedMatchCount;
                }
                if (b.weaponCount !== a.weaponCount) return b.weaponCount - a.weaponCount;
                if (b.maxWeaponCount !== a.maxWeaponCount) {
                  return b.maxWeaponCount - a.maxWeaponCount;
                }
                if (a.dungeon.name !== b.dungeon.name) {
                  return a.dungeon.name.localeCompare(b.dungeon.name, "zh-Hans-CN");
                }
                return a.lockLabel.localeCompare(b.lockLabel, "zh-Hans-CN");
              });
            });

            const coverageSummary = computed(() => {
              const targets = selectedWeapons.value;
              if (!targets.length) return null;
              const schemes = recommendations.value;
              if (!schemes.length) return null;
              const best = schemes[0];
              return {
                totalSelected: targets.length,
                bestMatchCount: best.selectedMatchCount,
                missingNames: best.selectedMissingNames || [],
                hasGap: best.selectedMatchCount < targets.length,
              };
            });

            const primaryRecommendations = computed(() => {
              const targets = selectedWeapons.value;
              const schemes = recommendations.value;
              if (!targets.length || !schemes.length) return [];

              const top = schemes[0];
              const bestMatch = top.selectedMatchCount;
              const bestWeaponCount = top.weaponCount;
              const bestSchemes = schemes.filter(
                (scheme) =>
                  scheme.selectedMatchCount === bestMatch &&
                  scheme.weaponCount === bestWeaponCount
              );

              const remaining = new Set(targets.map((weapon) => weapon.name));
              const picked = [];
              const pickedKeys = new Set();
              const pickScheme = (scheme) => {
                picked.push(scheme);
                pickedKeys.add(scheme.schemeKey);
                if (scheme.selectedMatchNames) {
                  scheme.selectedMatchNames.forEach((name) => remaining.delete(name));
                }
              };

              let seed = null;
              let seedCover = -1;
              bestSchemes.forEach((scheme) => {
                const cover = scheme.selectedMatchNames ? scheme.selectedMatchNames.length : 0;
                if (cover > seedCover) {
                  seed = scheme;
                  seedCover = cover;
                }
              });
              if (seed) pickScheme(seed);

              while (remaining.size) {
                let best = null;
                let bestCover = 0;

                schemes.forEach((scheme) => {
                  if (pickedKeys.has(scheme.schemeKey)) return;
                  const cover = scheme.selectedMatchNames
                    ? scheme.selectedMatchNames.filter((name) => remaining.has(name)).length
                    : 0;
                  if (cover > bestCover) {
                    best = scheme;
                    bestCover = cover;
                  }
                });

                if (!best || bestCover === 0) break;
                pickScheme(best);
              }

              bestSchemes.forEach((scheme) => {
                if (!pickedKeys.has(scheme.schemeKey)) pickScheme(scheme);
              });

              if (!picked.length && schemes.length) {
                pickScheme(schemes[0]);
              }

              return picked;
            });

            const extraRecommendations = computed(() => {
              const primaryKeys = new Set(primaryRecommendations.value.map((scheme) => scheme.schemeKey));
              return recommendations.value.filter((scheme) => !primaryKeys.has(scheme.schemeKey));
            });

            const visibleRecommendations = computed(() =>
              showAllSchemes.value ? recommendations.value : primaryRecommendations.value
            );

            const reorderForTutorial = (list) => {
              if (!tutorialActive.value || tutorialStepKey.value !== "base-pick") {
                return list;
              }
              const target = tutorialTargetScheme.value;
              if (!target) return list;
              const targetKey = target.schemeKey;
              const hasTarget = list.some((scheme) => scheme && scheme.schemeKey === targetKey);
              if (!hasTarget) return list;
              const rest = list.filter((scheme) => scheme && scheme.schemeKey !== targetKey);
              return [target, ...rest];
            };

            const displayPrimaryRecommendations = computed(() =>
              reorderForTutorial(primaryRecommendations.value)
            );

            const displayExtraRecommendations = computed(() =>
              reorderForTutorial(extraRecommendations.value)
            );

            const displayRecommendations = computed(() => {
              if (!showAllSchemes.value || !displayExtraRecommendations.value.length) {
                return displayPrimaryRecommendations.value;
              }
              return [
                ...displayPrimaryRecommendations.value,
                ...displayExtraRecommendations.value,
              ];
            });

            const displayDividerIndex = computed(() => {
              if (!showAllSchemes.value) return -1;
              if (!displayExtraRecommendations.value.length) return -1;
              return displayPrimaryRecommendations.value.length;
            });

            const tutorialTargetSchemeKey = computed(
              () => (tutorialTargetScheme.value ? tutorialTargetScheme.value.schemeKey : "")
            );

            const tutorialTargetScheme = computed(() =>
              visibleRecommendations.value.find(
                (scheme) =>
                  scheme &&
                  scheme.dungeon &&
                  scheme.dungeon.id === tutorialTargetDungeonId &&
                  scheme.lockType === tutorialTargetLockType &&
                  scheme.lockValue === tutorialTargetLockValue
              )
            );

            const tutorialManualPickReady = computed(() => {
              const scheme = tutorialTargetScheme.value;
              if (!scheme) return false;
              const stored = schemeBaseSelections.value[scheme.schemeKey] || [];
              return tutorialRequiredBaseKeys.every((key) => stored.includes(key));
            });

            const tutorialStepReady = computed(() => {
              if (!tutorialActive.value) return false;
              switch (tutorialStepKey.value) {
                case "show-attrs":
                  return showWeaponAttrs.value;
                case "exclude":
                  return tutorialExcluded.value;
                case "note":
                  return true;
                case "base-pick":
                  return tutorialManualPickReady.value;
                default:
                  return false;
              }
            });

            const tutorialAutoAdvanceDisabled = computed(
              () =>
                tutorialStepKey.value === "note" ||
                tutorialManualBack.value ||
                tutorialManualAdvanceHoldIndex.value === tutorialStepIndex.value
            );

            const resetTutorialState = () => {
              tutorialExcluded.value = false;
              tutorialNote.value = "";
              tutorialNoteTouched.value = false;
              tutorialManualBack.value = false;
              tutorialManualAdvanceHoldIndex.value = -1;
              tutorialBodyCollapsed.value = false;
              tutorialCollapseHighlight.value = false;
              tutorialCollapseHighlightSeen.value = false;
            };

            const syncTutorialPanelForStep = () => {
              if (tutorialStepKey.value === "base-pick") {
                if (!isPortrait.value) {
                  mobilePanel.value = "plans";
                }
                return;
              }
              mobilePanel.value = "weapons";
            };

            const applyTutorialBasePickPreset = () => {
              const target = weapons.find((weapon) => weapon.name === tutorialTargetWeaponName);
              if (!target) return;
              if (selectedNames.value.length !== 1 || selectedNames.value[0] !== target.name) {
                selectedNames.value = [target.name];
              }
              schemeBaseSelections.value = {};
              showAllSchemes.value = true;
            };

            const syncTutorialStepState = () => {
              if (tutorialStepKey.value === "base-pick") {
                applyTutorialBasePickPreset();
                return;
              }
            };

            const maybeHighlightCollapseToggle = () => {
              if (!tutorialActive.value) return;
              if (tutorialStepKey.value !== "base-pick") return;
              if (!isPortrait.value) return;
              if (!tutorialBodyCanCollapse.value || !tutorialBodyCollapsed.value) return;
              if (tutorialCollapseHighlightSeen.value) return;
              tutorialCollapseHighlight.value = true;
            };

            const syncTutorialBodyCollapse = () => {
              if (!tutorialActive.value) {
                tutorialBodyCollapsed.value = false;
                tutorialCollapseHighlight.value = false;
                tutorialCollapseHighlightSeen.value = false;
                return;
              }
              if (tutorialStepKey.value === "base-pick" && isPortrait.value) {
                tutorialBodyCollapsed.value = true;
                maybeHighlightCollapseToggle();
                return;
              }
              tutorialBodyCollapsed.value = false;
              tutorialCollapseHighlight.value = false;
            };

            const toggleTutorialBody = () => {
              tutorialBodyCollapsed.value = !tutorialBodyCollapsed.value;
              if (tutorialCollapseHighlight.value) {
                tutorialCollapseHighlight.value = false;
                tutorialCollapseHighlightSeen.value = true;
              }
            };

            const toggleTutorialExclude = () => {
              tutorialExcluded.value = !tutorialExcluded.value;
              if (tutorialExcluded.value) {
                trackEvent("weapon_exclude", { weapon: tutorialWeapon.name, tutorial: true });
              } else {
                trackEvent("weapon_unexclude", { weapon: tutorialWeapon.name, tutorial: true });
              }
            };

            const markTutorialNoteTouched = () => {
              tutorialNoteTouched.value = true;
            };

            const updateTutorialNote = (value) => {
              tutorialNote.value = value || "";
              tutorialNoteTouched.value = true;
            };

            const clearTutorialScrollTimer = () => {
              if (tutorialScrollTimer) {
                clearTimeout(tutorialScrollTimer);
                tutorialScrollTimer = null;
              }
            };

            const clearTutorialAdvanceTimer = () => {
              if (tutorialAdvanceTimer) {
                clearTimeout(tutorialAdvanceTimer);
                tutorialAdvanceTimer = null;
              }
            };

            const resolveTutorialTarget = (value) =>
              Array.isArray(value) ? value[0] : value;

            const getTutorialScrollTarget = () => {
              if (!tutorialActive.value) return null;
              if (tutorialStepKey.value === "exclude" || tutorialStepKey.value === "note") {
                return resolveTutorialTarget(tutorialWeaponTarget.value);
              }
              if (tutorialStepKey.value === "base-pick") {
                if (isPortrait.value && mobilePanel.value !== "plans") {
                  return resolveTutorialTarget(tutorialPlansTab.value);
                }
                return resolveTutorialTarget(tutorialSchemeTarget.value);
              }
              return null;
            };

            const scrollTutorialTarget = () => {
              const target = getTutorialScrollTarget();
              if (!target || typeof target.scrollIntoView !== "function") return;
              target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
            };

            const scheduleTutorialScroll = () => {
              clearTutorialScrollTimer();
              tutorialScrollTimer = setTimeout(() => {
                if (!tutorialActive.value) return;
                if (typeof nextTick === "function") {
                  nextTick(() => requestAnimationFrame(scrollTutorialTarget));
                } else {
                  requestAnimationFrame(scrollTutorialTarget);
                }
              }, 120);
            };

            const advanceTutorialStep = (options = {}) => {
              const { manual = false } = options;
              if (tutorialStepIndex.value >= tutorialTotalSteps.value - 1) {
                finishTutorial();
                return;
              }
              tutorialStepIndex.value += 1;
              tutorialManualBack.value = false;
              tutorialManualAdvanceHoldIndex.value = -1;
              syncTutorialPanelForStep();
              syncTutorialStepState();
              if (manual && tutorialStepReady.value) {
                tutorialManualAdvanceHoldIndex.value = tutorialStepIndex.value;
              }
            };

            const scheduleTutorialAdvance = () => {
              clearTutorialAdvanceTimer();
              tutorialAdvanceTimer = setTimeout(() => {
                if (!tutorialActive.value) return;
                if (!tutorialStepReady.value) return;
                advanceTutorialStep();
              }, 450);
            };

            const startTutorial = (force = false) => {
              if (!force && (tutorialSkipAll.value || tutorialCompleted.value)) return;
              showTutorialSkipConfirm.value = false;
              showTutorialComplete.value = false;
              tutorialActive.value = true;
              tutorialStepIndex.value = 0;
              tutorialAutoStartPending = false;
              resetTutorialState();
              syncTutorialPanelForStep();
              syncTutorialStepState();
            };

            const finishTutorial = () => {
              tutorialActive.value = false;
              tutorialCompletedVersion.value = tutorialVersion;
              showTutorialSkipConfirm.value = false;
              showTutorialComplete.value = true;
              clearTutorialAdvanceTimer();
              clearTutorialScrollTimer();
            };

            const skipTutorialAll = () => {
              tutorialActive.value = false;
              tutorialSkippedVersion.value = tutorialVersion;
              tutorialCompletedVersion.value = tutorialVersion;
              tutorialAutoStartPending = false;
              showTutorialSkipConfirm.value = false;
              showTutorialComplete.value = false;
              clearTutorialAdvanceTimer();
              clearTutorialScrollTimer();
            };

            const openTutorialSkipConfirm = () => {
              if (!tutorialActive.value) return;
              showTutorialSkipConfirm.value = true;
            };

            const closeTutorialSkipConfirm = () => {
              showTutorialSkipConfirm.value = false;
            };

            const confirmTutorialSkipAll = () => {
              skipTutorialAll();
            };

            const closeTutorialComplete = () => {
              showTutorialComplete.value = false;
            };

            const skipTutorialStep = () => {
              if (!tutorialActive.value) return;
              clearTutorialAdvanceTimer();
              advanceTutorialStep();
            };

            const nextTutorialStep = () => {
              if (!tutorialStepReady.value) return;
              clearTutorialAdvanceTimer();
              tutorialManualBack.value = false;
              advanceTutorialStep({ manual: true });
            };

            const prevTutorialStep = () => {
              if (!tutorialActive.value) return;
              if (tutorialStepIndex.value <= 0) return;
              tutorialStepIndex.value -= 1;
              tutorialManualBack.value = true;
              tutorialManualAdvanceHoldIndex.value = -1;
              clearTutorialAdvanceTimer();
              syncTutorialPanelForStep();
              syncTutorialStepState();
            };

            const maybeAutoStartTutorial = () => {
              if (!tutorialAutoStartPending) return;
              if (tutorialActive.value) return;
              if (tutorialSkipAll.value || tutorialCompleted.value) {
                tutorialAutoStartPending = false;
                return;
              }
              if (showNotice.value || showChangelog.value || showAbout.value || showDomainWarning.value) {
                return;
              }
              tutorialAutoStartPending = false;
              startTutorial(true);
            };

            const updateAttrWrap = () => {
              const groups = document.querySelectorAll(".scheme-weapon-attrs");
              const isWrapped = (group) => {
                const items = group.querySelectorAll(".attr-value");
                if (items.length < 2) return false;
                const firstTop = items[0].offsetTop;
                for (let i = 1; i < items.length; i += 1) {
                  if (items[i].offsetTop > firstTop) {
                    return true;
                  }
                }
                return false;
              };

              const shrinkToFit = (group) => {
                const minFontSize = 9;
                const maxSteps = 2;
                let steps = 0;
                while (isWrapped(group) && steps < maxSteps) {
                  const current = parseFloat(getComputedStyle(group).fontSize);
                  if (!current || current <= minFontSize) break;
                  const nextSize = Math.max(minFontSize, current - 1);
                  group.style.fontSize = `${nextSize}px`;
                  steps += 1;
                }
              };

              groups.forEach((group) => {
                group.classList.remove("is-wrapped");
                group.style.fontSize = "";
                if (!isWrapped(group)) {
                  return;
                }
                group.classList.add("is-wrapped");
                shrinkToFit(group);
              });
            };

            const scheduleAttrWrap = () => {
              nextTick(() => {
                requestAnimationFrame(updateAttrWrap);
              });
            };

            const fallbackPlan = computed(() => {
              const targets = selectedWeapons.value;
              if (!targets.length) return null;
              if (recommendations.value.length) return null;

              const baseCounts = countBy(targets.map((weapon) => weapon.s1));
              const baseKeys = Object.keys(baseCounts);
              const baseSorted = baseKeys.sort((a, b) => {
                if (baseCounts[b] !== baseCounts[a]) return baseCounts[b] - baseCounts[a];
                return getS1OrderIndex(a) - getS1OrderIndex(b);
              });
              const basePick = baseSorted.slice(0, 3);
              const baseOverflow = baseKeys.length > 3;
              const basePickLabels = basePick.slice();
              while (basePickLabels.length < 3) basePickLabels.push("任意属性");
              const baseAllLabels = baseSorted.slice();

              const baseChips = baseSorted.map((key) => ({
                key,
                label: `${formatS1(key)} ×${baseCounts[key]}`,
                overflow: baseOverflow && !basePick.includes(key),
              }));

              const s2Conflict = new Set(targets.map((weapon) => weapon.s2)).size > 1;
              const s3Conflict = new Set(targets.map((weapon) => weapon.s3)).size > 1;

              const weaponRows = targets
                .slice()
                .sort(getBaseAttrSorter("s2", "s3"))
                .map((weapon) => ({
                  ...weapon,
                  baseLocked: basePick.includes(weapon.s1),
                  baseConflict: baseOverflow && !basePick.includes(weapon.s1),
                }));

              return {
                basePickLabels,
                baseAllLabels,
                baseOverflow,
                baseCount: baseKeys.length,
                baseChips,
                weaponRows,
                s2Conflict,
                s3Conflict,
              };
            });

            onMounted(() => {
              scheduleAttrWrap();
              window.addEventListener("resize", scheduleAttrWrap);
            });

            onBeforeUnmount(() => {
              window.removeEventListener("resize", scheduleAttrWrap);
            });

            watch(
              weaponMarks,
              (value) => {
                try {
                  const keys = Object.keys(value || {});
                  if (!keys.length) {
                    localStorage.removeItem(marksStorageKey);
                    return;
                  }
                  localStorage.setItem(marksStorageKey, JSON.stringify(value));
                } catch (error) {
                  // ignore storage errors
                }
              },
              { deep: true }
            );

            const uiState = computed(() => ({
              searchQuery: searchQuery.value,
              selectedNames: selectedNames.value,
              schemeBaseSelections: schemeBaseSelections.value,
              showWeaponAttrs: showWeaponAttrs.value,
              showFilterPanel: showFilterPanel.value,
              showAllSchemes: showAllSchemes.value,
              filterS1: filterS1.value,
              filterS2: filterS2.value,
              filterS3: filterS3.value,
              mobilePanel: mobilePanel.value,
            }));

            watch(
              uiState,
              (value) => {
                try {
                  localStorage.setItem(uiStateStorageKey, JSON.stringify(value));
                } catch (error) {
                  // ignore storage errors
                }
              },
              { deep: true }
            );

            watch(
              [tutorialSkippedVersion, tutorialCompletedVersion],
              () => {
                try {
                  localStorage.setItem(
                    tutorialStorageKey,
                    JSON.stringify({
                      skipVersion: tutorialSkippedVersion.value,
                      completedVersion: tutorialCompletedVersion.value,
                    })
                  );
                } catch (error) {
                  // ignore storage errors
                }
              },
              { immediate: true }
            );

            let scrollLockActive = false;
            let scrollLockY = 0;
            const setModalScrollLock = (locked) => {
              if (typeof window === "undefined") return;
              const root = document.documentElement;
              const body = document.body;
              if (locked) {
                if (scrollLockActive) return;
                scrollLockActive = true;
                scrollLockY = window.scrollY || window.pageYOffset || 0;
                const scrollbarGap = window.innerWidth - root.clientWidth;
                if (scrollbarGap > 0) {
                  body.style.paddingRight = `${scrollbarGap}px`;
                }
                body.style.position = "fixed";
                body.style.top = `-${scrollLockY}px`;
                body.style.left = "0";
                body.style.right = "0";
                body.style.width = "100%";
                body.style.overflow = "hidden";
                root.classList.add("modal-open");
                body.classList.add("modal-open");
                return;
              }
              if (!scrollLockActive) return;
              scrollLockActive = false;
              body.style.position = "";
              body.style.top = "";
              body.style.left = "";
              body.style.right = "";
              body.style.width = "";
              body.style.overflow = "";
              body.style.paddingRight = "";
              root.classList.remove("modal-open");
              body.classList.remove("modal-open");
              if (scrollLockY) {
                window.scrollTo(0, scrollLockY);
              }
            };

            watch(
              [showNotice, showChangelog, showAbout, showTutorialSkipConfirm],
              ([noticeOpen, changelogOpen, aboutOpen, skipOpen]) => {
                setModalScrollLock(Boolean(noticeOpen || changelogOpen || aboutOpen || skipOpen));
              },
              { immediate: true }
            );

            watch(
              [showNotice, showChangelog, showAbout, showDomainWarning],
              () => {
                maybeAutoStartTutorial();
              },
              { immediate: true }
            );

            watch(
              [tutorialStepIndex, tutorialActive],
              ([, active]) => {
                if (!active) {
                  clearTutorialScrollTimer();
                  syncTutorialBodyCollapse();
                  return;
                }
                syncTutorialPanelForStep();
                syncTutorialStepState();
                syncTutorialBodyCollapse();
                scheduleTutorialScroll();
              },
              { immediate: true }
            );

            watch(
              isPortrait,
              (current, previous) => {
                if (current && !previous) {
                  tutorialCollapseHighlightSeen.value = false;
                  maybeHighlightCollapseToggle();
                  return;
                }
                if (!current && previous) {
                  tutorialCollapseHighlight.value = false;
                }
              },
              { immediate: true }
            );

            watch(
              [tutorialStepReady, tutorialAutoAdvanceDisabled],
              ([ready, disabled]) => {
                if (!tutorialActive.value) {
                  clearTutorialAdvanceTimer();
                  return;
                }
                if (disabled) {
                  clearTutorialAdvanceTimer();
                  return;
                }
                if (ready) {
                  scheduleTutorialAdvance();
                } else {
                  clearTutorialAdvanceTimer();
                }
              },
              { immediate: true }
            );

            watch(
              [mobilePanel, tutorialStepKey, isPortrait],
              () => {
                if (!tutorialActive.value) return;
                if (tutorialStepKey.value === "base-pick") {
                  scheduleTutorialScroll();
                }
              },
              { immediate: true }
            );

            watch([showWeaponAttrs, showAllSchemes, mobilePanel], scheduleAttrWrap);
            watch(filteredWeapons, scheduleAttrWrap);
            watch(displayRecommendations, scheduleAttrWrap);
            watch(conflictOpenMap, scheduleAttrWrap, { deep: true });
            watch(
              () => selectedWeapons.value.length,
              (count) => {
                if (count === 1) {
                  showAllSchemes.value = true;
                } else if (count > 1) {
                  showAllSchemes.value = false;
                } else if (count === 0) {
                  showAllSchemes.value = false;
                }
              }
            );

            const hasImage = (weapon) => weaponImages.has(weapon.name);
            const weaponImageSrc = (weapon) => encodeURI(`./image/${weapon.name}.png`);
            const weaponCharacters = (weapon) => {
              if (!weapon || !Array.isArray(weapon.chars)) return [];
              const unique = new Set(weapon.chars.filter(Boolean));
              return Array.from(unique);
            };
            const characterImageSrc = (name) => encodeURI(`./image/characters/${name}.png`);
            const handleCharacterImageError = (event) => {
              const target = event && event.target;
              if (target) target.style.display = "none";
            };

            const rarityBadgeStyle = (rarity, withImage = false) => ({
              backgroundColor: withImage
                ? "rgba(255,255,255,0.04)"
                : rarity === 6
                  ? "#ff7000"
                  : rarity === 5
                    ? "#ffba03"
                    : "#9aa5b1",
              color: withImage ? "transparent" : "#0c1118",
            });

            const rarityTextStyle = (rarity) => ({
              color: rarity === 6 ? "#ff7000" : rarity === 5 ? "#ffba03" : "inherit",
            });

              return {
                locale,
                languageOptions,
                langSwitchRef,
                showLangMenu,
                langMenuPlacement,
                toggleLangMenu,
                setLocale,
                t,
                tTerm,
                showAiNotice,
                searchQuery,
                selectedNames,
                selectedWeaponRows,
                selectedWeapons,
                selectedNameSet,
                isExcluded,
                toggleExclude,
                getWeaponNote,
                updateWeaponNote,
                toggleShowWeaponAttrs,
                showWeaponAttrs,
                showFilterPanel,
                showAllSchemes,
                showBackToTop,
                scrollToTop,
                tutorialActive,
                tutorialStep,
                tutorialVisibleLines,
                tutorialStepIndex,
                tutorialTotalSteps,
                tutorialStepKey,
                tutorialStepReady,
                tutorialWeapon,
                tutorialExcluded,
                tutorialNote,
                tutorialBodyCanCollapse,
                tutorialBodyCollapsed,
                tutorialCollapseHighlight,
                tutorialSkipAll,
                showTutorialSkipConfirm,
                showTutorialComplete,
                tutorialTargetSchemeKey,
                isTutorialGuideWeapon,
                isPortrait,
                startTutorial,
                nextTutorialStep,
                prevTutorialStep,
                skipTutorialStep,
                skipTutorialAll,
                openTutorialSkipConfirm,
                closeTutorialSkipConfirm,
                confirmTutorialSkipAll,
                closeTutorialComplete,
                finishTutorial,
                toggleTutorialBody,
                toggleTutorialExclude,
                updateTutorialNote,
                markTutorialNoteTouched,
                tutorialWeaponTarget,
                tutorialSchemeTarget,
                tutorialPlansTab,
                filterS1,
                filterS2,
                filterS3,
                s1Options,
                s2Options,
                s3OptionEntries,
                toggleFilterValue,
                clearAttributeFilters,
                hasAttributeFilters,
                filteredWeapons,
                recommendations,
                coverageSummary,
                primaryRecommendations,
                extraRecommendations,
                visibleRecommendations,
                displayRecommendations,
                displayDividerIndex,
                fallbackPlan,
                toggleWeapon,
                toggleSchemeBasePick,
                isConflictOpen,
                toggleConflictOpen,
                clearSelection,
                formatS1,
              rarityBadgeStyle,
              rarityTextStyle,
              hasImage,
              weaponImageSrc,
              weaponCharacters,
              characterImageSrc,
              handleCharacterImageError,
              announcement,
              changelog,
              aboutContent,
              showAbout,
              showNotice,
              showChangelog,
              skipNotice,
              openNotice,
              closeNotice,
              appReady,
              mobilePanel,
              showDomainWarning,
              currentHost,
              embedHostLabel,
              isEmbedTrusted,
              isEmbedded,
              warningCountdown,
              dismissDomainWarning,
              lowGpuEnabled,
              perfPreference,
              showSecondaryMenu,
              showPerfNotice,
              setPerfMode,
            };
          },
        }).mount("#app");
      }
    
