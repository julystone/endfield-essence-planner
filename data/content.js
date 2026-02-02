window.CONTENT = {
  announcement: {
    version: "1.2.1",
    title: "公告",
    date: "2026-02-02",
    qqGroup: "1045523485",
    qqNote: "反馈与建议交流",
    items: [
      "新增标记角色专武",
      "(关于为什么标记的这么少,因为我找不到一份较为公认的武器表,如果你有,可通过群聊/私信/GitHub issues向我发送相关内容)",
      "详细更新日志请看更新日志或GitHub",
      "(后续会出装备精锻的推荐狗粮功能)",
      "(关于更多的角色攻略之类的,我目前没有那样的游戏理解成为攻略区UP主,能力有限;除非说有攻略区UP找我合作吗,呃啊,那我还是在梦里想想就好了)",
    ],
  },
  changelog: {
    title: "更新日志",
    entries: [
      {
        date: "2026-02-02",
        items: [
          "新增标记角色专武",
          "调整一些UI与字体大小",
        ],
      },
      {
        date: "2026-02-01",
        items: [
          "方案中的武器排序按照基础属性",
          "增加未被任何五星六星武器使用的强攻技能属性",
          "选中多把冲突武器时提示冲突原因",
          "支持繁體中文,日本語,English",
        ],
      },
      {
        date: "2026-01-31",
        items: [
          "增加新手教程(排除武器功能近乎没有被使用过,防止是因为不知道如何使用遂增加新手教程)",
        ],
      },
      {
        date: "2026-01-30",
        items: [
          "多武器方案分批刷取提示与覆盖逻辑优化。",
          "方案卡片信息整理，展开其他方案入口更明显。",
          "支持反向查询（属性筛选）。",
          "窄屏/竖屏适配增强，属性换行时自动隐藏类型。",
          "排除武器功能。",
          "武器可增加备注。",
        ],
      },
    ],
  },
  about: {
    title: "关于本工具",
    paragraphs: [
      "本工具为《明日方舟：终末地》玩家自制作品，旨在提供可视化的基质刷取规划。",
      "感谢所有贡献者对本项目的贡献",
    ],
    author: "璨梦踏月",
    links: [
      {
        chip: "GITHUB",
        text: "项目仓库",
        href: "https://github.com/cmyyx/endfield-essence-planner",
      },
      {
        chip: "BILIBILI",
        text: "介绍视频",
        href: "https://www.bilibili.com/video/BV1r26cB3EYL/",
      },
      {
        chip: "BILIBILI",
        text: "部分更新内容介绍",
        href: "https://www.bilibili.com/video/BV12o61BGEay/",
      },
    ],
    thanks: [
      { name: "端木芒 (终末地基质图原作者)", href: "https://space.bilibili.com/17955975", note: "提供方案排序与效率优化建议" },
    ],
    sponsor: {
      title: "赞助支持",
      text: "您的赞助将用于服务器维护，功能开发，内容创作",
      items: [
        { label: "支付宝", src: "sponsors/alipay.jpg" },
        { label: "微信赞赏码", src: "sponsors/wechat.png" },
      ],
    },
  },
  embed: {
    allowedHosts: ["elysium-stack.cn"],
  },
};
