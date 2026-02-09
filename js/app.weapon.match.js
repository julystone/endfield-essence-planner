(function () {
  const modules = (window.AppModules = window.AppModules || {});

  modules.initWeaponMatch = function initWeaponMatch(ctx, state) {
    const { ref, computed } = ctx;

    const matchQuery = ref("");
    const matchSourceName = ref("");

    const allWeapons = weapons
      .slice()
      .sort((a, b) => {
        if (b.rarity !== a.rarity) return b.rarity - a.rarity;
        return compareText(a.name, b.name);
      });
    const sourceWeapons = allWeapons;
    const sourceWeaponMap = new Map(sourceWeapons.map((weapon) => [weapon.name, weapon]));

    const getSearchText = (weapon) => {
      const index = state.weaponSearchIndex && state.weaponSearchIndex.value;
      if (index && index.has(weapon.name)) {
        return index.get(weapon.name);
      }
      return normalizeText(
        [
          weapon.name,
          state.tTerm("weapon", weapon.name),
          weapon.short,
          state.tTerm("short", weapon.short),
          weapon.type,
          state.tTerm("type", weapon.type),
          weapon.s1,
          state.tTerm("s1", weapon.s1),
          weapon.s2,
          state.tTerm("s2", weapon.s2),
          weapon.s3,
          state.tTerm("s3", weapon.s3),
        ].join(" ")
      );
    };

    const matchSourceList = computed(() => {
      const query = normalizeText(matchQuery.value);
      if (!query) return sourceWeapons;
      return sourceWeapons.filter((weapon) => getSearchText(weapon).includes(query));
    });

    const matchSourceWeapon = computed(() => sourceWeaponMap.get(matchSourceName.value) || null);

    const matchResults = computed(() => {
      const source = matchSourceWeapon.value;
      if (!source) return [];
      return allWeapons.filter(
        (weapon) =>
          weapon.name !== source.name &&
          weapon.s1 === source.s1 &&
          weapon.s2 === source.s2 &&
          weapon.s3 === source.s3
      );
    });

    const selectMatchSource = (weapon) => {
      if (!weapon || !weapon.name) return;
      matchSourceName.value = weapon.name;
    };

    if (!matchSourceName.value && sourceWeapons.length) {
      matchSourceName.value = sourceWeapons[0].name;
    }

    state.matchQuery = matchQuery;
    state.matchSourceName = matchSourceName;
    state.matchSourceList = matchSourceList;
    state.matchSourceWeapon = matchSourceWeapon;
    state.matchResults = matchResults;
    state.selectMatchSource = selectMatchSource;
  };
})();
