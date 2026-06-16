// Basic TypeScript fixture covering common extraction categories.
import type { Stats } from 'node:fs';

const answer = 42;
let label: string = 'basic';

/** A small reusable type alias. */
type Identifier = string | number;

interface Item {
  id: Identifier;
  name: string;
  stats?: Stats;
}

function formatItem(item: Item): string {
  const shouldBeIgnoredA = (): string => {
    return `${item.id}: ${item.name}`;
  };
  shouldBeIgnoredA();

  function shouldBeIgnoredB(id: Item["id"], name: Item["name"]): string {
    return `${id}: ${name}`;
  }
  shouldBeIgnoredB(1,'1');
  return `${item.id}: ${item.name}`;
}

class ItemStore {
  private items: Item[] = [];

  add(item: Item): void {
    this.items.push(item);
  }

  list(): Item[] {
    return this.items;
  }
}

export { answer, label, formatItem, ItemStore };
export type { Identifier, Item };
