const { planRequest, replan } = require('../.test-out/lib/teaching/requestPlan');
const { geminiTeachingLessonSchema } = require('../.test-out/lib/teaching/providers/gemini');

const request = {
  question: 'Teach me the solar system in 3D.',
  language: 'English',
  lessonStep: 1,
  boardState: { nodes: [], edges: [], texts: [], highlights: [] },
  visualState: { objects: [], tick: 0 },
  visualState3d: { objects: [], tick: 0 },
};

const GEMINI_SCHEMA = JSON.stringify(geminiTeachingLessonSchema);
const plan = planRequest(request, 'lesson', GEMINI_SCHEMA);
console.log('plan.level:', plan.level);
console.log('plan.size:', plan.size);

const compacted = replan(request, GEMINI_SCHEMA, plan.level);
console.log('compacted:', compacted);
if (compacted) {
  console.log('compacted.level:', compacted.level);
  console.log('compacted.size:', compacted.size);
}

console.log('Test 1:', compacted !== null && ["full", "compact", "minimal"].indexOf(compacted?.level) > ["full", "compact", "minimal"].indexOf(plan.level));
console.log('Test 2:', (compacted?.size?.totalTokens ?? Infinity) <= plan.size.totalTokens);
