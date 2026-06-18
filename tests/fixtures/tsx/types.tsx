// tsx/basic.tsx
9 type CardVariant = 'primary' | 'secondary';
11 type CardProps = {
     title: string;
     children?: ReactNode;
     variant?: CardVariant;
   };
