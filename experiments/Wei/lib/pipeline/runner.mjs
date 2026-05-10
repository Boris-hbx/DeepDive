// Pipeline runner — composes stages with skill hooks and artifact persistence

import { getHooksForStage } from '../skills/index.mjs';

// Run a single stage with hooks
export async function runStage(name, fn, state, ctx) {
  const topic = state.topic || '';
  const domain = state.domain || '';
  const hooks = getHooksForStage(name, topic, domain);

  // Apply pre-hooks
  let hookContext = '';
  if (hooks.length > 0) {
    ctx.log(`  [hooks] ${name}: ${hooks.length} 个 skill 注入`);
    hookContext = hooks.map(h => `[${h.type}] ${h.content}`).join('\n');
  }

  const result = await fn(state, { ...ctx, hooks: hookContext });
  ctx.log(`  [${name}] 完成`);
  return result;
}

// Compose multiple stages into a single pipeline
export function createPipeline(stages, opts = {}) {
  return async function run(initialState) {
    const ctx = {
      log: opts.verbose !== false ? console.log : () => {},
      persistDir: opts.persistDir || null,
      provider: opts.provider || '',
      domain: opts.domain || '',
      focusTopics: opts.focusTopics || [],
    };

    let state = { ...initialState };
    for (const stage of stages) {
      try {
        // Call stage with required params
        const name = typeof stage.name === 'string' ? stage.name : 'stage';
        state = await runStage(name, stage.run, state, ctx);
      } catch (err) {
        ctx.log(`  [${stage.name || 'stage'}] 失败: ${err.message}`);
        if (opts.bailOnError !== false) throw err;
        state.errors = (state.errors || []).concat({ stage: stage.name || 'stage', message: err.message });
      }
    }
    return state;
  };
}

// Define a pipeline stage
export function defineStage(name, run) {
  return { name, run };
}
