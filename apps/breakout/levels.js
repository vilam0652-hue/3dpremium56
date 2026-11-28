/* Стеклобой — 15 уровней. Поле 11 клеток в ширину.
   Символы:  .  пусто
             a  шампань   g  золото   o  янтарь   r  розовое золото   w  жемчуг   k  чёрное стекло  (1 удар)
             2  прочное стекло (2 удара)   3  прочное стекло (3 удара)
             #  неразбиваемое стекло        *  бомба (взрывает соседей)
   move: группы строк, которые плавно ездят вбок (размах — по свободному месту). */
window.BREAKOUT_LEVELS = [
  { name: "Разминка", map: [
    "...........",
    ".aaaaaaaaa.",
    ".ggggggggg.",
    ".ooooooooo.",
    ".ggggggggg.",
    "..aaaaaaa.."
  ] },
  { name: "Сердце", map: [
    "..rr...rr..",
    ".rrrr.rrrr.",
    "rrwrrrrrrrr",
    "rwrrrrrrrrr",
    "rrrrrrrrrrr",
    ".rrrrrrrrr.",
    "..rrrrrrr..",
    "...rrrrr...",
    "....rrr....",
    ".....r....."
  ] },
  { name: "Звезда", map: [
    ".....g.....",
    "....ggg....",
    "....gag....",
    "ggggg*ggggg",
    ".gggaaaggg.",
    "..ggaaagg..",
    "...ggggg...",
    "..ggg.ggg..",
    ".ggg...ggg.",
    "gg.......gg"
  ] },
  { name: "Улыбка", map: [
    "...22222...",
    "..2aaaaa2..",
    ".2aaaaaaa2.",
    ".2akaaaka2.",
    ".2aaaaaaa2.",
    ".2kaaaaak2.",
    ".2akkkkka2.",
    "..2aaaaa2..",
    "...22222..."
  ] },
  { name: "Ракета", map: [
    ".....w.....",
    "....www....",
    "....w2w....",
    "...ww3ww...",
    "...w232w...",
    "...ww3ww...",
    "...wwwww...",
    "..gwwwwwg..",
    ".gg.www.gg.",
    ".g..*.*..g.",
    "....o.o...."
  ] },
  { name: "Буква К", map: [
    ".gg....gg..",
    ".gg...gg...",
    ".gg..gg..#.",
    ".gg.gg.....",
    ".gg*g...#..",
    ".ggg*......",
    ".gg.gg.....",
    ".gg..gg..#.",
    ".gg...gg...",
    ".gg....gg.."
  ] },
  { name: "Ёлка", map: [
    ".....a.....",
    "....ggg....",
    "...gg*gg...",
    "....ggg....",
    "...ggrgg...",
    "..gg*g*gg..",
    "...gwggg...",
    "..ggggrgg..",
    ".gg*ggg*gg.",
    ".ggggggggg.",
    "....###...."
  ] },
  { name: "Котик", map: [
    ".2.......2.",
    ".22.....22.",
    ".kkkkkkkkk.",
    ".kkkkkkkkk.",
    ".kakkkkkak.",
    ".k*kkkkk*k.",
    ".kkkkrkkkk.",
    "akkkrkrkkka",
    "..kkkkkkk..",
    "...kkkkk..."
  ] },
  { name: "Корона", map: [
    "a....a....a",
    "gg..g*g..gg",
    "ggg.ggg.ggg",
    "ggggggggggg",
    "g2gg2r2gg2g",
    "ggggggggggg",
    "ooooooooooo",
    "o#o#o#o#o#o"
  ] },
  { name: "Бабочка", move: [{ rows: [0, 9], speed: .55 }], map: [
    ".r.......r.",
    ".rrr...rrr.",
    ".rarr.rrar.",
    ".rrrr2rrrr.",
    "..rrr2rrr..",
    "...rr*rr...",
    "..rrr2rrr..",
    ".rrrr2rrrr.",
    ".rar.2.rar.",
    "..r.....r.."
  ] },
  { name: "Замок", move: [{ rows: [9, 9], speed: .9 }], map: [
    "2.2.....2.2",
    "222.....222",
    "2a2.g.g.2a2",
    "222ggggg222",
    "22ggg*ggg22",
    "2gg2ggg2gg2",
    "2ggg...ggg2",
    "2gg.....gg2",
    "...........",
    "...###....."
  ] },
  { name: "Капля", move: [{ rows: [12, 12], speed: .8 }, { rows: [13, 13], speed: .8, phase: Math.PI }], map: [
    ".....a.....",
    "....aga....",
    "....ggg....",
    "...ggggg...",
    "..ggwgggg..",
    "..gwwgggg..",
    ".ggwgggggg.",
    ".ggggggggg.",
    ".2ggggggg2.",
    "..22ggg22..",
    "...22222...",
    "...........",
    "###........",
    "........###"
  ] },
  { name: "Планета", move: [{ rows: [0, 0], speed: 1.1 }, { rows: [5, 5], speed: .35 }], map: [
    "g..........",
    "...........",
    "....kkk....",
    "..kk3kkkk..",
    ".kkkkkkk3k.",
    ".aa*aaa*aa.",
    ".k3kkkkkkk.",
    "..kkkkk3k..",
    "....kkk...."
  ] },
  { name: "Алмаз", move: [{ rows: [0, 0], speed: .7 }, { rows: [1, 1], speed: .7, phase: Math.PI }, { rows: [2, 2], speed: .7 }, { rows: [3, 3], speed: .7, phase: Math.PI }, { rows: [4, 4], speed: .7 }, { rows: [5, 5], speed: .7, phase: Math.PI }, { rows: [6, 6], speed: .7 }], map: [
    "...wwwww...",
    "..wwawaww..",
    ".www3w3www.",
    "..wwwwwww..",
    "...ww*ww...",
    "....www....",
    ".....w....."
  ] },
  { name: "Кубок", move: [{ rows: [11, 11], speed: .9 }, { rows: [12, 12], speed: .9, phase: Math.PI }], map: [
    ".aaaaaaaaa.",
    "ggg33333ggg",
    "g.ggg*ggg.g",
    "g.ggggggg.g",
    ".ggggggggg.",
    "...ggggg...",
    "....ggg....",
    ".....2.....",
    "....222....",
    "...ooooo...",
    "...........",
    "###........",
    "........###"
  ] }
];
