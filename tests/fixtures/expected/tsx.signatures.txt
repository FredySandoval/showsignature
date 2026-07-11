// tsx/basic.tsx
22 function formatTitle(title: string): string;
35 function Card({ title, children, variant = 'primary' }: CardProps): JSX.Element;
45 class CardRegistry {
     add(state: CardState): void;
     list(): CardState[];
   }
