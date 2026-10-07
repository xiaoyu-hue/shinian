/* 验证 v0.5.9 S5：许愿池到期提醒排程逻辑（notifications.js）
 * 通过 mock Capacitor 原生桥，断言 schedule() 的调用次数与通知内容。 */
const assert = require('assert');

let calls = [];
global.window = {
  Capacitor: {
    isNativePlatform: () => true,
    Plugins: {
      LocalNotifications: {
        checkPermissions: () => Promise.resolve({ display: 'granted' }),
        requestPermissions: () => Promise.resolve({ display: 'granted' }),
        schedule: (arg) => { calls.push(arg); return Promise.resolve(); },
        cancelAll: () => Promise.resolve()
      }
    }
  }
};

require('./assets/notifications.js');
const R = global.window.ShiNianRemind;

function run(label, cfg, wishes, expectCount) {
  calls = [];
  return R.apply(cfg, [], wishes).then(function (res) {
    const wishRes = (res.results || []).filter(function (r) { return r[0] === 'wish'; })[0];
    const total = (wishRes && wishRes[1] && wishRes[1].count) || 0;
    assert.strictEqual(total, expectCount, label + '：期望 ' + expectCount + ' 条，实际 ' + total);
    if (expectCount > 0) {
      const n = calls[0].notifications[0];
      assert.ok(/心愿到期提醒/.test(n.title), label + '：标题应含「心愿到期提醒」');
      assert.ok(/吃蛋糕/.test(n.body), label + '：正文应含心愿文本');
      assert.strictEqual(n.id, 300000, label + '：通知 id 应使用 300000 段');
      assert.strictEqual(n.extra.kind, 'wish', label + '：extra.kind=wish');
    }
    console.log('  ✓ ' + label);
  });
}

(async function () {
  // 1) 开关开 + 今天到期未完成 + 未来时刻 → 1 条
  await run('开关开/今天到期', { wishRemind: true, wishTime: '23:59' },
    [{ id: 'w1', text: '吃蛋糕', done: false, date: '2026-10-06', diff: 0 }], 1);

  // 2) 开关关 → 0 条
  await run('开关关', { wishRemind: false, wishTime: '23:59' },
    [{ id: 'w1', text: '吃蛋糕', done: false, date: '2026-10-06', diff: 0 }], 0);

  // 3) 明天到期（diff=1）→ 0 条（仅当天提醒）
  await run('非今天到期', { wishRemind: true, wishTime: '23:59' },
    [{ id: 'w1', text: '吃蛋糕', done: false, date: '2026-10-07', diff: 1 }], 0);

  // 4) 已完成 → 0 条（不打扰已实现的心愿）
  await run('已完成心愿', { wishRemind: true, wishTime: '23:59' },
    [{ id: 'w1', text: '吃蛋糕', done: true, date: '2026-10-06', diff: 0 }], 0);

  // 5) 多条今天到期 → 各 1 条
  await run('多条今天到期', { wishRemind: true, wishTime: '23:59' }, [
    { id: 'w1', text: '吃蛋糕', done: false, date: '2026-10-06', diff: 0 },
    { id: 'w2', text: '去散步', done: false, date: '2026-10-06', diff: 0 },
    { id: 'w3', text: '明天再说', done: false, date: '2026-10-07', diff: 1 }
  ], 2);

  console.log('\nS5 通知测试全部通过 ✓');
})().catch(function (e) {
  console.error('S5 测试失败：', e.message);
  process.exit(1);
});
