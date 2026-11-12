import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { configPath, describeConfig, loadConfig, readConfig, saveConfig } from '../src/shared/config.js';

test('config: save, mask, env precedence, removal, validation', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'nithan-cfg-'));
  const env = { NITHAN_HOME: home };
  assert.equal(configPath(env), path.join(home, 'config.json'));
  await saveConfig({ CLOUDFLARE_ACCOUNT_ID: 'acc123', CLOUDFLARE_API_TOKEN: 'tok-0123456789' }, env);
  assert.equal(env.CLOUDFLARE_API_TOKEN, 'tok-0123456789'); // applied immediately
  assert.deepEqual(await readConfig(env), { CLOUDFLARE_ACCOUNT_ID: 'acc123', CLOUDFLARE_API_TOKEN: 'tok-0123456789' });
  const d = await describeConfig(env);
  assert.equal(d.CLOUDFLARE_API_TOKEN.value, 'tok-…6789');
  assert.equal(d.CLOUDFLARE_API_TOKEN.source, 'config');
  assert.equal(d.GEMINI_API_KEY.set, false);
  // env wins over the file
  const env2 = { NITHAN_HOME: home, CLOUDFLARE_ACCOUNT_ID: 'fromenv' };
  assert.deepEqual(await loadConfig(env2), ['CLOUDFLARE_API_TOKEN']);
  assert.equal(env2.CLOUDFLARE_ACCOUNT_ID, 'fromenv');
  assert.equal((await describeConfig(env2)).CLOUDFLARE_ACCOUNT_ID.source, 'env');
  // removal + validation
  await saveConfig({ CLOUDFLARE_API_TOKEN: '' }, env);
  assert.equal(env.CLOUDFLARE_API_TOKEN, undefined);
  assert.deepEqual(Object.keys(await readConfig(env)), ['CLOUDFLARE_ACCOUNT_ID']);
  await assert.rejects(saveConfig({ NOT_A_SETTING: 'x' }, env), /ไม่รู้จัก/);
  await assert.rejects(saveConfig({ GEMINI_API_KEY: 'has space' }, env), /ไม่ถูกต้อง/);
  await assert.rejects(saveConfig({ GEMINI_API_KEY: 'ไทย' }, env), /ไม่ถูกต้อง/);
  await fs.rm(home, { recursive: true });
});
