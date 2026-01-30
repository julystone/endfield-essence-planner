      const dungeons = Array.isArray(window.DUNGEONS) ? window.DUNGEONS : [];
      const weapons = Array.isArray(window.WEAPONS) ? window.WEAPONS : [];
      const weaponImages = new Set(Array.isArray(window.WEAPON_IMAGES) ? window.WEAPON_IMAGES : []);

      const S1_ORDER = ["敏捷提升", "力量提升", "意志提升", "智识提升", "主能力提升"];

      const normalizeText = (value) => (value || "").toString().trim().toLowerCase();

      const allSame = (values) => values.length > 0 && values.every((value) => value === values[0]);

      const countBy = (values) =>
        values.reduce((acc, value) => {
          if (!value || value === "任意") return acc;
          acc[value] = (acc[value] || 0) + 1;
          return acc;
        }, {});

      const formatS1 = (value) => value || "任意";

      const getS1OrderIndex = (value) => {
        const index = S1_ORDER.indexOf(value);
        return index === -1 ? 99 : index;
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
        document.body.innerHTML =
          "<div style='padding:24px;color:#f36c6c;font-family:Microsoft YaHei UI;'>未找到 Vue 3 本地文件：请将 vue.global.prod.js 放入 ./vendor/</div>";
      } else if (!dungeons.length || !weapons.length) {
        document.body.innerHTML =
          "<div style='padding:24px;color:#f36c6c;font-family:Microsoft YaHei UI;'>缺少数据文件：请确认 ./data/dungeons.js 与 ./data/weapons.js</div>";
      } else {
        createApp({
            setup() {
              const searchQuery = ref("");
              const selectedNames = ref([]);
              const schemeBaseSelections = ref({});
              const showAbout = ref(false);
              const content = window.CONTENT || {};
              const defaultAnnouncement = {
                version: "",
                title: "公告",
                date: "",
                qqGroup: "",
                qqNote: "",
                items: [],
              };
              const announcement = {
                ...defaultAnnouncement,
                ...(content.announcement || {}),
              };
              const defaultAbout = {
                title: "关于本工具",
                paragraphs: [],
                author: "",
                links: [],
              };
              const aboutContent = {
                ...defaultAbout,
                ...(content.about || {}),
              };
              const showNotice = ref(false);
              const skipNotice = ref(false);
              const appReady = ref(false);
              const mobilePanel = ref("weapons");
              const showWeaponAttrs = ref(false);
              const showFilterPanel = ref(true);
              const showAllSchemes = ref(false);
              const filterS1 = ref([]);
              const filterS2 = ref([]);
              const filterS3 = ref([]);
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
              embedHostLabel.value = embedHost.value || "未知来源";
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

            onMounted(() => {
              appReady.value = true;
              try {
                const skipKey = `announcement:skip:${announcement.version}`;
                const skipped = localStorage.getItem(skipKey) === "1";
                if (!skipped) {
                  skipNotice.value = false;
                  showNotice.value = true;
                }
              } catch (error) {
                showNotice.value = true;
              }
            });

            const openNotice = () => {
              try {
                const skipKey = `announcement:skip:${announcement.version}`;
                skipNotice.value = localStorage.getItem(skipKey) === "1";
              } catch (error) {
                skipNotice.value = false;
              }
              showNotice.value = true;
            };

            const closeNotice = () => {
              showNotice.value = false;
              try {
                const skipKey = `announcement:skip:${announcement.version}`;
                if (skipNotice.value) {
                  localStorage.setItem(skipKey, "1");
                } else {
                  localStorage.removeItem(skipKey);
                }
              } catch (error) {
                // ignore storage errors
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
              const s3Options = computed(() =>
                uniqueSorted(weapons.map((weapon) => weapon.s3), (a, b) => {
                  return a.localeCompare(b, "zh-Hans-CN");
                })
              );

            const selectedWeapons = computed(() =>
              selectedNames.value.map((name) => weaponMap.get(name)).filter(Boolean)
            );

            const selectedNameSet = computed(() => new Set(selectedNames.value));

            const toggleWeapon = (weapon) => {
              const index = selectedNames.value.indexOf(weapon.name);
              if (index === -1) {
                selectedNames.value.push(weapon.name);
              } else {
                selectedNames.value.splice(index, 1);
              }
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
              return weapons
                .filter((weapon) => {
                  const matchQuery =
                    !query ||
                    normalizeText(weapon.name).includes(query) ||
                    normalizeText(weapon.type).includes(query) ||
                    normalizeText(weapon.s1).includes(query) ||
                    normalizeText(weapon.s2).includes(query) ||
                    normalizeText(weapon.s3).includes(query);
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

                  const schemeWeapons = weapons
                    .filter((weapon) => isWeaponCompatible(weapon, dungeon, option))
                    .slice()
                    .sort((a, b) => {
                      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
                      return a.name.localeCompare(b.name, "zh-Hans-CN");
                    });

                  const baseCounts = countBy(schemeWeapons.map((weapon) => weapon.s1));
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
                  const missingSelected = targets.filter(
                    (weapon) => !coveredSelectedSet.has(weapon.name)
                  );
                  const autoWeaponCount = planWeapons.filter((weapon) =>
                    baseAutoPickSet.has(weapon.s1)
                  ).length;
                  const displayWeaponCount = planWeapons.filter((weapon) =>
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
                    baseLocked: baseLockedSet.has(weapon.s1),
                    baseConflict:
                      baseOverflow && manualPickReady && !activeBaseSet.has(weapon.s1),
                    baseDim: baseOverflow && manualPickReady && !activeBaseSet.has(weapon.s1),
                  }));

                  schemes.push({
                    dungeon,
                    lockType: option.type,
                    lockLabel: option.label,
                    lockValue: option.value,
                    schemeKey,
                    weaponRows,
                    weaponCount: autoWeaponCount,
                    maxWeaponCount: planWeapons.length,
                    selectedMatchCount: autoCoveredSelected.length,
                    selectedMissingCount: autoMissingSelected.length,
                    selectedMatchNames: autoCoveredSelected.map((weapon) => weapon.name),
                    selectedMissingNames: autoMissingSelected.map((weapon) => weapon.name),
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

            const updateAttrWrap = () => {
              const groups = document.querySelectorAll(".scheme-weapon-attrs");
              groups.forEach((group) => {
                group.classList.remove("is-wrapped");
                const items = group.querySelectorAll(".attr-value");
                if (items.length < 2) {
                  return;
                }
                const firstTop = items[0].offsetTop;
                let wrapped = false;
                for (let i = 1; i < items.length; i += 1) {
                  if (items[i].offsetTop > firstTop) {
                    wrapped = true;
                    break;
                  }
                }
                if (wrapped) {
                  group.classList.add("is-wrapped");
                }
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
                .sort((a, b) => {
                  if (b.rarity !== a.rarity) return b.rarity - a.rarity;
                  return a.name.localeCompare(b.name, "zh-Hans-CN");
                })
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

            watch([showWeaponAttrs, showAllSchemes, mobilePanel], scheduleAttrWrap);
            watch(filteredWeapons, scheduleAttrWrap);
            watch(visibleRecommendations, scheduleAttrWrap);
            watch(
              () => selectedNames.value.length,
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
                searchQuery,
                selectedNames,
                selectedWeapons,
                selectedNameSet,
                showWeaponAttrs,
                showFilterPanel,
                showAllSchemes,
                filterS1,
                filterS2,
                filterS3,
                s1Options,
                s2Options,
                s3Options,
                toggleFilterValue,
                clearAttributeFilters,
                hasAttributeFilters,
                filteredWeapons,
                recommendations,
                coverageSummary,
                primaryRecommendations,
                extraRecommendations,
                visibleRecommendations,
                fallbackPlan,
                toggleWeapon,
                toggleSchemeBasePick,
                clearSelection,
                formatS1,
              rarityBadgeStyle,
              rarityTextStyle,
              hasImage,
              weaponImageSrc,
              announcement,
              aboutContent,
              showAbout,
              showNotice,
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
            };
          },
        }).mount("#app");
      }
    
