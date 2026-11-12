import { lazy, Suspense, useState } from 'react';
import { usePageHidden } from './hooks/usePageHidden.ts';
import { useReducedMotion } from './hooks/useReducedMotion.ts';

const PlayScene = lazy(() => import('./scene/PlayScene.tsx'));

export function App() {
  const hidden = usePageHidden();
  const reducedMotion = useReducedMotion();
  const [held, setHeld] = useState(false);

  return (
    <div className="app">
      <main className="phone">
        <Suspense fallback={<p className="boot">Mixing…</p>}>
          <PlayScene
            paused={hidden || held}
            held={held}
            reducedMotion={reducedMotion}
            onToggleHold={() => setHeld((value) => !value)}
          />
        </Suspense>
      </main>
    </div>
  );
}
