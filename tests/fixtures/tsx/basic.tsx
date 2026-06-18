// Basic TSX fixture covering TypeScript extractors with React-style syntax.
import type { ReactNode } from 'react';
import { createContext } from 'react';

const defaultTitle = 'Hello TSX';
let renderCount: number = 0;

/** Supported visual variants for the card component. */
type CardVariant = 'primary' | 'secondary';

type CardProps = {
  title: string;
  children?: ReactNode;
  variant?: CardVariant;
};

interface CardState {
  expanded: boolean;
  visits: number;
}

function formatTitle(title: string): string {
  const shouldBeIgnoredA = (): string => {
    return title.trim();
  };
  shouldBeIgnoredA();

  function shouldBeIgnoredB(value: string): string {
    return value.toUpperCase();
  }
  shouldBeIgnoredB(title);
  return title.trim();
}

function Card({ title, children, variant = 'primary' }: CardProps): JSX.Element {
  renderCount += 1;
  return (
    <section data-variant={variant}>
      <h2>{formatTitle(title)}</h2>
      <div>{children}</div>
    </section>
  );
}

class CardRegistry {
  private states: CardState[] = [];

  add(state: CardState): void {
    this.states.push(state);
  }

  list(): CardState[] {
    return this.states;
  }
}

const CardContext = createContext<CardState>({ expanded: false, visits: 0 });

export { Card, CardContext, CardRegistry, defaultTitle, formatTitle, renderCount };
export type { CardProps, CardState, CardVariant };
