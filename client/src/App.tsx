import { lazy, Suspense, useState } from 'react';
import { usePageHidden } from './hooks/usePageHidden.ts';
import { useReducedMotion } from './hooks/useReducedMotion.ts';
import { TitleScene } from './scene/TitleScene.tsx';

const PlayScene = lazy(() => import('./scene/PlayScene.tsx'));

export function App() {
  const hidden = usePageHidden();
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<'title' | 'play'>('title');
  const [held, setHeld] = useState(false);

  return (
    <div className="app">
      <main className="phone">
        {mode === 'title' ? (
          <TitleScene
            paused={hidden}
            reducedMotion={reducedMotion}
            onPlay={() => {
              setHeld(false);
              setMode('play');
            }}
          />
        ) : (
          <Suspense fallback={<p className="boot">Mixing…</p>}>
            <PlayScene
              paused={hidden || held}
              held={held}
              reducedMotion={reducedMotion}
              onExit={() => {
                setHeld(false);
                setMode('title');
              }}
              onToggleHold={() => setHeld((value) => !value)}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}
