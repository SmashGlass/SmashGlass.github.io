import { useEffect, useRef, useState } from 'preact/hooks';
import { SCENARIOS } from '../data/scenarios';

const DELAY: Record<string, number> = { hold: 2100, plan: 1250 };
const STEP_DELAY = 1000;
const HOLD_AT_END = 3800;

interface Props {
  /** Unique prefix so two consoles on one page keep distinct ARIA ids. */
  uid: string;
  minHeight?: number;
}

export default function AgentConsole({ uid, minHeight = 384 }: Props) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scenario = SCENARIOS[active];

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = SCENARIOS[active].steps;

    if (reduce) {
      setShown(steps.length);
      return;
    }

    setShown(0);
    let i = 0;

    const tick = () => {
      if (i >= steps.length) {
        timer.current = setTimeout(() => {
          i = 0;
          setShown(0);
          timer.current = setTimeout(tick, 800);
        }, HOLD_AT_END);
        return;
      }
      i += 1;
      setShown(i);
      timer.current = setTimeout(tick, DELAY[steps[i - 1].k] ?? STEP_DELAY);
    };

    timer.current = setTimeout(tick, 550);
    return () => clearTimeout(timer.current);
  }, [active]);

  return (
    <div className="con" style={{ minHeight }}>
      <div className="con-bar">
        <span className="dot" />
        <span className="nm">{scenario.name}</span>
        <div className="tabs" role="tablist" aria-label="Demonstration scenario">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              className="tab"
              role="tab"
              id={`${uid}-tab-${s.id}`}
              aria-selected={i === active}
              aria-controls={`${uid}-panel`}
              onClick={() => setActive(i)}
              type="button"
            >
              {s.tab}
            </button>
          ))}
        </div>
      </div>

      <div className="con-task">
        <span className="lab">Task from the client, in their words</span>
        {scenario.task}
      </div>

      <div
        className="con-steps"
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${scenario.id}`}
        aria-live="polite"
      >
        {scenario.steps.map((st, i) => (
          <div key={i} className={`step ${st.k} ${i < shown ? 'on' : ''}`}>
            <span className={`k ${st.k}`}>{st.label}</span>
            <span className="v">
              <span dangerouslySetInnerHTML={{ __html: st.text }} />
              {i === shown - 1 && <span className="caret" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
