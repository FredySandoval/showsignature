// tsx/basic.tsx
5 const defaultTitle = 'Hello TSX';
6 let renderCount: number = 0;
57 const CardContext = createContext<CardState>({ expanded: false, visits: 0 });
